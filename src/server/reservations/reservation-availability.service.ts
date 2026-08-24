import { createAdminClient } from '@/lib/supabase/server';
import { ReservationSettingsService } from './reservation-settings.service';
import {
  DiningTableDTO,
  TableAvailabilityResultDTO,
  TableCombinationDTO,
} from '@/lib/reservations/table-allocation-types';
import { ReservationStatus } from '@/lib/reservations/reservation-types';

export class ReservationAvailabilityService {
  /**
   * Evaluates available dining tables and valid combinations for a requested time window & party size.
   * Avoids N+1 queries by fetching candidate tables and active assignments in bounded grouped queries.
   */
  static async getAvailability(options: {
    businessId: string;
    branchId: string;
    reservationStartAt: string; // ISO timestamp
    reservationEndAt: string;   // ISO timestamp
    partySize: number;
    serviceAreaId?: string | null;
    excludedReservationId?: string | null;
  }): Promise<TableAvailabilityResultDTO> {
    const {
      businessId,
      branchId,
      reservationStartAt,
      reservationEndAt,
      partySize,
      serviceAreaId,
      excludedReservationId,
    } = options;

    const admin = createAdminClient();
    const settings = await ReservationSettingsService.getBranchSettings(businessId, branchId);
    const bufferMinutes = settings.tableTurnoverBufferMinutes || 15;
    const maxCombinations = settings.maxTableCombination || 3;

    // Requested interval extended with branch turnover buffer: [start, end + buffer)
    const reqStartMs = new Date(reservationStartAt).getTime();
    const reqEndWithBufferMs = new Date(reservationEndAt).getTime() + bufferMinutes * 60 * 1000;

    // 1. Bounded Query: Fetch candidate tables for business & branch
    let tableQuery = admin
      .from('dining_tables')
      .select('id, business_id, branch_id, service_area_id, name, code, table_number, capacity, min_capacity, reservations_enabled, status, is_active')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('capacity', { ascending: true })
      .order('display_order', { ascending: true });

    if (serviceAreaId) {
      tableQuery = tableQuery.eq('service_area_id', serviceAreaId);
    }

    const { data: rawTables, error: tableErr } = await tableQuery;
    if (tableErr || !rawTables) {
      throw new Error(`Failed to query dining tables for branch: ${tableErr?.message}`);
    }

    const candidateTables: DiningTableDTO[] = rawTables.map((t) => ({
      id: t.id,
      businessId: t.business_id,
      branchId: t.branch_id,
      serviceAreaId: t.service_area_id,
      name: t.name,
      code: t.code,
      tableNumber: t.table_number,
      capacity: t.capacity || 4,
      minCapacity: t.min_capacity || 1,
      reservationsEnabled: t.reservations_enabled !== false,
      status: t.status,
      isActive: t.is_active,
    }));

    // Filter to reservable tables only
    const reservableTables = candidateTables.filter((t) => t.reservationsEnabled);

    // 2. Bounded Query: Fetch active (unreleased) table assignments
    const { data: activeAssignments, error: assignErr } = await admin
      .from('reservation_table_assignments')
      .select('table_id, reservation_id')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .is('released_at', null);

    if (assignErr) {
      throw new Error(`Failed to query active table assignments: ${assignErr.message}`);
    }

    const activeResIds = (activeAssignments || [])
      .map((a) => a.reservation_id)
      .filter((id) => id !== excludedReservationId);

    // 3. Bounded Query: Fetch overlapping blocking reservations (PENDING, CONFIRMED, ARRIVED, SEATED)
    const blockingStatuses: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'];
    
    let occupiedTableIds: string[] = [];
    if (activeResIds.length > 0) {
      const reqStartIso = new Date(reqStartMs).toISOString();
      const reqEndIso = new Date(reqEndWithBufferMs).toISOString();

      const { data: blockingReservations } = await admin
        .from('reservations')
        .select('id, status, reservation_start_at, reservation_end_at')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .in('id', activeResIds)
        .in('status', blockingStatuses)
        .lt('reservation_start_at', reqEndIso)
        .gt('reservation_end_at', reqStartIso);

      const blockingResIdSet = new Set((blockingReservations || []).map((r) => r.id));
      occupiedTableIds = (activeAssignments || [])
        .filter((a) => blockingResIdSet.has(a.reservation_id))
        .map((a) => a.table_id);
    }

    const occupiedSet = new Set(occupiedTableIds);

    // Filter available tables in memory
    const availableTables = reservableTables.filter((t) => !occupiedSet.has(t.id));

    // 4. Deterministic Single Table Fit Selection
    // Priority 1: Exact single-table fit (minCapacity <= partySize <= capacity)
    let recommendedSingleTable: DiningTableDTO | null =
      availableTables.find((t) => partySize >= t.minCapacity && partySize <= t.capacity) || null;

    // Priority 2: Smallest sufficient single table (capacity >= partySize)
    if (!recommendedSingleTable) {
      recommendedSingleTable = availableTables.find((t) => t.capacity >= partySize) || null;
    }

    // 5. Multi-table combination selection (if single table fit unavailable)
    let recommendedCombination: TableCombinationDTO | null = null;
    if (!recommendedSingleTable && maxCombinations >= 2) {
      const combinations = this.computeMultiTableCombinations(availableTables, partySize, maxCombinations);
      recommendedCombination = combinations.length > 0 ? combinations[0] : null;
    }

    return {
      availableTables,
      recommendedSingleTable,
      recommendedCombination,
      occupiedTableIds: Array.from(occupiedSet),
    };
  }

  /**
   * Computes valid multi-table combinations for a party size.
   * Tables must share the same service area and branch.
   */
  static computeMultiTableCombinations(
    availableTables: DiningTableDTO[],
    partySize: number,
    maxTables: number = 3
  ): TableCombinationDTO[] {
    // Group available tables by serviceAreaId
    const byArea: Record<string, DiningTableDTO[]> = {};
    for (const t of availableTables) {
      if (!byArea[t.serviceAreaId]) byArea[t.serviceAreaId] = [];
      byArea[t.serviceAreaId].push(t);
    }

    const validCombinations: TableCombinationDTO[] = [];

    for (const areaId of Object.keys(byArea)) {
      const areaTables = byArea[areaId];
      if (areaTables.length < 2) continue;

      // Generate subsets of size 2 up to maxTables
      const subsets = this.generateSubsets(areaTables, 2, maxTables);
      for (const subset of subsets) {
        const totalCap = subset.reduce((sum, t) => sum + t.capacity, 0);
        const minCap = subset.reduce((sum, t) => sum + t.minCapacity, 0);
        if (totalCap >= partySize) {
          validCombinations.push({
            tables: subset,
            totalCapacity: totalCap,
            minCapacity: minCap,
            tableCount: subset.length,
            serviceAreaId: areaId,
          });
        }
      }
    }

    // Sort combinations deterministically:
    // 1. Smallest total capacity fit (avoid absurd over-capacity)
    // 2. Smallest table count
    validCombinations.sort((a, b) => {
      const capDiff = a.totalCapacity - b.totalCapacity;
      if (capDiff !== 0) return capDiff;
      return a.tableCount - b.tableCount;
    });

    return validCombinations;
  }

  private static generateSubsets(tables: DiningTableDTO[], minSize: number, maxSize: number): DiningTableDTO[][] {
    const results: DiningTableDTO[][] = [];

    function backtrack(startIdx: number, current: DiningTableDTO[]) {
      if (current.length >= minSize && current.length <= maxSize) {
        results.push([...current]);
      }
      if (current.length >= maxSize) return;

      for (let i = startIdx; i < tables.length; i++) {
        current.push(tables[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }

    backtrack(0, []);
    return results;
  }
}

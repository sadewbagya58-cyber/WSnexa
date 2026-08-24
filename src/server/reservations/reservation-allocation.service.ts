import { createAdminClient } from '@/lib/supabase/server';
import { ReservationAvailabilityService } from './reservation-availability.service';
import { ReservationQueryService } from './reservation-query.service';
import { ReservationService } from './reservation.service';
import { createDomainError } from './reservation-validation.service';
import {
  ReservationTableAssignmentDTO,
  TableAssignmentType,
} from '@/lib/reservations/table-allocation-types';
import { ReservationDTO } from '@/lib/reservations/reservation-types';

export class ReservationAllocationService {
  /**
   * Automatically allocates best-fit table(s) for a reservation.
   */
  static async allocateReservationTables(
    businessId: string,
    reservationId: string,
    actorUserId?: string | null
  ): Promise<ReservationTableAssignmentDTO[]> {
    const reservation = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!reservation) {
      throw createDomainError('Reservation not found.', 'NOT_FOUND');
    }

    const availability = await ReservationAvailabilityService.getAvailability({
      businessId: reservation.businessId,
      branchId: reservation.branchId,
      reservationStartAt: reservation.reservationStartAt,
      reservationEndAt: reservation.reservationEndAt,
      partySize: reservation.partySize,
      excludedReservationId: reservation.id,
    });

    let selectedTableIds: string[] = [];
    if (availability.recommendedSingleTable) {
      selectedTableIds = [availability.recommendedSingleTable.id];
    } else if (availability.recommendedCombination) {
      selectedTableIds = availability.recommendedCombination.tables.map((t) => t.id);
    } else {
      throw createDomainError('No available dining table or table combination fits this party size.', 'INVALID_INPUT');
    }

    return this.assignTables({
      businessId: reservation.businessId,
      branchId: reservation.branchId,
      reservationId: reservation.id,
      tableIds: selectedTableIds,
      assignmentType: 'AUTO',
      actorUserId: actorUserId || null,
      reservationStartAt: reservation.reservationStartAt,
      reservationEndAt: reservation.reservationEndAt,
      partySize: reservation.partySize,
    });
  }

  /**
   * Manually assigns specific tables to a reservation with full parameter & overlap validation.
   */
  static async manuallyAssignTables(options: {
    businessId: string;
    reservationId: string;
    tableIds: string[];
    actorUserId: string;
  }): Promise<ReservationTableAssignmentDTO[]> {
    const { businessId, reservationId, tableIds, actorUserId } = options;

    const reservation = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!reservation) {
      throw createDomainError('Reservation not found or outside authorized property scope.', 'FORBIDDEN_SCOPE');
    }

    return this.assignTables({
      businessId: reservation.businessId,
      branchId: reservation.branchId,
      reservationId: reservation.id,
      tableIds,
      assignmentType: 'MANUAL',
      actorUserId,
      reservationStartAt: reservation.reservationStartAt,
      reservationEndAt: reservation.reservationEndAt,
      partySize: reservation.partySize,
    });
  }

  /**
   * Releases active table assignments for a reservation.
   */
  static async releaseReservationTables(
    businessId: string,
    reservationId: string
  ): Promise<number> {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: updatedRows, error } = await admin
      .from('reservation_table_assignments')
      .update({ released_at: nowIso })
      .eq('business_id', businessId)
      .eq('reservation_id', reservationId)
      .is('released_at', null)
      .select('id');

    if (error) {
      throw new Error(`Failed to release table assignments: ${error.message}`);
    }

    return updatedRows?.length || 0;
  }

  /**
   * Retrieves active table assignments for a reservation.
   */
  static async getActiveAssignments(
    businessId: string,
    reservationId: string
  ): Promise<ReservationTableAssignmentDTO[]> {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from('reservation_table_assignments')
      .select('id, reservation_id, business_id, branch_id, table_id, assignment_type, assigned_by_user_id, assigned_at, released_at, created_at, dining_tables ( name, table_number, service_area_id )')
      .eq('business_id', businessId)
      .eq('reservation_id', reservationId)
      .is('released_at', null);

    if (error || !rows) return [];

    return rows.map((r) => {
      const dt = Array.isArray(r.dining_tables) ? r.dining_tables[0] : r.dining_tables;
      return {
        id: r.id,
        reservationId: r.reservation_id,
        businessId: r.business_id,
        branchId: r.branch_id,
        tableId: r.table_id,
        tableName: dt?.name || (dt?.table_number ? `Table ${dt.table_number}` : undefined),
        tableNumber: dt?.table_number || null,
        serviceAreaId: dt?.service_area_id,
        assignmentType: r.assignment_type as TableAssignmentType,
        assignedByUserId: r.assigned_by_user_id || null,
        assignedAt: r.assigned_at,
        releasedAt: r.released_at || null,
        createdAt: r.created_at,
      };
    });
  }

  /**
   * Complete staff walk-in flow: Creates reservation, assigns table, marks ARRIVED -> SEATED.
   */
  static async createWalkInSeating(options: {
    businessId: string;
    branchId: string;
    guestName: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    partySize: number;
    tableIds?: string[];
    durationMinutes?: number;
    specialRequests?: string | null;
    actorUserId: string;
  }): Promise<{ reservation: ReservationDTO; assignments: ReservationTableAssignmentDTO[] }> {
    const {
      businessId,
      branchId,
      guestName,
      guestEmail,
      guestPhone,
      partySize,
      tableIds,
      durationMinutes = 90,
      specialRequests,
      actorUserId,
    } = options;

    const nowIso = new Date().toISOString();

    // 1. Create walk-in reservation
    const reservation = await ReservationService.createReservation(
      {
        businessId,
        branchId,
        guestName,
        guestEmail,
        guestPhone,
        partySize,
        reservationStartAt: nowIso,
        durationMinutes,
        specialRequests,
        source: 'WALK_IN',
      },
      actorUserId,
      'STAFF'
    );

    // 2. Allocate or assign specified tables
    let assignments: ReservationTableAssignmentDTO[];
    if (tableIds && tableIds.length > 0) {
      assignments = await this.assignTables({
        businessId,
        branchId,
        reservationId: reservation.id,
        tableIds,
        assignmentType: 'WALK_IN',
        actorUserId,
        reservationStartAt: reservation.reservationStartAt,
        reservationEndAt: reservation.reservationEndAt,
        partySize,
      });
    } else {
      assignments = await this.allocateReservationTables(businessId, reservation.id, actorUserId);
    }

    // 3. Mark ARRIVED -> SEATED
    await ReservationService.markArrived(businessId, reservation.id, actorUserId);
    const seatedRes = await ReservationService.markSeated(businessId, reservation.id, actorUserId);

    return { reservation: seatedRes, assignments };
  }

  /**
   * Internal helper to validate and insert table assignments with concurrency safety.
   */
  private static async assignTables(options: {
    businessId: string;
    branchId: string;
    reservationId: string;
    tableIds: string[];
    assignmentType: TableAssignmentType;
    actorUserId: string | null;
    reservationStartAt: string;
    reservationEndAt: string;
    partySize: number;
  }): Promise<ReservationTableAssignmentDTO[]> {
    const {
      businessId,
      branchId,
      reservationId,
      tableIds,
      assignmentType,
      actorUserId,
      reservationStartAt,
      reservationEndAt,
      partySize,
    } = options;

    const admin = createAdminClient();

    // 1. Validate tables existence, branch ownership, active state, and reservable flag
    const { data: tables, error: tableErr } = await admin
      .from('dining_tables')
      .select('id, business_id, branch_id, capacity, min_capacity, reservations_enabled, is_active')
      .in('id', tableIds)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (tableErr || !tables || tables.length !== tableIds.length) {
      throw createDomainError('One or more selected tables do not exist or belong to a different branch.', 'INVALID_INPUT');
    }

    const nonReservable = tables.filter((t) => t.reservations_enabled === false);
    if (nonReservable.length > 0) {
      throw createDomainError('One or more selected tables are marked as non-reservable.', 'INVALID_INPUT');
    }

    const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0);
    if (totalCapacity < partySize) {
      throw createDomainError(
        `Selected table capacity (${totalCapacity}) is insufficient for party size (${partySize}).`,
        'INVALID_PARTY_SIZE'
      );
    }

    // 2. Overlap validation
    const availability = await ReservationAvailabilityService.getAvailability({
      businessId,
      branchId,
      reservationStartAt,
      reservationEndAt,
      partySize,
      excludedReservationId: reservationId,
    });

    const occupiedSet = new Set(availability.occupiedTableIds);
    const conflictingTables = tableIds.filter((id) => occupiedSet.has(id));
    if (conflictingTables.length > 0) {
      throw createDomainError('One or more selected tables are already assigned for an overlapping time window.', 'CONCURRENCY_CONFLICT');
    }

    // 3. Release previous active assignments for this reservation
    await this.releaseReservationTables(businessId, reservationId);

    // 4. Insert new assignments
    const nowIso = new Date().toISOString();
    const insertPayload = tableIds.map((tId) => ({
      reservation_id: reservationId,
      business_id: businessId,
      branch_id: branchId,
      table_id: tId,
      assignment_type: assignmentType,
      assigned_by_user_id: actorUserId || null,
      assigned_at: nowIso,
      created_at: nowIso,
    }));

    const { data: inserted, error: insertErr } = await admin
      .from('reservation_table_assignments')
      .insert(insertPayload)
      .select('*');

    if (insertErr || !inserted) {
      throw new Error(`Failed to assign tables: ${insertErr?.message}`);
    }

    return this.getActiveAssignments(businessId, reservationId);
  }
}

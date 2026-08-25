import { createAdminClient } from '@/lib/supabase/server';
import { maskEmail, maskPhone } from '@/lib/crm/crm-normalization';
import {
  ListReservationsFilter,
  PaginatedReservationsDTO,
  ReservationDTO,
  ReservationStatus,
  ReservationSource,
} from '@/lib/reservations/reservation-types';

interface ReservationRow {
  id: string;
  business_id: string;
  branch_id: string;
  crm_customer_id?: string | null;
  created_by_user_id?: string | null;
  created_by_source: string;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  reservation_date: string;
  reservation_start_at: string;
  reservation_end_at: string;
  party_size: number;
  status: string;
  special_requests?: string | null;
  internal_notes?: string | null;
  occasion?: string | null;
  source: string;
  confirmation_code: string;
  cancelled_at?: string | null;
  cancelled_by_user_id?: string | null;
  cancellation_reason?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
  arrived_at?: string | null;
  seated_at?: string | null;
  completed_at?: string | null;
  no_show_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class ReservationQueryService {
  /**
   * Fetches paginated reservations with property reach isolation, status filtering, and contact masking.
   */
  static async listReservations(
    filter: ListReservationsFilter,
    hasContactView = false
  ): Promise<PaginatedReservationsDTO> {
    const admin = createAdminClient();
    const {
      businessId,
      branchId,
      authorizedBranchIds,
      status,
      dateFrom,
      dateTo,
      crmCustomerId,
      searchQuery,
      limit = 25,
      offset = 0,
    } = filter;

    let query = admin
      .from('reservations')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId);

    // Apply property scope isolation
    if (branchId) {
      if (authorizedBranchIds && authorizedBranchIds.length > 0 && !authorizedBranchIds.includes(branchId)) {
        return { items: [], totalCount: 0, limit, offset };
      }
      query = query.eq('branch_id', branchId);
    } else if (authorizedBranchIds && authorizedBranchIds.length > 0) {
      query = query.in('branch_id', authorizedBranchIds);
    }

    if (crmCustomerId) {
      query = query.eq('crm_customer_id', crmCustomerId);
    }

    if (status) {
      if (Array.isArray(status)) {
        if (status.length > 0) {
          query = query.in('status', status);
        }
      } else {
        query = query.eq('status', status);
      }
    }

    if (dateFrom) {
      query = query.gte('reservation_start_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('reservation_start_at', dateTo);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(`guest_name.ilike.%${q}%,confirmation_code.ilike.%${q}%`);
    }

    query = query
      .order('reservation_start_at', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;
    if (error || !rows) {
      throw new Error(`Failed to list reservations: ${error?.message}`);
    }

    const items: ReservationDTO[] = (rows as unknown as ReservationRow[]).map((r) => this.mapRowToDTO(r, hasContactView));

    return {
      items,
      totalCount: count || 0,
      limit,
      offset,
    };
  }

  /**
   * Fetches a single reservation by ID.
   */
  static async getReservationById(
    businessId: string,
    reservationId: string,
    authorizedBranchIds?: string[] | null,
    hasContactView = false
  ): Promise<ReservationDTO | null> {
    const admin = createAdminClient();
    const { data: r, error } = await admin
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error || !r) return null;

    const row = r as unknown as ReservationRow;
    if (authorizedBranchIds && authorizedBranchIds.length > 0 && !authorizedBranchIds.includes(row.branch_id)) {
      return null;
    }

    return this.mapRowToDTO(row, hasContactView);
  }

  /**
   * Fetches a reservation by confirmation code.
   */
  static async getReservationByConfirmationCode(
    businessId: string,
    confirmationCode: string,
    hasContactView = false
  ): Promise<ReservationDTO | null> {
    const admin = createAdminClient();
    const { data: r, error } = await admin
      .from('reservations')
      .select('*')
      .eq('business_id', businessId)
      .eq('confirmation_code', confirmationCode.trim())
      .maybeSingle();

    if (error || !r) return null;
    return this.mapRowToDTO(r as unknown as ReservationRow, hasContactView);
  }

  /**
   * Internal mapper to produce a sanitized DTO with masked contact handling.
   */
  private static mapRowToDTO(row: ReservationRow, hasContactView: boolean): ReservationDTO {
    const rawEmail = row.guest_email || null;
    const rawPhone = row.guest_phone || null;

    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      crmCustomerId: row.crm_customer_id || null,
      createdByUserId: row.created_by_user_id || null,
      createdBySource: row.created_by_source,
      guestName: row.guest_name,
      guestEmail: hasContactView ? rawEmail : null,
      guestPhone: hasContactView ? rawPhone : null,
      guestEmailMasked: maskEmail(rawEmail),
      guestPhoneMasked: maskPhone(rawPhone),
      reservationDate: row.reservation_date,
      reservationStartAt: row.reservation_start_at,
      reservationEndAt: row.reservation_end_at,
      partySize: row.party_size,
      status: row.status as ReservationStatus,
      specialRequests: row.special_requests || null,
      internalNotes: row.internal_notes || null,
      occasion: row.occasion || null,
      source: row.source as ReservationSource,
      confirmationCode: row.confirmation_code,
      cancelledAt: row.cancelled_at || null,
      cancelledByUserId: row.cancelled_by_user_id || null,
      cancellationReason: row.cancellation_reason || null,
      declinedAt: row.declined_at || null,
      declineReason: row.decline_reason || null,
      arrivedAt: row.arrived_at || null,
      seatedAt: row.seated_at || null,
      completedAt: row.completed_at || null,
      noShowAt: row.no_show_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

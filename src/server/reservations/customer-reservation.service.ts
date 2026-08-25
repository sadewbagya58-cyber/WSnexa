import { createAdminClient } from '@/lib/supabase/server';
import { ReservationService } from '@/server/reservations/reservation.service';
import { ReservationAllocationService } from '@/server/reservations/reservation-allocation.service';
import { createDomainError } from '@/server/reservations/reservation-validation.service';
import {
  CustomerReservationDetailDTO,
  ReservationStatus,
} from '@/lib/reservations/reservation-types';

export class CustomerReservationService {
  /**
   * Helper to translate canonical reservation status into customer-friendly label.
   */
  static getCustomerStatusLabel(status: ReservationStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Awaiting Confirmation';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'ARRIVED':
        return 'Checked In';
      case 'SEATED':
        return 'Seated';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'Missed';
      case 'DECLINED':
        return 'Declined';
      default:
        return status;
    }
  }

  /**
   * Fetches reservations for an authenticated customer portal user.
   */
  static async getCustomerReservations(userId: string): Promise<CustomerReservationDetailDTO[]> {
    const admin = createAdminClient();

    // 1. Fetch user's email to resolve associated CRM customer records
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;

    let crmCustomerIds: string[] = [];
    if (userEmail) {
      const { data: crmRows } = await admin
        .from('crm_customers')
        .select('id')
        .eq('email', userEmail.toLowerCase());
      if (crmRows && crmRows.length > 0) {
        crmCustomerIds = crmRows.map((r) => r.id);
      }
    }

    let query = admin.from('reservations').select('*');

    if (crmCustomerIds.length > 0) {
      query = query.or(`created_by_user_id.eq.${userId},crm_customer_id.in.(${crmCustomerIds.join(',')})`);
    } else {
      query = query.eq('created_by_user_id', userId);
    }

    const { data: rows, error } = await query.order('reservation_start_at', { ascending: false });

    if (error || !rows) {
      return [];
    }

    // Hydrate venue names
    const businessIds = Array.from(new Set(rows.map((r) => r.business_id)));
    const branchIds = Array.from(new Set(rows.map((r) => r.branch_id)));

    const [{ data: businesses }, { data: branches }] = await Promise.all([
      admin.from('businesses').select('id, name, slug').in('id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000']),
      admin.from('branches').select('id, name').in('id', branchIds.length > 0 ? branchIds : ['00000000-0000-0000-0000-000000000000']),
    ]);

    const businessMap = new Map((businesses || []).map((b) => [b.id, b]));
    const branchMap = new Map((branches || []).map((br) => [br.id, br.name]));

    const nowMs = Date.now();

    return rows.map((r) => {
      const biz = businessMap.get(r.business_id);
      const branchName = branchMap.get(r.branch_id) || 'Main Branch';
      const status = r.status as ReservationStatus;
      const cancellationEligible =
        ['PENDING', 'CONFIRMED'].includes(status) && new Date(r.reservation_start_at).getTime() > nowMs;

      return {
        id: r.id,
        businessId: r.business_id,
        branchId: r.branch_id,
        crmCustomerId: r.crm_customer_id || null,
        createdByUserId: r.created_by_user_id || null,
        createdBySource: r.created_by_source,
        guestName: r.guest_name,
        guestEmail: r.guest_email || null,
        guestPhone: r.guest_phone || null,
        guestEmailMasked: null,
        guestPhoneMasked: null,
        reservationDate: r.reservation_date,
        reservationStartAt: r.reservation_start_at,
        reservationEndAt: r.reservation_end_at,
        partySize: r.party_size,
        status,
        specialRequests: r.special_requests || null,
        internalNotes: null, // Internal notes strictly hidden from customer
        occasion: r.occasion || null,
        source: r.source,
        confirmationCode: r.confirmation_code,
        guestAccessToken: r.guest_access_token || undefined,
        consentPromotional: r.consent_promotional || false,
        cancelledAt: r.cancelled_at || null,
        cancelledByUserId: r.cancelled_by_user_id || null,
        cancellationReason: r.cancellation_reason || null,
        arrivedAt: r.arrived_at || null,
        seatedAt: r.seated_at || null,
        completedAt: r.completed_at || null,
        noShowAt: r.no_show_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        venueName: biz?.name || 'Venue',
        venueSlug: biz?.slug || '',
        branchName,
        customerStatusLabel: this.getCustomerStatusLabel(status),
        cancellationEligible,
      };
    });
  }

  /**
   * Cancels a customer or guest reservation with ownership verification.
   */
  static async cancelCustomerReservation(params: {
    reservationId: string;
    userId?: string | null;
    guestAccessToken?: string | null;
    reason?: string | null;
  }): Promise<CustomerReservationDetailDTO> {
    const admin = createAdminClient();

    const { data: res, error } = await admin
      .from('reservations')
      .select('*')
      .eq('id', params.reservationId)
      .single();

    if (error || !res) {
      throw createDomainError('Reservation not found.', 'RESERVATION_NOT_FOUND');
    }

    // Ownership Verification
    let authorized = false;
    if (params.guestAccessToken && res.guest_access_token === params.guestAccessToken) {
      authorized = true;
    } else if (params.userId && res.created_by_user_id === params.userId) {
      authorized = true;
    }

    if (!authorized) {
      throw createDomainError('Unauthorized to cancel this reservation.', 'CANCELLATION_NOT_ALLOWED');
    }

    const currentStatus = res.status as ReservationStatus;
    if (!['PENDING', 'CONFIRMED'].includes(currentStatus)) {
      throw createDomainError(
        `Reservation in state '${this.getCustomerStatusLabel(currentStatus)}' cannot be cancelled.`,
        'CANCELLATION_NOT_ALLOWED'
      );
    }

    // Execute canonical cancellation & release tables
    await ReservationService.cancelReservation(
      res.business_id,
      res.id,
      params.userId || null,
      'CUSTOMER',
      params.reason || 'Cancelled by guest'
    );
    await ReservationAllocationService.releaseReservationTables(res.business_id, res.id);

    // Re-fetch updated record
    const { data: updated } = await admin
      .from('reservations')
      .select('*')
      .eq('id', res.id)
      .single();

    const { data: biz } = await admin.from('businesses').select('name, slug').eq('id', res.business_id).single();
    const { data: br } = await admin.from('branches').select('name').eq('id', res.branch_id).single();

    const finalStatus = (updated?.status || 'CANCELLED') as ReservationStatus;

    return {
      id: res.id,
      businessId: res.business_id,
      branchId: res.branch_id,
      crmCustomerId: res.crm_customer_id || null,
      createdByUserId: res.created_by_user_id || null,
      createdBySource: res.created_by_source,
      guestName: res.guest_name,
      guestEmail: res.guest_email || null,
      guestPhone: res.guest_phone || null,
      guestEmailMasked: null,
      guestPhoneMasked: null,
      reservationDate: res.reservation_date,
      reservationStartAt: res.reservation_start_at,
      reservationEndAt: res.reservation_end_at,
      partySize: res.party_size,
      status: finalStatus,
      specialRequests: res.special_requests || null,
      internalNotes: null,
      occasion: res.occasion || null,
      source: res.source,
      confirmationCode: res.confirmation_code,
      guestAccessToken: res.guest_access_token || undefined,
      consentPromotional: res.consent_promotional || false,
      cancelledAt: updated?.cancelled_at || new Date().toISOString(),
      cancelledByUserId: updated?.cancelled_by_user_id || params.userId || null,
      cancellationReason: updated?.cancellation_reason || params.reason || null,
      arrivedAt: res.arrived_at || null,
      seatedAt: res.seated_at || null,
      completedAt: res.completed_at || null,
      noShowAt: res.no_show_at || null,
      createdAt: res.created_at,
      updatedAt: updated?.updated_at || new Date().toISOString(),
      venueName: biz?.name || 'Venue',
      venueSlug: biz?.slug || '',
      branchName: br?.name || 'Main Branch',
      customerStatusLabel: this.getCustomerStatusLabel(finalStatus),
      cancellationEligible: false,
    };
  }
}

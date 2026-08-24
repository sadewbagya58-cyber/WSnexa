import { createAdminClient } from '@/lib/supabase/server';
import { maskEmail, maskPhone } from '@/lib/crm/crm-normalization';
import { ReservationService } from '@/server/reservations/reservation.service';
import { ReservationAllocationService } from '@/server/reservations/reservation-allocation.service';
import { ReservationSettingsService } from '@/server/reservations/reservation-settings.service';
import { createDomainError } from '@/server/reservations/reservation-validation.service';
import {
  CreateWaitlistEntryInput,
  PromoteWaitlistInput,
  ReservationTableAssignmentDTO,
  WaitlistEntryDTO,
  WaitlistStatus,
} from '@/lib/reservations/table-allocation-types';
import { ReservationDTO } from '@/lib/reservations/reservation-types';

interface WaitlistRow {
  id: string;
  business_id: string;
  branch_id: string;
  crm_customer_id?: string | null;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  party_size: number;
  requested_start_at?: string | null;
  requested_end_at?: string | null;
  status: string;
  priority: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  seated_at?: string | null;
  cancelled_at?: string | null;
}

export class ReservationWaitlistService {
  /**
   * Helper to map DB waitlist row to WaitlistEntryDTO with contact privacy masking.
   */
  private static mapRowToDTO(row: WaitlistRow, hasContactView: boolean): WaitlistEntryDTO {
    return {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      crmCustomerId: row.crm_customer_id || null,
      guestName: row.guest_name,
      guestEmail: hasContactView ? (row.guest_email || null) : null,
      guestPhone: hasContactView ? (row.guest_phone || null) : null,
      guestEmailMasked: row.guest_email ? maskEmail(row.guest_email) : null,
      guestPhoneMasked: row.guest_phone ? maskPhone(row.guest_phone) : null,
      partySize: row.party_size,
      requestedStartAt: row.requested_start_at || null,
      requestedEndAt: row.requested_end_at || null,
      status: row.status as WaitlistStatus,
      priority: row.priority,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      seatedAt: row.seated_at || null,
      cancelledAt: row.cancelled_at || null,
    };
  }

  /**
   * Adds a new entry to the waitlist queue.
   * Resolves branch settings for default duration and derives canonical requested_start_at / requested_end_at window.
   */
  static async addWaitlistEntry(
    input: CreateWaitlistEntryInput & { businessId: string }
  ): Promise<WaitlistEntryDTO> {
    const admin = createAdminClient();

    // 1. Resolve branch settings for canonical default duration & party size bounds
    const settings = await ReservationSettingsService.getBranchSettings(input.businessId, input.branchId);

    // Validate party size
    if (input.partySize < settings.minimumPartySize || input.partySize > settings.maximumPartySize) {
      throw createDomainError(
        `Party size must be between ${settings.minimumPartySize} and ${settings.maximumPartySize}.`,
        'INVALID_PARTY_SIZE'
      );
    }

    if (!input.guestName || input.guestName.trim().length < 2) {
      throw createDomainError('Guest name is required and must be at least 2 characters.', 'INVALID_INPUT');
    }

    // 2. Derive trusted start and end time window
    const nowIso = new Date().toISOString();
    const startAt = input.requestedStartAt ? new Date(input.requestedStartAt) : new Date(nowIso);
    if (isNaN(startAt.getTime())) {
      throw createDomainError('Invalid waitlist start time.', 'INVALID_INPUT');
    }

    const durationMinutes = settings.defaultDurationMinutes || 90;
    const defaultEndMs = startAt.getTime() + durationMinutes * 60 * 1000;
    const endAt = input.requestedEndAt ? new Date(input.requestedEndAt) : new Date(defaultEndMs);
    if (isNaN(endAt.getTime()) || endAt.getTime() <= startAt.getTime()) {
      throw createDomainError('Waitlist end time must be strictly after start time.', 'INVALID_INPUT');
    }

    const payload = {
      business_id: input.businessId,
      branch_id: input.branchId,
      crm_customer_id: input.crmCustomerId || null,
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail ? input.guestEmail.trim().toLowerCase() : null,
      guest_phone: input.guestPhone ? input.guestPhone.trim() : null,
      party_size: input.partySize,
      requested_start_at: startAt.toISOString(),
      requested_end_at: endAt.toISOString(),
      status: 'WAITING',
      priority: input.priority || 0,
      notes: input.notes ? input.notes.trim() : null,
    };

    const { data, error } = await admin
      .from('reservation_waitlist_entries')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[ReservationWaitlistService] DB insert error:', error?.message);
      throw createDomainError('Unable to add this guest to the waitlist.', 'INVALID_INPUT');
    }

    return this.mapRowToDTO(data, true);
  }

  /**
   * Lists waitlist entries for a branch ordered by priority DESC, created_at ASC.
   */
  static async listWaitlistEntries(params: {
    businessId: string;
    branchId: string;
    status?: WaitlistStatus | WaitlistStatus[] | null;
    hasContactView?: boolean;
    authorizedBranchIds?: string[] | null;
  }): Promise<WaitlistEntryDTO[]> {
    const admin = createAdminClient();
    const { businessId, branchId, status, hasContactView = false, authorizedBranchIds } = params;

    if (authorizedBranchIds && authorizedBranchIds.length > 0 && !authorizedBranchIds.includes(branchId)) {
      return [];
    }

    let query = admin
      .from('reservation_waitlist_entries')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (status) {
      if (Array.isArray(status)) {
        if (status.length > 0) {
          query = query.in('status', status);
        }
      } else {
        query = query.eq('status', status);
      }
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map((row) => this.mapRowToDTO(row, hasContactView));
  }

  /**
   * Updates waitlist status and records completion/cancellation timestamp.
   */
  static async updateWaitlistStatus(
    businessId: string,
    waitlistEntryId: string,
    targetStatus: WaitlistStatus
  ): Promise<WaitlistEntryDTO> {
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === 'SEATED') {
      updatePayload.seated_at = new Date().toISOString();
    } else if (targetStatus === 'CANCELLED') {
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { data: updated, error } = await admin
      .from('reservation_waitlist_entries')
      .update(updatePayload)
      .eq('id', waitlistEntryId)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) {
      throw createDomainError('Failed to update waitlist entry status.', 'INVALID_INPUT');
    }

    return {
      id: updated.id,
      businessId: updated.business_id,
      branchId: updated.branch_id,
      crmCustomerId: updated.crm_customer_id || null,
      guestName: updated.guest_name,
      guestEmail: updated.guest_email || null,
      guestPhone: updated.guest_phone || null,
      guestEmailMasked: updated.guest_email ? maskEmail(updated.guest_email) : null,
      guestPhoneMasked: updated.guest_phone ? maskPhone(updated.guest_phone) : null,
      partySize: updated.party_size,
      requestedStartAt: updated.requested_start_at || null,
      requestedEndAt: updated.requested_end_at || null,
      status: updated.status as WaitlistStatus,
      priority: updated.priority,
      notes: updated.notes || null,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      seatedAt: updated.seated_at || null,
      cancelledAt: updated.cancelled_at || null,
    };
  }

  /**
   * Promotes a waitlist entry into a confirmed/seated reservation.
   * Revalidates table availability, persists active table assignments, enforces SEATED invariant,
   * and prevents duplicate promotions.
   */
  static async promoteWaitlistEntryToReservation(
    input: PromoteWaitlistInput,
    actorUserId: string
  ): Promise<{ reservation: ReservationDTO; waitlistEntry: WaitlistEntryDTO; assignments: ReservationTableAssignmentDTO[] }> {
    const admin = createAdminClient();

    const { data: entry, error } = await admin
      .from('reservation_waitlist_entries')
      .select('*')
      .eq('id', input.waitlistEntryId)
      .single();

    if (error || !entry) {
      throw createDomainError('Waitlist entry not found.', 'NOT_FOUND');
    }

    if (entry.status === 'SEATED' || entry.status === 'CANCELLED') {
      throw createDomainError(`This waitlist entry has already been promoted (${entry.status}).`, 'WAITLIST_ALREADY_PROMOTED');
    }

    const nowIso = new Date().toISOString();

    // 1. Create canonical reservation with WAITLIST_PROMOTION intent
    const reservation = await ReservationService.createReservation(
      {
        businessId: entry.business_id,
        branchId: entry.branch_id,
        crmCustomerId: entry.crm_customer_id,
        guestName: entry.guest_name,
        guestEmail: entry.guest_email,
        guestPhone: entry.guest_phone,
        partySize: entry.party_size,
        reservationStartAt: nowIso,
        source: 'STAFF',
        intent: 'WAITLIST_PROMOTION',
        initialStatus: 'CONFIRMED',
      },
      actorUserId,
      'STAFF'
    );

    // 2. Allocate or assign specified tables WITHOUT swallowing errors
    let assignments: ReservationTableAssignmentDTO[] = [];
    try {
      if (input.tableIds && input.tableIds.length > 0) {
        assignments = await ReservationAllocationService.manuallyAssignTables({
          businessId: entry.business_id,
          reservationId: reservation.id,
          tableIds: input.tableIds,
          actorUserId,
        });
      } else {
        assignments = await ReservationAllocationService.allocateReservationTables(
          entry.business_id,
          reservation.id,
          actorUserId
        );
      }
    } catch (allocErr: unknown) {
      // Compensation: Roll back provisional reservation record if table allocation fails
      try {
        await admin.from('reservations').delete().eq('id', reservation.id);
      } catch (cleanupErr: unknown) {
        console.error('[WaitlistPromotion] Compensation cleanup failed:', (cleanupErr as Error).message);
      }
      throw allocErr;
    }

    // 3. Verify active table assignment exists before seating (Invariant Guard)
    const activeAssignments = await ReservationAllocationService.getActiveAssignments(entry.business_id, reservation.id);
    if (!activeAssignments || activeAssignments.length === 0) {
      try {
        await admin.from('reservations').delete().eq('id', reservation.id);
      } catch {}
      throw createDomainError('No suitable table is currently available.', 'NO_TABLE_AVAILABLE');
    }

    // 4. Apply canonical ARRIVED -> SEATED lifecycle transitions
    await ReservationService.markArrived(entry.business_id, reservation.id, actorUserId);
    const seatedRes = await ReservationService.markSeated(entry.business_id, reservation.id, actorUserId);

    // 5. Mark waitlist entry status as SEATED
    const updatedWaitlist = await this.updateWaitlistStatus(entry.business_id, entry.id, 'SEATED');

    return { reservation: seatedRes, waitlistEntry: updatedWaitlist, assignments: activeAssignments };
  }
}

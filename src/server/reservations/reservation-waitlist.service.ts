import { createAdminClient } from '@/lib/supabase/server';
import { CustomerIdentityService } from '@/server/crm/customer-identity.service';
import { ReservationService } from './reservation.service';
import { ReservationAllocationService } from './reservation-allocation.service';
import { createDomainError } from './reservation-validation.service';
import {
  CreateWaitlistEntryInput,
  PromoteWaitlistInput,
  WaitlistEntryDTO,
  WaitlistStatus,
} from '@/lib/reservations/table-allocation-types';
import { ReservationDTO } from '@/lib/reservations/reservation-types';

export class ReservationWaitlistService {
  /**
   * Helper to mask email address.
   */
  private static maskEmail(email: string | null): string | null {
    if (!email || !email.includes('@')) return null;
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  /**
   * Helper to mask phone number.
   */
  private static maskPhone(phone: string | null): string | null {
    if (!phone || phone.length < 5) return null;
    const visible = phone.slice(-4);
    return `${phone.slice(0, 3)}******${visible}`;
  }

  /**
   * Adds a guest entry to the branch waitlist.
   */
  static async addWaitlistEntry(
    input: CreateWaitlistEntryInput,
    actorUserId?: string | null
  ): Promise<WaitlistEntryDTO> {
    const admin = createAdminClient();

    if (input.partySize < 1) {
      throw createDomainError('Party size must be at least 1.', 'INVALID_PARTY_SIZE');
    }

    const startAt = new Date(input.requestedStartAt);
    if (isNaN(startAt.getTime())) {
      throw createDomainError('Invalid requested start timestamp.', 'INVALID_INPUT');
    }

    const endAtMs = input.requestedEndAt
      ? new Date(input.requestedEndAt).getTime()
      : startAt.getTime() + 90 * 60 * 1000;
    const endAt = new Date(endAtMs);

    // Resolve or link CRM customer identity
    let crmCustomerId: string | null = null;
    if (input.guestEmail || input.guestPhone || actorUserId) {
      try {
        const crmIdentity = await CustomerIdentityService.resolveOrCreateCustomerIdentity({
          businessId: input.businessId,
          authUserId: actorUserId || null,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
        });
        if (crmIdentity) {
          crmCustomerId = crmIdentity.id;
        }
      } catch (err: unknown) {
        console.warn('[ReservationWaitlistService] CRM identity resolution skipped:', (err as Error).message);
      }
    }

    const nowIso = new Date().toISOString();
    const payload = {
      business_id: input.businessId,
      branch_id: input.branchId,
      crm_customer_id: crmCustomerId,
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail ? input.guestEmail.trim().toLowerCase() : null,
      guest_phone: input.guestPhone ? input.guestPhone.trim() : null,
      party_size: input.partySize,
      requested_start_at: startAt.toISOString(),
      requested_end_at: endAt.toISOString(),
      status: 'WAITING' as WaitlistStatus,
      priority: input.priority || 0,
      notes: input.notes ? input.notes.trim() : null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error } = await admin
      .from('reservation_waitlist_entries')
      .insert(payload)
      .select('*')
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create waitlist entry: ${error?.message}`);
    }

    return {
      id: inserted.id,
      businessId: inserted.business_id,
      branchId: inserted.branch_id,
      crmCustomerId: inserted.crm_customer_id || null,
      guestName: inserted.guest_name,
      guestEmail: inserted.guest_email || null,
      guestPhone: inserted.guest_phone || null,
      guestEmailMasked: this.maskEmail(inserted.guest_email),
      guestPhoneMasked: this.maskPhone(inserted.guest_phone),
      partySize: inserted.party_size,
      requestedStartAt: inserted.requested_start_at,
      requestedEndAt: inserted.requested_end_at,
      status: inserted.status as WaitlistStatus,
      priority: inserted.priority,
      notes: inserted.notes || null,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
      seatedAt: inserted.seated_at || null,
      cancelledAt: inserted.cancelled_at || null,
    };
  }

  /**
   * Retrieves deterministic ordered waitlist entries for a branch with privacy contact masking.
   */
  static async listWaitlistEntries(options: {
    businessId: string;
    branchId: string;
    status?: WaitlistStatus | WaitlistStatus[] | null;
    hasContactView?: boolean;
    authorizedBranchIds?: string[] | null;
  }): Promise<WaitlistEntryDTO[]> {
    const { businessId, branchId, status, hasContactView = false, authorizedBranchIds } = options;

    if (authorizedBranchIds && authorizedBranchIds.length > 0 && !authorizedBranchIds.includes(branchId)) {
      return [];
    }

    const admin = createAdminClient();
    let query = admin
      .from('reservation_waitlist_entries')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    return rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      branchId: r.branch_id,
      crmCustomerId: r.crm_customer_id || null,
      guestName: r.guest_name,
      guestEmail: hasContactView ? (r.guest_email || null) : null,
      guestPhone: hasContactView ? (r.guest_phone || null) : null,
      guestEmailMasked: this.maskEmail(r.guest_email),
      guestPhoneMasked: this.maskPhone(r.guest_phone),
      partySize: r.party_size,
      requestedStartAt: r.requested_start_at,
      requestedEndAt: r.requested_end_at,
      status: r.status as WaitlistStatus,
      priority: r.priority,
      notes: r.notes || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      seatedAt: r.seated_at || null,
      cancelledAt: r.cancelled_at || null,
    }));
  }

  /**
   * Updates waitlist status.
   */
  static async updateWaitlistStatus(
    businessId: string,
    waitlistEntryId: string,
    newStatus: WaitlistStatus
  ): Promise<WaitlistEntryDTO> {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: nowIso,
    };

    if (newStatus === 'SEATED') updatePayload.seated_at = nowIso;
    if (newStatus === 'CANCELLED') updatePayload.cancelled_at = nowIso;

    const { data: updated, error } = await admin
      .from('reservation_waitlist_entries')
      .update(updatePayload)
      .eq('id', waitlistEntryId)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (error || !updated) {
      throw createDomainError('Waitlist entry not found.', 'NOT_FOUND');
    }

    return {
      id: updated.id,
      businessId: updated.business_id,
      branchId: updated.branch_id,
      crmCustomerId: updated.crm_customer_id || null,
      guestName: updated.guest_name,
      guestEmail: updated.guest_email || null,
      guestPhone: updated.guest_phone || null,
      guestEmailMasked: this.maskEmail(updated.guest_email),
      guestPhoneMasked: this.maskPhone(updated.guest_phone),
      partySize: updated.party_size,
      requestedStartAt: updated.requested_start_at,
      requestedEndAt: updated.requested_end_at,
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
   * Revalidates availability and prevents duplicate promotions.
   */
  static async promoteWaitlistEntryToReservation(
    input: PromoteWaitlistInput,
    actorUserId: string
  ): Promise<{ reservation: ReservationDTO; waitlistEntry: WaitlistEntryDTO }> {
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

    // 2. Allocate or assign tables if specified
    if (input.tableIds && input.tableIds.length > 0) {
      await ReservationAllocationService.manuallyAssignTables({
        businessId: entry.business_id,
        reservationId: reservation.id,
        tableIds: input.tableIds,
        actorUserId,
      });
    } else {
      try {
        await ReservationAllocationService.allocateReservationTables(entry.business_id, reservation.id, actorUserId);
      } catch (allocErr: unknown) {
        console.warn('[WaitlistPromotion] Table auto-allocation skipped:', (allocErr as Error).message);
      }
    }

    // 3. Apply canonical ARRIVED -> SEATED lifecycle transitions
    await ReservationService.markArrived(entry.business_id, reservation.id, actorUserId);
    const seatedRes = await ReservationService.markSeated(entry.business_id, reservation.id, actorUserId);

    // 4. Mark waitlist entry status as SEATED
    const updatedWaitlist = await this.updateWaitlistStatus(entry.business_id, entry.id, 'SEATED');

    return { reservation: seatedRes, waitlistEntry: updatedWaitlist };
  }
}

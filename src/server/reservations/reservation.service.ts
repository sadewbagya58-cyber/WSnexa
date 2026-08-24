import { createAdminClient } from '@/lib/supabase/server';
import { CustomerIdentityService } from '@/server/crm/customer-identity.service';
import {
  CreateReservationInput,
  PublicReservationDTO,
  ReservationDTO,
  ReservationStatus,
  ReservationStatusEventDTO,
  StatusActorType,
} from '@/lib/reservations/reservation-types';
import { ReservationLifecycleService } from './reservation-lifecycle.service';
import { ReservationSettingsService } from './reservation-settings.service';
import { ReservationValidationService } from './reservation-validation.service';
import { ReservationQueryService } from './reservation-query.service';
import crypto from 'crypto';

export class ReservationService {
  /**
   * Generates a unique, non-sequential, human-friendly confirmation code (e.g. RSV-7K4M2Q).
   */
  static generateConfirmationCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const bytes = crypto.randomBytes(6);
    let result = 'RSV-';
    for (let i = 0; i < 6; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Authoritatively creates a new reservation, resolves/links CRM guest identity,
   * records the historical snapshot, and appends the initial status event.
   */
  static async createReservation(
    input: CreateReservationInput,
    actorUserId?: string | null,
    actorType: StatusActorType = 'STAFF'
  ): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const settings = await ReservationSettingsService.getBranchSettings(input.businessId, input.branchId);

    // Fetch branch timezone if available
    const { data: branch } = await admin
      .from('branches')
      .select('timezone')
      .eq('id', input.branchId)
      .single();

    const branchTimezone = branch?.timezone || 'Asia/Colombo';
    const isStaffCreation = actorType === 'STAFF';
    const duration = input.durationMinutes || settings.defaultDurationMinutes;

    const startAt = new Date(input.reservationStartAt);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    // Canonical validation for ALL creation paths (staff + public)
    ReservationValidationService.validateReservationInput({
      partySize: input.partySize,
      reservationStartAt: startAt.toISOString(),
      reservationEndAt: endAt.toISOString(),
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      settings,
      isStaffCreation,
      branchTimezone,
    });

    // Resolve or link CRM customer identity while preserving local snapshot
    let crmCustomerId: string | null = input.crmCustomerId || null;
    if (!crmCustomerId && (actorUserId || input.guestEmail || input.guestPhone)) {
      try {
        const crmIdentity = await CustomerIdentityService.resolveOrCreateCustomerIdentity({
          businessId: input.businessId,
          authUserId: actorType === 'CUSTOMER' ? actorUserId : null,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
        });
        if (crmIdentity) {
          crmCustomerId = crmIdentity.id;
        }
      } catch (err: unknown) {
        console.warn('[ReservationService] CRM identity resolution skipped safely:', (err as Error).message);
      }
    }

    const confirmationCode = this.generateConfirmationCode();
    const reservationDate = ReservationValidationService.deriveBranchReservationDate(startAt.toISOString(), branchTimezone);

    let initialStatus: ReservationStatus = 'PENDING';
    if (isStaffCreation) {
      initialStatus = 'CONFIRMED';
    } else if (settings.autoConfirm) {
      initialStatus = 'CONFIRMED';
    }

    const payload = {
      business_id: input.businessId,
      branch_id: input.branchId,
      crm_customer_id: crmCustomerId,
      created_by_user_id: actorUserId || null,
      created_by_source: input.source || (isStaffCreation ? 'STAFF' : 'PUBLIC_WEB'),
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail ? input.guestEmail.trim().toLowerCase() : null,
      guest_phone: input.guestPhone ? input.guestPhone.trim() : null,
      reservation_date: reservationDate,
      reservation_start_at: startAt.toISOString(),
      reservation_end_at: endAt.toISOString(),
      party_size: input.partySize,
      status: initialStatus,
      special_requests: input.specialRequests ? input.specialRequests.trim() : null,
      internal_notes: isStaffCreation && input.internalNotes ? input.internalNotes.trim() : null,
      occasion: input.occasion ? input.occasion.trim() : null,
      source: input.source || (isStaffCreation ? 'STAFF' : 'PUBLIC_WEB'),
      confirmation_code: confirmationCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await admin
      .from('reservations')
      .insert(payload)
      .select('*')
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create reservation: ${error?.message}`);
    }

    // Append initial creation event strictly AFTER successful DB row insertion
    await this.recordStatusEvent({
      reservationId: inserted.id,
      businessId: inserted.business_id,
      branchId: inserted.branch_id,
      fromStatus: null,
      toStatus: initialStatus,
      actorUserId: actorUserId || null,
      actorType,
      reason: `Reservation created (${inserted.source})`,
    });

    const fullDTO = await ReservationQueryService.getReservationById(
      inserted.business_id,
      inserted.id,
      null,
      true
    );

    if (!fullDTO) {
      throw new Error('Reservation creation succeeded but failed to load inserted DTO');
    }

    return fullDTO;
  }

  /**
   * Confirms a pending reservation.
   */
  static async confirmReservation(
    businessId: string,
    reservationId: string,
    actorUserId: string,
    actorType: StatusActorType = 'STAFF'
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'CONFIRMED',
      actorUserId,
      actorType,
      reason: 'Reservation confirmed by staff',
    });
  }

  /**
   * Cancels a reservation with an optional audit reason.
   */
  static async cancelReservation(
    businessId: string,
    reservationId: string,
    actorUserId: string | null,
    actorType: StatusActorType,
    reason?: string | null
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'CANCELLED',
      actorUserId,
      actorType,
      reason: reason || 'Reservation cancelled',
      timestampField: 'cancelled_at',
      cancellationReason: reason,
    });
  }

  /**
   * Marks guest arrival.
   */
  static async markArrived(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'ARRIVED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Guest arrived at venue',
      timestampField: 'arrived_at',
    });
  }

  /**
   * Marks guest seated.
   */
  static async markSeated(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'SEATED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Party seated at dining area',
      timestampField: 'seated_at',
    });
  }

  /**
   * Marks reservation completed.
   */
  static async markCompleted(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'COMPLETED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Dining experience completed',
      timestampField: 'completed_at',
    });
  }

  /**
   * Marks reservation as No-Show.
   */
  static async markNoShow(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    return this.transitionStatus({
      businessId,
      reservationId,
      targetStatus: 'NO_SHOW',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Guest did not arrive',
      timestampField: 'no_show_at',
    });
  }

  /**
   * Fetches status audit event trail for a reservation.
   */
  static async getStatusHistory(
    businessId: string,
    reservationId: string
  ): Promise<ReservationStatusEventDTO[]> {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from('reservation_status_events')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (error || !rows) return [];

    return rows.map((e) => ({
      id: e.id,
      reservationId: e.reservation_id,
      businessId: e.business_id,
      branchId: e.branch_id,
      fromStatus: e.from_status as ReservationStatus | null,
      toStatus: e.to_status as ReservationStatus,
      actorUserId: e.actor_user_id || null,
      actorType: e.actor_type as StatusActorType,
      reason: e.reason || null,
      createdAt: e.created_at,
    }));
  }

  /**
   * Maps a full ReservationDTO to a sanitized PublicReservationDTO.
   */
  static toPublicDTO(dto: ReservationDTO): PublicReservationDTO {
    return {
      reservationId: dto.id,
      confirmationCode: dto.confirmationCode,
      status: dto.status,
      branchId: dto.branchId,
      reservationDate: dto.reservationDate,
      reservationStartAt: dto.reservationStartAt,
      reservationEndAt: dto.reservationEndAt,
      partySize: dto.partySize,
      guestName: dto.guestName,
      specialRequests: dto.specialRequests,
      occasion: dto.occasion,
      createdAt: dto.createdAt,
    };
  }

  /**
   * Generic status transition helper with optimistic concurrency & same-state checks.
   */
  private static async transitionStatus(options: {
    businessId: string;
    reservationId: string;
    targetStatus: ReservationStatus;
    actorUserId: string | null;
    actorType: StatusActorType;
    reason: string;
    timestampField?: 'arrived_at' | 'seated_at' | 'completed_at' | 'no_show_at' | 'cancelled_at';
    cancellationReason?: string | null;
  }): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const { businessId, reservationId, targetStatus, actorUserId, actorType, reason, timestampField, cancellationReason } = options;

    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) {
      const err = new Error('Reservation not found.');
      (err as unknown as { code: string }).code = 'NOT_FOUND';
      throw err;
    }

    // 1. Validate status machine (throws SAME_STATE_TRANSITION or ILLEGAL_RESERVATION_TRANSITION if invalid)
    ReservationLifecycleService.validateTransition(existing.status, targetStatus);

    // 1b. SEATED Guard (Part L): Require active table assignment before seating
    if (targetStatus === 'SEATED') {
      const { ReservationAllocationService } = await import('./reservation-allocation.service');
      const activeAssignments = await ReservationAllocationService.getActiveAssignments(businessId, reservationId);
      if (!activeAssignments || activeAssignments.length === 0) {
        const err = new Error('Assign a table before seating this reservation.');
        (err as unknown as { code: string }).code = 'INVALID_INPUT';
        throw err;
      }
    }

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updated_at: nowIso,
    };

    if (timestampField) {
      updatePayload[timestampField] = nowIso;
    }
    if (targetStatus === 'CANCELLED') {
      updatePayload.cancelled_by_user_id = actorUserId || null;
      if (cancellationReason !== undefined) {
        updatePayload.cancellation_reason = cancellationReason ? cancellationReason.trim() : null;
      }
    }

    // 2. Concurrency-resistant update checking existing.status
    const { data: updatedRows, error } = await admin
      .from('reservations')
      .update(updatePayload)
      .eq('id', reservationId)
      .eq('business_id', businessId)
      .eq('status', existing.status) // Optimistic concurrency check
      .select('id');

    if (error || !updatedRows || updatedRows.length === 0) {
      const err = new Error(`Reservation status transition to '${targetStatus}' could not be applied. State may have changed.`);
      (err as unknown as { code: string }).code = 'CONCURRENCY_CONFLICT';
      throw err;
    }

    // 2b. Auto Release Tables (Part K): Release assignments on terminal / departure transitions
    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(targetStatus)) {
      try {
        const { ReservationAllocationService } = await import('./reservation-allocation.service');
        await ReservationAllocationService.releaseReservationTables(businessId, reservationId);
      } catch (relErr: unknown) {
        console.warn('[ReservationService] Auto-release tables failed:', (relErr as Error).message);
      }
    }

    // 3. Record append-only audit event strictly AFTER successful mutation
    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: targetStatus,
      actorUserId,
      actorType,
      reason,
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
  }

  /**
   * Appends a status event record to reservation_status_events.
   */
  private static async recordStatusEvent(event: {
    reservationId: string;
    businessId: string;
    branchId: string;
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    actorUserId: string | null;
    actorType: StatusActorType;
    reason: string | null;
  }): Promise<void> {
    const admin = createAdminClient();
    await admin.from('reservation_status_events').insert({
      reservation_id: event.reservationId,
      business_id: event.businessId,
      branch_id: event.branchId,
      from_status: event.fromStatus,
      to_status: event.toStatus,
      actor_user_id: event.actorUserId || null,
      actor_type: event.actorType,
      reason: event.reason,
      created_at: new Date().toISOString(),
    });
  }
}

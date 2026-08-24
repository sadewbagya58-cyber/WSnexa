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

    const isStaffCreation = actorType === 'STAFF';
    const duration = input.durationMinutes || settings.defaultDurationMinutes;

    const startAt = new Date(input.reservationStartAt);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    ReservationValidationService.validateReservationInput({
      partySize: input.partySize,
      reservationStartAt: startAt.toISOString(),
      reservationEndAt: endAt.toISOString(),
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      settings,
      isStaffCreation,
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
    const reservationDate = startAt.toISOString().split('T')[0];

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

    // Append initial creation event
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
    const admin = createAdminClient();
    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) {
      throw new Error('Reservation not found');
    }

    ReservationLifecycleService.validateTransition(existing.status, 'CANCELLED');

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: 'CANCELLED',
        cancelled_at: nowIso,
        cancelled_by_user_id: actorUserId || null,
        cancellation_reason: reason ? reason.trim() : null,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to cancel reservation: ${error.message}`);
    }

    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: 'CANCELLED',
      actorUserId,
      actorType,
      reason: reason || 'Reservation cancelled',
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
  }

  /**
   * Marks guest arrival.
   */
  static async markArrived(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) throw new Error('Reservation not found');

    ReservationLifecycleService.validateTransition(existing.status, 'ARRIVED');

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: 'ARRIVED',
        arrived_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to mark arrival: ${error.message}`);

    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: 'ARRIVED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Guest arrived at venue',
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
  }

  /**
   * Marks guest seated.
   */
  static async markSeated(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) throw new Error('Reservation not found');

    ReservationLifecycleService.validateTransition(existing.status, 'SEATED');

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: 'SEATED',
        seated_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to mark seated: ${error.message}`);

    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: 'SEATED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Party seated at dining area',
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
  }

  /**
   * Marks reservation completed.
   */
  static async markCompleted(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) throw new Error('Reservation not found');

    ReservationLifecycleService.validateTransition(existing.status, 'COMPLETED');

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: 'COMPLETED',
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to mark completed: ${error.message}`);

    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: 'COMPLETED',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Dining experience completed',
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
  }

  /**
   * Marks reservation as No-Show.
   */
  static async markNoShow(
    businessId: string,
    reservationId: string,
    actorUserId: string
  ): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) throw new Error('Reservation not found');

    ReservationLifecycleService.validateTransition(existing.status, 'NO_SHOW');

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: 'NO_SHOW',
        no_show_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to mark no-show: ${error.message}`);

    await this.recordStatusEvent({
      reservationId,
      businessId,
      branchId: existing.branchId,
      fromStatus: existing.status,
      toStatus: 'NO_SHOW',
      actorUserId,
      actorType: 'STAFF',
      reason: 'Guest did not arrive',
    });

    const updated = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    return updated!;
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
   * Generic status transition helper.
   */
  private static async transitionStatus(options: {
    businessId: string;
    reservationId: string;
    targetStatus: ReservationStatus;
    actorUserId: string | null;
    actorType: StatusActorType;
    reason: string;
  }): Promise<ReservationDTO> {
    const admin = createAdminClient();
    const { businessId, reservationId, targetStatus, actorUserId, actorType, reason } = options;

    const existing = await ReservationQueryService.getReservationById(businessId, reservationId, null, true);
    if (!existing) throw new Error('Reservation not found');

    ReservationLifecycleService.validateTransition(existing.status, targetStatus);

    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from('reservations')
      .update({
        status: targetStatus,
        updated_at: nowIso,
      })
      .eq('id', reservationId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to update reservation status: ${error.message}`);
    }

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

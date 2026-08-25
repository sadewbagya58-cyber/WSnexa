import { createAdminClient } from '@/lib/supabase/server';

export type ReservationNotificationEventType =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_DECLINED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_REMINDER_DUE'
  | 'RESERVATION_ARRIVED'
  | 'RESERVATION_SEATED'
  | 'RESERVATION_COMPLETED'
  | 'WAITLIST_PROMOTED';

export interface QueueNotificationParams {
  businessId: string;
  branchId: string;
  reservationId?: string | null;
  eventType: ReservationNotificationEventType;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  consentPromotional?: boolean;
  payload?: Record<string, unknown>;
}

export class ReservationNotificationService {
  /**
   * Queues a provider-neutral reservation notification event into the outbox.
   * Distinguishes operational messages (always eligible under booking contact policy)
   * from marketing messages (which strictly require consentPromotional = true).
   */
  static async queueNotificationEvent(params: QueueNotificationParams): Promise<void> {
    const admin = createAdminClient();

    const isMarketing = false; // Reservation status notices are operational
    const channelEligibility = {
      email: !!params.recipientEmail,
      sms: !!params.recipientPhone,
      operationalPolicy: true,
      marketingConsentGranted: params.consentPromotional || false,
    };

    // Skip marketing messages if explicit promotional consent was omitted
    if (isMarketing && !params.consentPromotional) {
      console.log(`[NotificationService] Skipping marketing event ${params.eventType} - promotional consent omitted.`);
      return;
    }

    try {
      await admin.from('reservation_notification_outbox').insert({
        business_id: params.businessId,
        branch_id: params.branchId,
        reservation_id: params.reservationId || null,
        event_type: params.eventType,
        recipient_name: params.recipientName || null,
        recipient_email: params.recipientEmail || null,
        recipient_phone: params.recipientPhone || null,
        consent_promotional: params.consentPromotional || false,
        channel_eligibility: channelEligibility,
        payload: params.payload || {},
        status: 'PENDING',
      });
    } catch (err: unknown) {
      console.warn('[ReservationNotificationService] Failed to queue outbox event:', (err as Error).message);
    }
  }

  /**
   * Evaluates reminder eligibility for a reservation.
   * Only CONFIRMED reservations starting in the future are eligible.
   */
  static isEligibleForReminder(reservation: {
    status: string;
    reservationStartAt: string;
  }): boolean {
    if (reservation.status !== 'CONFIRMED') return false;
    const startMs = new Date(reservation.reservationStartAt).getTime();
    return startMs > Date.now();
  }
}

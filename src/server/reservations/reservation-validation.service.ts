import { ReservationSettingsDTO, ReservationValidationIntent } from '@/lib/reservations/reservation-types';

export function createDomainError(message: string, code: string): Error {
  const err = new Error(message);
  (err as unknown as { code: string }).code = code;
  return err;
}

export class ReservationValidationService {
  /**
   * Helper to derive branch-local reservation date (YYYY-MM-DD) from UTC timestamp and branch timezone.
   */
  static deriveBranchReservationDate(isoTimestamp: string, branchTimezone: string = 'Asia/Colombo'): string {
    const d = new Date(isoTimestamp);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: branchTimezone || 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(d); // Returns 'YYYY-MM-DD'
    } catch {
      return d.toISOString().split('T')[0];
    }
  }

  /**
   * Validates reservation parameters against branch settings and intent-aware time rules.
   */
  static validateReservationInput(options: {
    partySize: number;
    reservationStartAt: string; // ISO string
    reservationEndAt: string;   // ISO string
    guestName: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    settings: ReservationSettingsDTO;
    isStaffCreation?: boolean;
    intent?: ReservationValidationIntent;
    branchTimezone?: string;
  }): void {
    const {
      partySize,
      reservationStartAt,
      reservationEndAt,
      guestName,
      guestEmail,
      guestPhone,
      settings,
      isStaffCreation = false,
      intent,
      branchTimezone = 'Asia/Colombo',
    } = options;

    const validationIntent: ReservationValidationIntent =
      intent || (isStaffCreation ? 'FUTURE_STAFF_RESERVATION' : 'PUBLIC_RESERVATION');

    if (!settings.reservationsEnabled && validationIntent === 'PUBLIC_RESERVATION') {
      throw createDomainError('Reservations are currently disabled for this venue/branch.', 'RESERVATIONS_DISABLED');
    }

    if (partySize < settings.minimumPartySize || partySize > settings.maximumPartySize) {
      throw createDomainError(
        `Party size must be between ${settings.minimumPartySize} and ${settings.maximumPartySize}.`,
        'INVALID_PARTY_SIZE'
      );
    }

    const start = new Date(reservationStartAt);
    const end = new Date(reservationEndAt);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw createDomainError('Invalid reservation timestamp provided.', 'INVALID_INPUT');
    }

    if (end <= start) {
      throw createDomainError('Reservation end time must be strictly after start time.', 'INVALID_INPUT');
    }

    // MANDATORY FOR FUTURE BOOKINGS (STAFF AND PUBLIC):
    // Start time MUST be in the future relative to server "now"
    // NOT APPLIED to immediate operational seating flows (WALK_IN_SEATING & WAITLIST_PROMOTION)
    const isImmediateSeating =
      validationIntent === 'WALK_IN_SEATING' || validationIntent === 'WAITLIST_PROMOTION';

    if (!isImmediateSeating && start.getTime() <= now.getTime()) {
      throw createDomainError('Reservation time must be in the future.', 'PAST_RESERVATION_TIME');
    }

    // Public customer creation advance booking bounds
    if (validationIntent === 'PUBLIC_RESERVATION') {
      const minAdvanceMs = settings.minimumAdvanceMinutes * 60 * 1000;
      if (start.getTime() < now.getTime() + minAdvanceMs) {
        throw createDomainError(
          `Reservation must be booked at least ${settings.minimumAdvanceMinutes} minutes in advance.`,
          'MINIMUM_ADVANCE_TIME'
        );
      }

      const maxAdvanceMs = settings.maximumAdvanceDays * 24 * 60 * 60 * 1000;
      if (start.getTime() > now.getTime() + maxAdvanceMs) {
        throw createDomainError(
          `Reservation cannot be booked more than ${settings.maximumAdvanceDays} days in advance.`,
          'MAXIMUM_ADVANCE_TIME'
        );
      }

      const localNowDate = this.deriveBranchReservationDate(now.toISOString(), branchTimezone);
      const localStartDate = this.deriveBranchReservationDate(start.toISOString(), branchTimezone);
      const isSameDay = localNowDate === localStartDate;

      if (isSameDay && !settings.allowSameDay) {
        throw createDomainError('Same-day reservations are not accepted at this branch.', 'SAME_DAY_DISABLED');
      }

      if (settings.requireGuestEmail && (!guestEmail || !guestEmail.trim())) {
        throw createDomainError('Guest email address is required by branch policy.', 'REQUIRED_CONTACT_MISSING');
      }

      if (settings.requireGuestPhone && (!guestPhone || !guestPhone.trim())) {
        throw createDomainError('Guest phone number is required by branch policy.', 'REQUIRED_CONTACT_MISSING');
      }
    }

    if (!guestName || guestName.trim().length < 2) {
      throw createDomainError('Guest name is required and must be at least 2 characters.', 'INVALID_INPUT');
    }
  }
}

import { ReservationSettingsDTO } from '@/lib/reservations/reservation-types';

export class ReservationValidationService {
  /**
   * Validates reservation parameters against branch settings and time rules.
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
    } = options;

    if (!settings.reservationsEnabled && !isStaffCreation) {
      throw new Error('Reservations are currently disabled for this venue/branch');
    }

    if (partySize < settings.minimumPartySize) {
      throw new Error(`Party size (${partySize}) is below minimum allowed (${settings.minimumPartySize})`);
    }

    if (partySize > settings.maximumPartySize) {
      throw new Error(`Party size (${partySize}) exceeds maximum allowed (${settings.maximumPartySize})`);
    }

    const start = new Date(reservationStartAt);
    const end = new Date(reservationEndAt);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid reservation timestamp provided');
    }

    if (end <= start) {
      throw new Error('Reservation end time must be strictly after start time');
    }

    // Unless created by staff (e.g. walk-in recording), enforce advance booking bounds
    if (!isStaffCreation) {
      const minAdvanceMs = settings.minimumAdvanceMinutes * 60 * 1000;
      if (start.getTime() < now.getTime() + minAdvanceMs) {
        throw new Error(`Reservation must be booked at least ${settings.minimumAdvanceMinutes} minutes in advance`);
      }

      const maxAdvanceMs = settings.maximumAdvanceDays * 24 * 60 * 60 * 1000;
      if (start.getTime() > now.getTime() + maxAdvanceMs) {
        throw new Error(`Reservation cannot be booked more than ${settings.maximumAdvanceDays} days in advance`);
      }

      const isSameDay = start.toDateString() === now.toDateString();
      if (isSameDay && !settings.allowSameDay) {
        throw new Error('Same-day reservations are not accepted at this branch');
      }
    }

    if (!guestName || guestName.trim().length < 2) {
      throw new Error('Guest name is required and must be at least 2 characters');
    }

    if (settings.requireGuestEmail && (!guestEmail || !guestEmail.trim())) {
      throw new Error('Guest email address is required by branch policy');
    }

    if (settings.requireGuestPhone && (!guestPhone || !guestPhone.trim())) {
      throw new Error('Guest phone number is required by branch policy');
    }
  }
}

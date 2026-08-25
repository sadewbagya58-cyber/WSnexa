import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { ReservationSettingsService } from '@/server/reservations/reservation-settings.service';
import { ReservationAvailabilityService } from '@/server/reservations/reservation-availability.service';
import { ReservationService } from '@/server/reservations/reservation.service';
import { CustomerIdentityService } from '@/server/crm/customer-identity.service';
import { createDomainError } from '@/server/reservations/reservation-validation.service';
import {
  PublicBookingInput,
  PublicBookingResultDTO,
  TimeSlotDTO,
} from '@/lib/reservations/reservation-types';

export class PublicReservationService {
  /**
   * Generates bookable public time slots for a venue/branch, date, and party size.
   * Evaluates branch operational rules and capacity via ReservationAvailabilityService.
   */
  static async getPublicAvailableSlots(params: {
    venueSlug: string;
    branchId?: string | null;
    reservationDate: string; // YYYY-MM-DD
    partySize: number;
  }): Promise<TimeSlotDTO[]> {
    const venue = await VenueDiscoveryService.getVenueBySlug(params.venueSlug);
    if (!venue) return [];

    const branchId = params.branchId || venue.featured_branch_id;
    if (!branchId) return [];

    const settings = await ReservationSettingsService.getBranchSettings(venue.business_id, branchId);
    if (!settings.reservationsEnabled) return [];

    if (params.partySize < settings.minimumPartySize || params.partySize > settings.maximumPartySize) {
      return [];
    }

    const now = new Date();
    const dateObj = new Date(params.reservationDate + 'T00:00:00.000Z');
    if (isNaN(dateObj.getTime())) return [];

    // Check same-day policy
    const todayStr = now.toISOString().split('T')[0];
    if (!settings.allowSameDay && params.reservationDate === todayStr) {
      return [];
    }

    // Check max advance days
    const maxAdvanceMs = settings.maximumAdvanceDays * 24 * 60 * 60 * 1000;
    if (dateObj.getTime() > now.getTime() + maxAdvanceMs) {
      return [];
    }

    const durationMinutes = settings.defaultDurationMinutes || 90;
    const slots: TimeSlotDTO[] = [];

    // Generate slots from 09:00 to 22:00 at 30-minute intervals
    for (let hour = 9; hour <= 21; hour++) {
      for (const min of [0, 30]) {
        const hourStr = hour.toString().padStart(2, '0');
        const minStr = min.toString().padStart(2, '0');
        const timeStr = `${hourStr}:${minStr}`;

        // Construct ISO start timestamp
        const startAtIso = new Date(
          `${params.reservationDate}T${hourStr}:${minStr}:00.000Z`
        ).toISOString();
        const startAtMs = new Date(startAtIso).getTime();

        // Enforce minimum advance minutes
        const minAdvanceMs = settings.minimumAdvanceMinutes * 60 * 1000;
        if (startAtMs < now.getTime() + minAdvanceMs) {
          continue;
        }

        const endAtIso = new Date(startAtMs + durationMinutes * 60 * 1000).toISOString();

        // Check actual dining table capacity & overlap
        const availability = await ReservationAvailabilityService.getAvailability({
          businessId: venue.business_id,
          branchId,
          partySize: params.partySize,
          reservationStartAt: startAtIso,
          reservationEndAt: endAtIso,
        });

        const isAvailable =
          availability.availableTables.length > 0 ||
          availability.recommendedSingleTable !== null ||
          availability.recommendedCombination !== null;

        // Format 12-hour display time (e.g. 6:00 PM)
        const hourNum = parseInt(hourStr, 10);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
        const displayTime = `${displayHour}:${minStr} ${ampm}`;

        slots.push({
          time: timeStr,
          displayTime,
          startAt: startAtIso,
          endAt: endAtIso,
          available: isAvailable,
          reason: isAvailable ? undefined : 'Capacity unavailable',
        });
      }
    }

    return slots;
  }

  /**
   * Processes a public guest booking.
   * Re-evaluates slot capacity for race protection before final DB insertion.
   */
  static async createPublicBooking(
    input: PublicBookingInput,
    actorUserId?: string | null
  ): Promise<PublicBookingResultDTO> {
    const venue = await VenueDiscoveryService.getVenueBySlug(input.venueSlug);
    if (!venue) {
      throw createDomainError('Venue not found.', 'NOT_FOUND');
    }

    const branchId = input.branchId || venue.featured_branch_id;
    if (!branchId) {
      throw createDomainError('No valid branch selected.', 'INVALID_INPUT');
    }

    const settings = await ReservationSettingsService.getBranchSettings(venue.business_id, branchId);
    if (!settings.reservationsEnabled) {
      throw createDomainError('Reservations are currently disabled for this venue.', 'RESERVATIONS_DISABLED');
    }

    // Required contact validation
    if (settings.requireGuestPhone && !input.guestPhone) {
      throw createDomainError('Guest phone number is required for this venue.', 'REQUIRED_CONTACT_MISSING');
    }
    if (settings.requireGuestEmail && !input.guestEmail) {
      throw createDomainError('Guest email address is required for this venue.', 'REQUIRED_CONTACT_MISSING');
    }

    const durationMinutes = settings.defaultDurationMinutes || 90;
    const reqStartMs = new Date(input.reservationStartAt).getTime();
    const reqEndIso = new Date(reqStartMs + durationMinutes * 60 * 1000).toISOString();

    // RACE PROTECTION & CAPACITY REVALIDATION
    const availability = await ReservationAvailabilityService.getAvailability({
      businessId: venue.business_id,
      branchId,
      partySize: input.partySize,
      reservationStartAt: input.reservationStartAt,
      reservationEndAt: reqEndIso,
    });

    const isAvailable =
      availability.availableTables.length > 0 ||
      availability.recommendedSingleTable !== null ||
      availability.recommendedCombination !== null;

    if (!isAvailable) {
      throw createDomainError(
        'That time is no longer available. Please choose another time.',
        'SLOT_NO_LONGER_AVAILABLE'
      );
    }

    // Resolve CRM identity if email/phone provided
    let crmCustomerId: string | null = null;
    if (input.guestEmail || input.guestPhone) {
      try {
        const crmCustomer = await CustomerIdentityService.resolveOrCreateCustomerIdentity({
          businessId: venue.business_id,
          guestEmail: input.guestEmail || undefined,
          guestPhone: input.guestPhone || undefined,
          guestName: input.guestName,
          authUserId: actorUserId || undefined,
        });
        crmCustomerId = crmCustomer ? crmCustomer.id : null;
      } catch (err: unknown) {
        console.warn('[PublicReservationService] CRM identity resolution skipped:', (err as Error).message);
      }
    }

    const guestAccessToken = crypto.randomUUID();
    const initialStatus = settings.autoConfirm ? 'CONFIRMED' : 'PENDING';

    const reservation = await ReservationService.createReservation(
      {
        businessId: venue.business_id,
        branchId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        reservationStartAt: input.reservationStartAt,
        durationMinutes,
        partySize: input.partySize,
        specialRequests: input.specialRequests,
        occasion: input.occasion,
        source: actorUserId ? 'CUSTOMER_PORTAL' : 'PUBLIC_WEB',
        crmCustomerId,
        guestAccessToken,
        consentPromotional: !!input.consentPromotional,
        intent: 'PUBLIC_RESERVATION',
        initialStatus,
      },
      actorUserId || null,
      actorUserId ? 'CUSTOMER' : 'SYSTEM'
    );

    // Fetch branch name for response
    const admin = createAdminClient();
    const { data: branch } = await admin
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();

    return {
      reservationId: reservation.id,
      confirmationCode: reservation.confirmationCode,
      guestAccessToken,
      status: reservation.status,
      venueName: venue.display_name,
      venueSlug: venue.slug,
      branchName: branch?.name || venue.display_name,
      branchId,
      reservationDate: reservation.reservationDate,
      reservationStartAt: reservation.reservationStartAt,
      reservationEndAt: reservation.reservationEndAt,
      partySize: reservation.partySize,
      guestName: reservation.guestName,
      occasion: reservation.occasion,
      specialRequests: reservation.specialRequests,
    };
  }

  /**
   * Retrieves guest booking details by confirmation code + guestAccessToken (or matching user identity).
   */
  static async getGuestBookingDetail(params: {
    confirmationCode: string;
    token?: string | null;
    actorUserId?: string | null;
  }): Promise<PublicBookingResultDTO> {
    const admin = createAdminClient();

    const { data: res, error } = await admin
      .from('reservations')
      .select('*')
      .eq('confirmation_code', params.confirmationCode.toUpperCase())
      .single();

    if (error || !res) {
      throw createDomainError('Reservation not found.', 'RESERVATION_NOT_FOUND');
    }

    // Ownership Verification
    let authorized = false;
    if (params.token && res.guest_access_token === params.token) {
      authorized = true;
    } else if (params.actorUserId && res.created_by_user_id === params.actorUserId) {
      authorized = true;
    }

    if (!authorized) {
      throw createDomainError('Unauthorized to view this reservation.', 'UNAUTHORIZED');
    }

    const { data: venue } = await admin
      .from('businesses')
      .select('name, slug')
      .eq('id', res.business_id)
      .single();

    const { data: branch } = await admin
      .from('branches')
      .select('name')
      .eq('id', res.branch_id)
      .single();

    return {
      reservationId: res.id,
      confirmationCode: res.confirmation_code,
      guestAccessToken: res.guest_access_token || '',
      status: res.status,
      venueName: venue?.name || 'Venue',
      venueSlug: venue?.slug || '',
      branchName: branch?.name || 'Branch',
      branchId: res.branch_id,
      reservationDate: res.reservation_date,
      reservationStartAt: res.reservation_start_at,
      reservationEndAt: res.reservation_end_at,
      partySize: res.party_size,
      guestName: res.guest_name,
      occasion: res.occasion || null,
      specialRequests: res.special_requests || null,
    };
  }
}

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
   * Uses bounded batch queries (3 total) and evaluates capacity in memory to avoid N+1 query loops.
   * Wraps calculation in a hard 8-second timeout for server responsiveness.
   */
  static async getPublicAvailableSlots(params: {
    venueSlug: string;
    branchId?: string | null;
    reservationDate: string; // YYYY-MM-DD
    partySize: number;
  }): Promise<TimeSlotDTO[]> {
    const timeoutMs = 8000;
    const timeoutPromise = new Promise<TimeSlotDTO[]>((_, reject) => {
      setTimeout(() => {
        reject(
          createDomainError(
            'We couldn\'t load available times. Please try again.',
            'AVAILABILITY_TIMEOUT'
          )
        );
      }, timeoutMs);
    });

    return Promise.race([
      this.computePublicAvailableSlotsInternal(params),
      timeoutPromise,
    ]);
  }

  private static async computePublicAvailableSlotsInternal(params: {
    venueSlug: string;
    branchId?: string | null;
    reservationDate: string;
    partySize: number;
  }): Promise<TimeSlotDTO[]> {
    const venue = await VenueDiscoveryService.getVenueBySlug(params.venueSlug);
    if (!venue || !venue.featured_branch_id) return [];

    // Lock to published branch strictly
    const branchId = venue.featured_branch_id;
    const settings = await ReservationSettingsService.getBranchSettings(venue.business_id, branchId);
    if (!settings.reservationsEnabled || (venue as { public_reservations_enabled?: boolean }).public_reservations_enabled === false) return [];

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

    const admin = createAdminClient();

    // BATCH QUERY 1: Fetch candidate tables for business & branch
    const { data: rawTables, error: tableErr } = await admin
      .from('dining_tables')
      .select('id, business_id, branch_id, service_area_id, name, capacity, min_capacity, reservations_enabled, status, is_active')
      .eq('business_id', venue.business_id)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('capacity', { ascending: true })
      .order('display_order', { ascending: true });

    if (tableErr || !rawTables) return [];

    const candidateTables = rawTables.map((t) => ({
      id: t.id,
      businessId: t.business_id,
      branchId: t.branch_id,
      serviceAreaId: t.service_area_id,
      name: t.name,
      code: '',
      tableNumber: 0,
      capacity: t.capacity || 4,
      minCapacity: t.min_capacity || 1,
      reservationsEnabled: t.reservations_enabled !== false,
      status: t.status,
      isActive: t.is_active,
    }));

    const reservableTables = candidateTables.filter((t) => t.reservationsEnabled);
    if (reservableTables.length === 0) return [];

    // BATCH QUERY 2: Fetch active (unreleased) table assignments
    const { data: activeAssignments } = await admin
      .from('reservation_table_assignments')
      .select('table_id, reservation_id')
      .eq('business_id', venue.business_id)
      .eq('branch_id', branchId)
      .is('released_at', null);

    const assignments = activeAssignments || [];
    const activeResIds = Array.from(new Set(assignments.map((a) => a.reservation_id)));

    // BATCH QUERY 3: Fetch all blocking reservations for requested date window
    const dayStartIso = `${params.reservationDate}T00:00:00.000Z`;
    const dayEndIso = `${params.reservationDate}T23:59:59.999Z`;
    const blockingStatuses = ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'];

    let blockingReservations: Array<{ id: string; reservation_start_at: string; reservation_end_at: string }> = [];

    if (activeResIds.length > 0) {
      const { data: resData } = await admin
        .from('reservations')
        .select('id, reservation_start_at, reservation_end_at')
        .eq('business_id', venue.business_id)
        .eq('branch_id', branchId)
        .in('id', activeResIds)
        .in('status', blockingStatuses)
        .lt('reservation_start_at', dayEndIso)
        .gt('reservation_end_at', dayStartIso);

      blockingReservations = resData || [];
    }

    const durationMinutes = settings.defaultDurationMinutes || 90;
    const bufferMinutes = settings.tableTurnoverBufferMinutes || 15;
    const maxCombinations = settings.maxTableCombination || 3;
    const minAdvanceMs = settings.minimumAdvanceMinutes * 60 * 1000;

    const slots: TimeSlotDTO[] = [];

    // IN-MEMORY SLOT GENERATION (09:00 to 22:00 at 30-minute intervals)
    for (let hour = 9; hour <= 21; hour++) {
      for (const min of [0, 30]) {
        const hourStr = hour.toString().padStart(2, '0');
        const minStr = min.toString().padStart(2, '0');
        const timeStr = `${hourStr}:${minStr}`;

        const startAtIso = `${params.reservationDate}T${hourStr}:${minStr}:00.000Z`;
        const startAtMs = new Date(startAtIso).getTime();

        if (startAtMs < now.getTime() + minAdvanceMs) {
          continue;
        }

        const endAtIso = new Date(startAtMs + durationMinutes * 60 * 1000).toISOString();
        const reqEndWithBufferMs = new Date(endAtIso).getTime() + bufferMinutes * 60 * 1000;

        // In-memory overlap evaluation
        const overlappingResIdSet = new Set(
          blockingReservations
            .filter((r) => {
              const rStart = new Date(r.reservation_start_at).getTime();
              const rEnd = new Date(r.reservation_end_at).getTime();
              return rStart < reqEndWithBufferMs && rEnd > startAtMs;
            })
            .map((r) => r.id)
        );

        const occupiedTableIdSet = new Set(
          assignments
            .filter((a) => overlappingResIdSet.has(a.reservation_id))
            .map((a) => a.table_id)
        );

        const availableTables = reservableTables.filter((t) => !occupiedTableIdSet.has(t.id));

        // Evaluate single table fit
        let recommendedSingleTable =
          availableTables.find((t) => params.partySize >= t.minCapacity && params.partySize <= t.capacity) || null;
        if (!recommendedSingleTable) {
          recommendedSingleTable = availableTables.find((t) => t.capacity >= params.partySize) || null;
        }

        // Evaluate multi-table combination if single table fit unavailable
        let recommendedCombination = null;
        if (!recommendedSingleTable && maxCombinations >= 2) {
          const combinations = ReservationAvailabilityService.computeMultiTableCombinations(
            availableTables,
            params.partySize,
            maxCombinations
          );
          recommendedCombination = combinations.length > 0 ? combinations[0] : null;
        }

        const isAvailable = recommendedSingleTable !== null || recommendedCombination !== null;

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
   * Derives and locks branch to published venue branch.
   */
  static async createPublicBooking(
    input: PublicBookingInput,
    actorUserId?: string | null
  ): Promise<PublicBookingResultDTO> {
    const venue = await VenueDiscoveryService.getVenueBySlug(input.venueSlug);
    if (!venue || !venue.featured_branch_id) {
      throw createDomainError('Venue not found or not published.', 'NOT_FOUND');
    }

    // Lock to published branch strictly
    const branchId = venue.featured_branch_id;
    if (!branchId) {
      throw createDomainError('No valid branch selected.', 'INVALID_INPUT');
    }

    const settings = await ReservationSettingsService.getBranchSettings(venue.business_id, branchId);
    if (!settings.reservationsEnabled || (venue as { public_reservations_enabled?: boolean }).public_reservations_enabled === false) {
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

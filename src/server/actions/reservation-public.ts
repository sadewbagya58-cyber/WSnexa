'use server';

import { createClient } from '@/lib/supabase/server';
import { PublicReservationService } from '@/server/reservations/public-reservation.service';
import { CustomerReservationService } from '@/server/reservations/customer-reservation.service';
import {
  publicBookingInputSchema,
  publicSlotQuerySchema,
  cancelReservationInputSchema,
} from '@/lib/validation/reservation';
import {
  CustomerReservationDetailDTO,
  PublicBookingInput,
  PublicBookingResultDTO,
  ReservationActionResult,
  ReservationErrorCode,
  TimeSlotDTO,
} from '@/lib/reservations/reservation-types';

async function handleAction<T>(fn: () => Promise<T>): Promise<ReservationActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const errObj = err as Record<string, unknown>;
      const code = (errObj.code as ReservationErrorCode) || 'INTERNAL_ERROR';
      let message = typeof errObj.message === 'string' ? errObj.message : 'Action failed.';
      if (
        message.includes('not-null constraint') ||
        message.includes('relation') ||
        message.includes('violates') ||
        message.includes('column')
      ) {
        message = 'Unable to complete reservation request.';
      }
      return { ok: false, error: { code, message } };
    }
    if (err instanceof Error) {
      let message = err.message;
      if (message.includes('Unauthorized') || message.includes('Forbidden')) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message } };
      }
      if (message.includes('not found') || message.includes('not found.')) {
        return { ok: false, error: { code: 'NOT_FOUND', message } };
      }
      if (
        message.includes('not-null constraint') ||
        message.includes('relation') ||
        message.includes('violates') ||
        message.includes('column')
      ) {
        message = 'Unable to complete reservation request.';
      }
      return { ok: false, error: { code: 'INVALID_INPUT', message } };
    }
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' } };
  }
}

/**
  * Action to query public bookable time slots for a venue, date, and party size.
  */
export async function getPublicAvailableSlotsAction(params: {
  venueSlug: string;
  branchId?: string | null;
  reservationDate: string;
  partySize: number;
}): Promise<ReservationActionResult<TimeSlotDTO[]>> {
  return handleAction(async () => {
    const validated = publicSlotQuerySchema.parse(params);
    return PublicReservationService.getPublicAvailableSlots(validated);
  });
}

/**
  * Action to submit a public guest table booking.
  */
export async function createPublicBookingAction(
  input: PublicBookingInput
): Promise<ReservationActionResult<PublicBookingResultDTO>> {
  return handleAction(async () => {
    const validated = publicBookingInputSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return PublicReservationService.createPublicBooking(validated, user?.id || null);
  });
}

/**
  * Action to retrieve guest reservation booking details with access token security.
  */
export async function getGuestReservationDetailAction(params: {
  confirmationCode: string;
  token?: string | null;
}): Promise<ReservationActionResult<PublicBookingResultDTO>> {
  return handleAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return PublicReservationService.getGuestBookingDetail({
      confirmationCode: params.confirmationCode,
      token: params.token,
      actorUserId: user?.id || null,
    });
  });
}

/**
  * Action to fetch reservations for the logged-in customer portal user.
  */
export async function getCustomerReservationsAction(): Promise<
  ReservationActionResult<CustomerReservationDetailDTO[]>
> {
  return handleAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized: Please log in to view your reservations.');
    }

    return CustomerReservationService.getCustomerReservations(user.id);
  });
}

/**
  * Action to cancel a customer or guest reservation.
  */
export async function cancelCustomerReservationAction(params: {
  reservationId: string;
  guestAccessToken?: string | null;
  reason?: string | null;
}): Promise<ReservationActionResult<CustomerReservationDetailDTO>> {
  return handleAction(async () => {
    const validated = cancelReservationInputSchema.parse(params);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return CustomerReservationService.cancelCustomerReservation({
      reservationId: validated.reservationId,
      userId: user?.id || null,
      guestAccessToken: validated.guestAccessToken,
      reason: validated.reason,
    });
  });
}

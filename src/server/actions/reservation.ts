'use server';

import { can, resolveAuthorizationContext } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { ReservationService } from '@/server/reservations/reservation.service';
import { ReservationQueryService } from '@/server/reservations/reservation-query.service';
import { ReservationSettingsService } from '@/server/reservations/reservation-settings.service';
import {
  CancelReservationInput,
  CreatePublicReservationInput,
  CreateReservationInput,
  ListReservationsFilter,
  PaginatedReservationsDTO,
  PublicReservationDTO,
  ReservationActionResult,
  ReservationDTO,
  ReservationErrorCode,
  ReservationSettingsDTO,
  ReservationStatusEventDTO,
} from '@/lib/reservations/reservation-types';
import {
  cancelReservationInputSchema,
  createPublicReservationInputSchema,
  createReservationInputSchema,
  reservationSettingsInputSchema,
} from '@/lib/validation/reservation';

/**
 * Universal safe server action execution wrapper for reservation operations.
 * Prevents internal raw database / RSC errors from leaking across the RSC boundary.
 */
async function handleAction<T>(fn: () => Promise<T>): Promise<ReservationActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const errObj = err as Record<string, unknown>;
      const code = (errObj.code as ReservationErrorCode) || 'INTERNAL_ERROR';
      const message = typeof errObj.message === 'string' ? errObj.message : 'Reservation action failed.';
      return { ok: false, error: { code, message } };
    }
    if (err instanceof Error) {
      const message = err.message;
      if (message.includes('Unauthorized') || message.includes('Forbidden')) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message } };
      }
      if (message.includes('not found') || message.includes('outside your authorized property scope')) {
        return {
          ok: false,
          error: {
            code: 'FORBIDDEN_SCOPE',
            message: 'Reservation was not found or is outside your authorized property scope.',
          },
        };
      }
      if (message.includes('Party size')) {
        return { ok: false, error: { code: 'INVALID_PARTY_SIZE', message } };
      }
      if (message.includes('in the future')) {
        return { ok: false, error: { code: 'PAST_RESERVATION_TIME', message } };
      }
      if (message.includes('already marked as')) {
        return { ok: false, error: { code: 'SAME_STATE_TRANSITION', message } };
      }
      if (message.includes('cannot move from')) {
        return { ok: false, error: { code: 'ILLEGAL_RESERVATION_TRANSITION', message } };
      }
      if (message.includes('booked at least')) {
        return { ok: false, error: { code: 'MINIMUM_ADVANCE_TIME', message } };
      }
      if (message.includes('booked more than')) {
        return { ok: false, error: { code: 'MAXIMUM_ADVANCE_TIME', message } };
      }
      if (message.includes('Same-day reservations')) {
        return { ok: false, error: { code: 'SAME_DAY_DISABLED', message } };
      }
      if (message.includes('disabled for this venue/branch')) {
        return { ok: false, error: { code: 'RESERVATIONS_DISABLED', message } };
      }
      if (message.includes('required by branch policy')) {
        return { ok: false, error: { code: 'REQUIRED_CONTACT_MISSING', message } };
      }
      return { ok: false, error: { code: 'INVALID_INPUT', message } };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unable to complete reservation action.' },
    };
  }
}

/**
 * Staff-authenticated creation of a new table reservation.
 */
export async function createStaffReservationAction(
  input: CreateReservationInput
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (input.businessId !== authContext.businessId) {
      throw new Error('Forbidden: Business tenancy mismatch');
    }

    if (!(await can({ context: authContext, permission: 'reservations.create' }))) {
      throw new Error('Forbidden: missing reservations.create permission');
    }

    const validated = createReservationInputSchema.parse(input);

    return ReservationService.createReservation(
      validated,
      authContext.userId,
      'STAFF'
    );
  });
}

/**
 * Public / customer creation of a new table reservation request.
 * Resolves trusted business_id from venue/branch record to prevent client tampering.
 */
export async function createPublicReservationAction(
  input: CreatePublicReservationInput
): Promise<ReservationActionResult<PublicReservationDTO>> {
  return handleAction(async () => {
    const validated = createPublicReservationInputSchema.parse(input);
    const admin = createAdminClient();

    // Trusted resolution of business_id from branch
    const { data: branch, error } = await admin
      .from('branches')
      .select('id, business_id')
      .eq('id', validated.branchId)
      .single();

    if (error || !branch) {
      throw new Error('Invalid venue branch specified for reservation');
    }

    const reservation = await ReservationService.createReservation(
      {
        businessId: branch.business_id,
        branchId: branch.id,
        guestName: validated.guestName,
        guestEmail: validated.guestEmail,
        guestPhone: validated.guestPhone,
        reservationStartAt: validated.reservationStartAt,
        durationMinutes: validated.durationMinutes,
        partySize: validated.partySize,
        specialRequests: validated.specialRequests,
        occasion: validated.occasion,
        source: 'PUBLIC_WEB',
      },
      null,
      'CUSTOMER'
    );

    return ReservationService.toPublicDTO(reservation);
  });
}

/**
 * Staff-authenticated retrieval of a single reservation by ID.
 */
export async function getReservationByIdAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO | null>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Forbidden: missing reservations.view permission');
    }

    const hasContactView = await can({ context: authContext, permission: 'customers.contact_view' });

    return ReservationQueryService.getReservationById(
      authContext.businessId,
      reservationId,
      authContext.authorizedBranchIds,
      hasContactView
    );
  });
}

/**
 * Staff-authenticated list/query of reservations with property reach isolation.
 */
export async function listReservationsAction(
  filter: Omit<ListReservationsFilter, 'businessId' | 'authorizedBranchIds'>
): Promise<ReservationActionResult<PaginatedReservationsDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Forbidden: missing reservations.view permission');
    }

    const hasContactView = await can({ context: authContext, permission: 'customers.contact_view' });

    return ReservationQueryService.listReservations(
      {
        ...filter,
        businessId: authContext.businessId,
        authorizedBranchIds: authContext.authorizedBranchIds,
      },
      hasContactView
    );
  });
}

/**
 * Staff-authenticated confirmation of a pending reservation.
 */
export async function confirmReservationAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
      throw new Error('Forbidden: missing reservations.manage permission');
    }

    return ReservationService.confirmReservation(
      authContext.businessId,
      reservationId,
      authContext.userId,
      'STAFF'
    );
  });
}

/**
 * Staff-authenticated cancellation of a reservation.
 */
export async function cancelReservationAction(
  input: CancelReservationInput
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    const hasCancel = await can({ context: authContext, permission: 'reservations.cancel' });
    const hasManage = await can({ context: authContext, permission: 'reservations.manage' });

    if (!hasCancel && !hasManage) {
      throw new Error('Forbidden: missing reservations.cancel or reservations.manage permission');
    }

    const validated = cancelReservationInputSchema.parse(input);

    return ReservationService.cancelReservation(
      authContext.businessId,
      validated.reservationId,
      authContext.userId,
      'STAFF',
      validated.reason
    );
  });
}

/**
 * Staff-authenticated status update: Mark Guest Arrived.
 */
export async function markReservationArrivedAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
      throw new Error('Forbidden: missing reservations.manage permission');
    }

    return ReservationService.markArrived(authContext.businessId, reservationId, authContext.userId);
  });
}

/**
 * Staff-authenticated status update: Mark Party Seated.
 */
export async function markReservationSeatedAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
      throw new Error('Forbidden: missing reservations.manage permission');
    }

    return ReservationService.markSeated(authContext.businessId, reservationId, authContext.userId);
  });
}

/**
 * Staff-authenticated status update: Mark Experience Completed.
 */
export async function markReservationCompletedAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
      throw new Error('Forbidden: missing reservations.manage permission');
    }

    return ReservationService.markCompleted(authContext.businessId, reservationId, authContext.userId);
  });
}

/**
 * Staff-authenticated status update: Mark Reservation No-Show.
 */
export async function markReservationNoShowAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
      throw new Error('Forbidden: missing reservations.manage permission');
    }

    return ReservationService.markNoShow(authContext.businessId, reservationId, authContext.userId);
  });
}

/**
 * Staff-authenticated status audit event history retrieval.
 */
export async function getReservationStatusHistoryAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationStatusEventDTO[]>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Forbidden: missing reservations.view permission');
    }

    return ReservationService.getStatusHistory(authContext.businessId, reservationId);
  });
}

/**
 * Staff-authenticated branch reservation settings update.
 */
export async function updateReservationSettingsAction(
  input: Partial<Omit<ReservationSettingsDTO, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>> & { branchId: string }
): Promise<ReservationActionResult<ReservationSettingsDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      throw new Error('Unauthorized');
    }

    const validated = reservationSettingsInputSchema.parse(input);

    const hasManage = await can({ context: authContext, permission: 'reservations.manage' });
    const hasSettings = await can({ context: authContext, permission: 'business.settings.manage' });

    if (!hasManage && !hasSettings) {
      throw new Error('Forbidden: missing reservations.manage or business.settings.manage permission');
    }

    return ReservationSettingsService.upsertBranchSettings(
      authContext.businessId,
      validated.branchId,
      validated
    );
  });
}

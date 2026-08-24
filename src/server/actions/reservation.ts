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
  ReservationDTO,
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
 * Staff-authenticated creation of a new table reservation.
 */
export async function createStaffReservationAction(
  input: CreateReservationInput
): Promise<ReservationDTO> {
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
}

/**
 * Public / customer creation of a new table reservation request.
 * Resolves trusted business_id from venue/branch record to prevent client tampering.
 */
export async function createPublicReservationAction(
  input: CreatePublicReservationInput
): Promise<PublicReservationDTO> {
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
}

/**
 * Staff-authenticated retrieval of a single reservation by ID.
 */
export async function getReservationByIdAction(
  reservationId: string
): Promise<ReservationDTO | null> {
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
}

/**
 * Staff-authenticated list/query of reservations with property reach isolation.
 */
export async function listReservationsAction(
  filter: Omit<ListReservationsFilter, 'businessId' | 'authorizedBranchIds'>
): Promise<PaginatedReservationsDTO> {
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
}

/**
 * Staff-authenticated confirmation of a pending reservation.
 */
export async function confirmReservationAction(
  reservationId: string
): Promise<ReservationDTO> {
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
}

/**
 * Staff-authenticated cancellation of a reservation.
 */
export async function cancelReservationAction(
  input: CancelReservationInput
): Promise<ReservationDTO> {
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
}

/**
 * Staff-authenticated status update: Mark Guest Arrived.
 */
export async function markReservationArrivedAction(
  reservationId: string
): Promise<ReservationDTO> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) {
    throw new Error('Unauthorized');
  }

  if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
    throw new Error('Forbidden: missing reservations.manage permission');
  }

  return ReservationService.markArrived(authContext.businessId, reservationId, authContext.userId);
}

/**
 * Staff-authenticated status update: Mark Party Seated.
 */
export async function markReservationSeatedAction(
  reservationId: string
): Promise<ReservationDTO> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) {
    throw new Error('Unauthorized');
  }

  if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
    throw new Error('Forbidden: missing reservations.manage permission');
  }

  return ReservationService.markSeated(authContext.businessId, reservationId, authContext.userId);
}

/**
 * Staff-authenticated status update: Mark Experience Completed.
 */
export async function markReservationCompletedAction(
  reservationId: string
): Promise<ReservationDTO> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) {
    throw new Error('Unauthorized');
  }

  if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
    throw new Error('Forbidden: missing reservations.manage permission');
  }

  return ReservationService.markCompleted(authContext.businessId, reservationId, authContext.userId);
}

/**
 * Staff-authenticated status update: Mark Reservation No-Show.
 */
export async function markReservationNoShowAction(
  reservationId: string
): Promise<ReservationDTO> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) {
    throw new Error('Unauthorized');
  }

  if (!(await can({ context: authContext, permission: 'reservations.manage' }))) {
    throw new Error('Forbidden: missing reservations.manage permission');
  }

  return ReservationService.markNoShow(authContext.businessId, reservationId, authContext.userId);
}

/**
 * Staff-authenticated status audit event history retrieval.
 */
export async function getReservationStatusHistoryAction(
  reservationId: string
): Promise<ReservationStatusEventDTO[]> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) {
    throw new Error('Unauthorized');
  }

  if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
    throw new Error('Forbidden: missing reservations.view permission');
  }

  return ReservationService.getStatusHistory(authContext.businessId, reservationId);
}

/**
 * Staff-authenticated branch reservation settings update.
 */
export async function updateReservationSettingsAction(
  input: Partial<Omit<ReservationSettingsDTO, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>> & { branchId: string }
): Promise<ReservationSettingsDTO> {
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
}

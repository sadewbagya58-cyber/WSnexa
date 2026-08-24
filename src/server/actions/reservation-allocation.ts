'use server';
import 'server-only';

import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { ReservationAvailabilityService } from '@/server/reservations/reservation-availability.service';
import { ReservationAllocationService } from '@/server/reservations/reservation-allocation.service';
import { ReservationWaitlistService } from '@/server/reservations/reservation-waitlist.service';
import {
  createWaitlistEntryInputSchema,
  createWalkInSeatingInputSchema,
  manualAssignTablesInputSchema,
  promoteWaitlistInputSchema,
} from '@/lib/validation/table-allocation';
import {
  CreateWaitlistEntryInput,
  CreateWalkInSeatingInput,
  ManualAssignTablesInput,
  PromoteWaitlistInput,
  ReservationTableAssignmentDTO,
  TableAvailabilityResultDTO,
  WaitlistEntryDTO,
  WaitlistStatus,
} from '@/lib/reservations/table-allocation-types';
import { ReservationActionResult, ReservationDTO, ReservationErrorCode } from '@/lib/reservations/reservation-types';

async function handleAction<T>(fn: () => Promise<T>): Promise<ReservationActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const errObj = err as Record<string, unknown>;
      const code = (errObj.code as ReservationErrorCode) || 'INTERNAL_ERROR';
      const message = typeof errObj.message === 'string' ? errObj.message : 'Reservation table allocation action failed.';
      return { ok: false, error: { code, message } };
    }
    if (err instanceof Error) {
      const message = err.message;
      if (message.includes('Unauthorized') || message.includes('Forbidden')) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message } };
      }
      if (message.includes('not found') || message.includes('outside your authorized property scope')) {
        return { ok: false, error: { code: 'FORBIDDEN_SCOPE', message: 'Resource not found or outside authorized property scope.' } };
      }
      return { ok: false, error: { code: 'INVALID_INPUT', message } };
    }
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' } };
  }
}

/**
 * Queries available dining tables and valid combinations for a time interval.
 */
export async function getAvailableTablesAction(params: {
  branchId: string;
  reservationStartAt: string;
  reservationEndAt: string;
  partySize: number;
  serviceAreaId?: string | null;
  excludedReservationId?: string | null;
}): Promise<ReservationActionResult<TableAvailabilityResultDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Unauthorized: Missing reservations.view capability.');
    }

    if (
      authContext.authorizedBranchIds &&
      authContext.authorizedBranchIds.length > 0 &&
      !authContext.authorizedBranchIds.includes(params.branchId)
    ) {
      throw new Error('Forbidden: Requested branch is outside your authorized property scope.');
    }

    return ReservationAvailabilityService.getAvailability({
      businessId: authContext.businessId,
      branchId: params.branchId,
      reservationStartAt: params.reservationStartAt,
      reservationEndAt: params.reservationEndAt,
      partySize: params.partySize,
      serviceAreaId: params.serviceAreaId,
      excludedReservationId: params.excludedReservationId,
    });
  });
}

/**
 * Automatically allocates best-fit dining tables for a reservation.
 */
export async function autoAllocateReservationTablesAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationTableAssignmentDTO[]>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.assign_tables' }))) {
      throw new Error('Unauthorized: Missing reservations.assign_tables capability.');
    }

    return ReservationAllocationService.allocateReservationTables(
      authContext.businessId,
      reservationId,
      authContext.userId
    );
  });
}

/**
 * Manually assigns specific dining tables to a reservation.
 */
export async function manuallyAssignTablesAction(
  input: ManualAssignTablesInput
): Promise<ReservationActionResult<ReservationTableAssignmentDTO[]>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.assign_tables' }))) {
      throw new Error('Unauthorized: Missing reservations.assign_tables capability.');
    }

    const validated = manualAssignTablesInputSchema.parse(input);

    return ReservationAllocationService.manuallyAssignTables({
      businessId: authContext.businessId,
      reservationId: validated.reservationId,
      tableIds: validated.tableIds,
      actorUserId: authContext.userId,
    });
  });
}

/**
 * Releases active table assignments for a reservation.
 */
export async function releaseReservationTablesAction(
  reservationId: string
): Promise<ReservationActionResult<number>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.assign_tables' }))) {
      throw new Error('Unauthorized: Missing reservations.assign_tables capability.');
    }

    return ReservationAllocationService.releaseReservationTables(
      authContext.businessId,
      reservationId
    );
  });
}

/**
 * Retrieves active table assignments for a reservation.
 */
export async function getActiveTableAssignmentsAction(
  reservationId: string
): Promise<ReservationActionResult<ReservationTableAssignmentDTO[]>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Unauthorized: Missing reservations.view capability.');
    }

    return ReservationAllocationService.getActiveAssignments(
      authContext.businessId,
      reservationId
    );
  });
}

/**
 * Executes staff walk-in seating flow.
 */
export async function createWalkInSeatingAction(
  input: CreateWalkInSeatingInput
): Promise<ReservationActionResult<{ reservation: ReservationDTO; assignments: ReservationTableAssignmentDTO[] }>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.create' })) || !(await can({ context: authContext, permission: 'reservations.assign_tables' }))) {
      throw new Error('Unauthorized: Missing reservations.create or reservations.assign_tables capability.');
    }

    const validated = createWalkInSeatingInputSchema.parse(input);

    if (
      authContext.authorizedBranchIds &&
      authContext.authorizedBranchIds.length > 0 &&
      !authContext.authorizedBranchIds.includes(validated.branchId)
    ) {
      throw new Error('Forbidden: Requested branch is outside your authorized property scope.');
    }

    return ReservationAllocationService.createWalkInSeating({
      businessId: authContext.businessId,
      branchId: validated.branchId,
      guestName: validated.guestName,
      guestEmail: validated.guestEmail,
      guestPhone: validated.guestPhone,
      partySize: validated.partySize,
      tableIds: validated.tableIds,
      durationMinutes: validated.durationMinutes,
      specialRequests: validated.specialRequests,
      actorUserId: authContext.userId,
    });
  });
}

/**
 * Adds a guest entry to the branch waitlist.
 */
export async function addWaitlistEntryAction(
  input: CreateWaitlistEntryInput
): Promise<ReservationActionResult<WaitlistEntryDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.waitlist_manage' }))) {
      throw new Error('Unauthorized: Missing reservations.waitlist_manage capability.');
    }

    const validated = createWaitlistEntryInputSchema.parse(input);

    if (
      authContext.authorizedBranchIds &&
      authContext.authorizedBranchIds.length > 0 &&
      !authContext.authorizedBranchIds.includes(validated.branchId)
    ) {
      throw new Error('Forbidden: Requested branch is outside your authorized property scope.');
    }

    return ReservationWaitlistService.addWaitlistEntry(
      {
        ...validated,
        businessId: authContext.businessId,
      },
      authContext.userId
    );
  });
}

/**
 * Lists waitlist entries for a branch.
 */
export async function listWaitlistEntriesAction(params: {
  branchId: string;
  status?: WaitlistStatus | WaitlistStatus[] | null;
}): Promise<ReservationActionResult<WaitlistEntryDTO[]>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.view' }))) {
      throw new Error('Unauthorized: Missing reservations.view capability.');
    }

    const hasContactView = await can({ context: authContext, permission: 'customers.contact_view' });

    return ReservationWaitlistService.listWaitlistEntries({
      businessId: authContext.businessId,
      branchId: params.branchId,
      status: params.status,
      hasContactView,
      authorizedBranchIds: authContext.authorizedBranchIds,
    });
  });
}

/**
 * Updates waitlist status.
 */
export async function updateWaitlistStatusAction(params: {
  waitlistEntryId: string;
  status: WaitlistStatus;
}): Promise<ReservationActionResult<WaitlistEntryDTO>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.waitlist_manage' }))) {
      throw new Error('Unauthorized: Missing reservations.waitlist_manage capability.');
    }

    return ReservationWaitlistService.updateWaitlistStatus(
      authContext.businessId,
      params.waitlistEntryId,
      params.status
    );
  });
}

/**
 * Promotes a waitlist entry into a reservation.
 */
export async function promoteWaitlistEntryAction(
  input: PromoteWaitlistInput
): Promise<ReservationActionResult<{ reservation: ReservationDTO; waitlistEntry: WaitlistEntryDTO }>> {
  return handleAction(async () => {
    const authContext = await resolveAuthorizationContext();
    if (!(await can({ context: authContext, permission: 'reservations.waitlist_manage' }))) {
      throw new Error('Unauthorized: Missing reservations.waitlist_manage capability.');
    }

    const validated = promoteWaitlistInputSchema.parse(input);

    return ReservationWaitlistService.promoteWaitlistEntryToReservation(
      validated,
      authContext.userId
    );
  });
}

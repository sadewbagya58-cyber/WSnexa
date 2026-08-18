'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { ActionResponse } from './auth';
import { PermissionService } from '@/server/services/permission.service';
import { OrganizationService } from '@/server/services/organization.service';
import {
  CreateStaffAssignmentInput,
  createStaffAssignmentSchema,
  EndStaffAssignmentInput,
  endStaffAssignmentSchema,
  TransitionPrimaryAssignmentInput,
  transitionPrimaryAssignmentSchema,
  SetReportingManagerInput,
  setReportingManagerSchema,
} from '@/lib/validation/organization';

/**
 * Creates a new staff assignment.
 */
export async function createStaffAssignmentAction(
  formData: CreateStaffAssignmentInput
): Promise<ActionResponse<{ assignmentId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'people.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage staff assignments.' };
    }

    const parsed = createStaffAssignmentSchema.safeParse({
      ...formData,
      businessId: context.business.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const created = await OrganizationService.createStaffAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Staff assignment created successfully.',
      data: { assignmentId: created.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create staff assignment.';
    return { success: false, message };
  }
}

/**
 * Ends an active staff assignment.
 */
export async function endStaffAssignmentAction(
  formData: EndStaffAssignmentInput
): Promise<ActionResponse<{ assignmentId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'people.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage staff assignments.' };
    }

    const parsed = endStaffAssignmentSchema.safeParse(formData);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const ended = await OrganizationService.endStaffAssignment(parsed.data);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Staff assignment ended successfully.',
      data: { assignmentId: ended.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to end staff assignment.';
    return { success: false, message };
  }
}

/**
 * Executes an atomic primary assignment transition (Promotion, Transfer, Reorganization).
 */
export async function transitionPrimaryAssignmentAction(
  formData: TransitionPrimaryAssignmentInput
): Promise<ActionResponse<{ endedAssignmentId: string; newAssignmentId: string; transitionType: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'people.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to transition staff assignments.' };
    }

    const parsed = transitionPrimaryAssignmentSchema.safeParse({
      ...formData,
      businessId: context.business.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await OrganizationService.transitionPrimaryAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: `Staff primary assignment successfully transitioned via ${parsed.data.transitionType}.`,
      data: {
        endedAssignmentId: res.endedAssignmentId,
        newAssignmentId: res.newAssignmentId,
        transitionType: res.transitionType,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to transition staff assignment.';
    return { success: false, message };
  }
}

/**
 * Semantic wrapper for staff promotion.
 */
export async function promoteStaffAction(
  formData: Omit<TransitionPrimaryAssignmentInput, 'transitionType'>
) {
  return transitionPrimaryAssignmentAction({
    ...formData,
    transitionType: 'promotion',
  });
}

/**
 * Semantic wrapper for staff transfer.
 */
export async function transferStaffAction(
  formData: Omit<TransitionPrimaryAssignmentInput, 'transitionType'>
) {
  return transitionPrimaryAssignmentAction({
    ...formData,
    transitionType: 'transfer',
  });
}

/**
 * Sets or updates the reporting manager for an assignment.
 */
export async function setReportingManagerAction(
  formData: SetReportingManagerInput
): Promise<ActionResponse<{ assignmentId: string; previousManagerAssignmentId?: string | null; newManagerAssignmentId?: string | null }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'people.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage reporting structure.' };
    }

    const parsed = setReportingManagerSchema.safeParse({
      ...formData,
      businessId: context.business.id,
    });

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const res = await OrganizationService.setReportingManager(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Reporting manager updated successfully.',
      data: {
        assignmentId: res.assignmentId || parsed.data.assignmentId,
        previousManagerAssignmentId: res.previousManagerAssignmentId || null,
        newManagerAssignmentId: res.newManagerAssignmentId || null,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update reporting manager.';
    return { success: false, message };
  }
}

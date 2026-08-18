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
  CreateActingAssignmentInput,
  createActingAssignmentSchema,
  ExtendActingAssignmentInput,
  extendActingAssignmentSchema,
  EndActingAssignmentInput,
  endActingAssignmentSchema,
  CreateSecondmentInput,
  createSecondmentSchema,
  EndSecondmentInput,
  endSecondmentSchema,
  CreateTemporaryAssignmentInput,
  createTemporaryAssignmentSchema,
  EndTemporaryAssignmentInput,
  endTemporaryAssignmentSchema,
  CreateAssignmentAbsenceInput,
  createAssignmentAbsenceSchema,
  EndAssignmentAbsenceInput,
  endAssignmentAbsenceSchema,
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

    const ended = await OrganizationService.endStaffAssignment(parsed.data, context.user.id);

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
 * Atomically transitions a primary assignment (promotion, transfer, reorganization).
 */
export async function transitionPrimaryAssignmentAction(
  formData: TransitionPrimaryAssignmentInput
): Promise<ActionResponse<{ newAssignmentId: string; endedAssignmentId: string }>> {
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
      return { success: false, message: 'Forbidden. You do not have permission to transition staff.' };
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
      message: `Staff member successfully ${parsed.data.transitionType === 'promotion' ? 'promoted' : 'transferred'}.`,
      data: {
        newAssignmentId: res.newAssignmentId,
        endedAssignmentId: res.endedAssignmentId,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to transition staff assignment.';
    return { success: false, message };
  }
}

/**
 * Updates a staff member's reporting manager.
 */
export async function setReportingManagerAction(
  formData: SetReportingManagerInput
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
      return { success: false, message: 'Forbidden. You do not have permission to update reporting managers.' };
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

    await OrganizationService.setReportingManager(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Reporting manager updated successfully.',
      data: { assignmentId: parsed.data.assignmentId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update reporting manager.';
    return { success: false, message };
  }
}

/**
 * Creates an acting assignment.
 */
export async function createActingAssignmentAction(
  formData: CreateActingAssignmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to create acting assignments.' };
    }

    const parsed = createActingAssignmentSchema.safeParse({
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

    const created = await OrganizationService.createActingAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Acting assignment created successfully.',
      data: { assignmentId: created.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create acting assignment.';
    return { success: false, message };
  }
}

/**
 * Extends an acting assignment.
 */
export async function extendActingAssignmentAction(
  formData: ExtendActingAssignmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to extend acting assignments.' };
    }

    const parsed = extendActingAssignmentSchema.safeParse({
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

    await OrganizationService.extendActingAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Acting assignment extended successfully.',
      data: { assignmentId: parsed.data.assignmentId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to extend acting assignment.';
    return { success: false, message };
  }
}

/**
 * Ends an acting assignment.
 */
export async function endActingAssignmentAction(
  formData: EndActingAssignmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to end acting assignments.' };
    }

    const parsed = endActingAssignmentSchema.safeParse({
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

    await OrganizationService.endActingAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Acting assignment ended successfully.',
      data: { assignmentId: parsed.data.assignmentId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to end acting assignment.';
    return { success: false, message };
  }
}

/**
 * Creates a secondment assignment.
 */
export async function createSecondmentAction(
  formData: CreateSecondmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to create secondments.' };
    }

    const parsed = createSecondmentSchema.safeParse({
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

    const created = await OrganizationService.createSecondment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Secondment created successfully.',
      data: { assignmentId: created.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create secondment.';
    return { success: false, message };
  }
}

/**
 * Ends a secondment assignment.
 */
export async function endSecondmentAction(
  formData: EndSecondmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to end secondments.' };
    }

    const parsed = endSecondmentSchema.safeParse({
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

    await OrganizationService.endSecondment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Secondment ended successfully.',
      data: { assignmentId: parsed.data.assignmentId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to end secondment.';
    return { success: false, message };
  }
}

/**
 * Creates an assignment absence record.
 */
export async function createAssignmentAbsenceAction(
  formData: CreateAssignmentAbsenceInput
): Promise<ActionResponse<{ absenceId: string }>> {
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
      return { success: false, message: 'Forbidden. You do not have permission to record absences.' };
    }

    const parsed = createAssignmentAbsenceSchema.safeParse({
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

    const created = await OrganizationService.createAssignmentAbsence(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Assignment absence recorded successfully.',
      data: { absenceId: created.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record assignment absence.';
    return { success: false, message };
  }
}

/**
 * Ends an assignment absence record.
 */
export async function endAssignmentAbsenceAction(
  formData: EndAssignmentAbsenceInput
): Promise<ActionResponse<{ absenceId: string }>> {
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
      return { success: false, message: 'Forbidden. You do not have permission to update absences.' };
    }

    const parsed = endAssignmentAbsenceSchema.safeParse(formData);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    await OrganizationService.endAssignmentAbsence(parsed.data);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Assignment absence ended successfully.',
      data: { absenceId: parsed.data.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to end assignment absence.';
    return { success: false, message };
  }
}

/**
 * Creates a new temporary assignment.
 */
export async function createTemporaryAssignmentAction(
  formData: CreateTemporaryAssignmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to manage temporary assignments.' };
    }

    const parsed = createTemporaryAssignmentSchema.safeParse({
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

    const assignment = await OrganizationService.createTemporaryAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Temporary assignment created successfully.',
      data: { assignmentId: assignment.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create temporary assignment.';
    return { success: false, message };
  }
}

/**
 * Ends an active temporary assignment.
 */
export async function endTemporaryAssignmentAction(
  formData: EndTemporaryAssignmentInput
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
      return { success: false, message: 'Forbidden. You do not have permission to manage temporary assignments.' };
    }

    const parsed = endTemporaryAssignmentSchema.safeParse({
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

    const ended = await OrganizationService.endTemporaryAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Temporary assignment ended successfully.',
      data: { assignmentId: ended.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to end temporary assignment.';
    return { success: false, message };
  }
}


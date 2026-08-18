'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { ActionResponse } from './auth';
import { PermissionService } from '@/server/services/permission.service';
import { OrganizationService } from '@/server/services/organization.service';
import {
  CreateDepartmentInput,
  createDepartmentSchema,
  UpdateDepartmentInput,
  updateDepartmentSchema,
  CreateOrganizationUnitInput,
  createOrganizationUnitSchema,
  UpdateOrganizationUnitInput,
  updateOrganizationUnitSchema,
  CreateJobTitleInput,
  createJobTitleSchema,
  UpdateJobTitleInput,
  updateJobTitleSchema,
  CreatePositionInput,
  createPositionSchema,
  UpdatePositionInput,
  updatePositionSchema,
  CreateStaffAssignmentInput,
  createStaffAssignmentSchema,
  CreateAdditionalAssignmentInput,
  createAdditionalAssignmentSchema,
  UpdateStaffAssignmentInput,
  updateStaffAssignmentSchema,
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
  formData: Omit<CreateStaffAssignmentInput, 'businessId'>
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
    revalidatePath('/dashboard/people');
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
 * Creates an additional staff assignment.
 */
export async function createAdditionalAssignmentAction(
  formData: Omit<CreateAdditionalAssignmentInput, 'businessId'>
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

    const parsed = createAdditionalAssignmentSchema.safeParse({
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

    const created = await OrganizationService.createAdditionalAssignment(parsed.data, context.user.id);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/people');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Additional assignment created successfully.',
      data: { assignmentId: created.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create additional assignment.';
    return { success: false, message };
  }
}

/**
 * Updates a staff assignment.
 */
export async function updateStaffAssignmentAction(
  formData: UpdateStaffAssignmentInput
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

    const parsed = updateStaffAssignmentSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const updated = await OrganizationService.updateStaffAssignment(parsed.data);

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/people');
    revalidatePath('/dashboard/organization');

    return {
      success: true,
      message: 'Staff assignment updated successfully.',
      data: { assignmentId: updated.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update staff assignment.';
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
  formData: Omit<TransitionPrimaryAssignmentInput, 'businessId'>
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
  formData: Omit<SetReportingManagerInput, 'businessId'>
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
  formData: Omit<CreateActingAssignmentInput, 'businessId'>
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
  formData: Omit<ExtendActingAssignmentInput, 'businessId'>
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
  formData: Omit<EndActingAssignmentInput, 'businessId'>
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
  formData: Omit<CreateSecondmentInput, 'businessId'>
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
  formData: Omit<EndSecondmentInput, 'businessId'>
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
  formData: Omit<CreateAssignmentAbsenceInput, 'businessId'>
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
  formData: Omit<CreateTemporaryAssignmentInput, 'businessId'>
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
 * Ends a temporary assignment.
 */
export async function endTemporaryAssignmentAction(
  formData: Omit<EndTemporaryAssignmentInput, 'businessId'>
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

/**
 * Creates a new department.
 */
export async function createDepartmentAction(
  formData: Omit<CreateDepartmentInput, 'businessId'>
): Promise<ActionResponse<{ departmentId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage organization structure.' };
    }

    const parsed = createDepartmentSchema.safeParse({
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

    const department = await OrganizationService.createDepartment(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/structure');

    return {
      success: true,
      message: 'Department created successfully.',
      data: { departmentId: department.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create department.';
    return { success: false, message };
  }
}

/**
 * Updates an existing department.
 */
export async function updateDepartmentAction(
  formData: UpdateDepartmentInput
): Promise<ActionResponse<{ departmentId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage organization structure.' };
    }

    const parsed = updateDepartmentSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const department = await OrganizationService.updateDepartment(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/structure');

    return {
      success: true,
      message: 'Department updated successfully.',
      data: { departmentId: department.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update department.';
    return { success: false, message };
  }
}

/**
 * Creates an organization unit.
 */
export async function createOrganizationUnitAction(
  formData: Omit<CreateOrganizationUnitInput, 'businessId'>
): Promise<ActionResponse<{ unitId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage organization structure.' };
    }

    const parsed = createOrganizationUnitSchema.safeParse({
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

    const unit = await OrganizationService.createOrganizationUnit(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/structure');

    return {
      success: true,
      message: 'Organization unit created successfully.',
      data: { unitId: unit.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create organization unit.';
    return { success: false, message };
  }
}

/**
 * Updates an organization unit.
 */
export async function updateOrganizationUnitAction(
  formData: UpdateOrganizationUnitInput
): Promise<ActionResponse<{ unitId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage organization structure.' };
    }

    const parsed = updateOrganizationUnitSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const unit = await OrganizationService.updateOrganizationUnit(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/structure');

    return {
      success: true,
      message: 'Organization unit updated successfully.',
      data: { unitId: unit.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update organization unit.';
    return { success: false, message };
  }
}

/**
 * Creates a job title.
 */
export async function createJobTitleAction(
  formData: Omit<CreateJobTitleInput, 'businessId'>
): Promise<ActionResponse<{ jobTitleId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage job titles.' };
    }

    const parsed = createJobTitleSchema.safeParse({
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

    const jobTitle = await OrganizationService.createJobTitle(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/job-titles');

    return {
      success: true,
      message: 'Job title created successfully.',
      data: { jobTitleId: jobTitle.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create job title.';
    return { success: false, message };
  }
}

/**
 * Updates a job title.
 */
export async function updateJobTitleAction(
  formData: UpdateJobTitleInput
): Promise<ActionResponse<{ jobTitleId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage job titles.' };
    }

    const parsed = updateJobTitleSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const jobTitle = await OrganizationService.updateJobTitle(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/job-titles');

    return {
      success: true,
      message: 'Job title updated successfully.',
      data: { jobTitleId: jobTitle.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update job title.';
    return { success: false, message };
  }
}

/**
 * Creates a position.
 */
export async function createPositionAction(
  formData: Omit<CreatePositionInput, 'businessId'>
): Promise<ActionResponse<{ positionId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'positions.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage positions.' };
    }

    const parsed = createPositionSchema.safeParse({
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

    const position = await OrganizationService.createPosition(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/positions');

    return {
      success: true,
      message: 'Position created successfully.',
      data: { positionId: position.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create position.';
    return { success: false, message };
  }
}

/**
 * Updates a position.
 */
export async function updatePositionAction(
  formData: UpdatePositionInput
): Promise<ActionResponse<{ positionId: string }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'positions.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to manage positions.' };
    }

    const parsed = updatePositionSchema.safeParse(formData);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const position = await OrganizationService.updatePosition(parsed.data);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/organization/positions');

    return {
      success: true,
      message: 'Position updated successfully.',
      data: { positionId: position.id },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update position.';
    return { success: false, message };
  }
}

/**
 * Reconciles assignment lifecycle (activates scheduled, ends expired).
 */
export async function reconcileAssignmentLifecycleAction(): Promise<ActionResponse<{ activatedCount: number; endedCount: number }>> {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user) {
      return { success: false, message: 'Unauthorized. Please sign in.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      context.activeBranch?.id || null,
      'organization.manage'
    );

    if (!canManage) {
      return { success: false, message: 'Forbidden. You do not have permission to reconcile organization lifecycle.' };
    }

    const res = await OrganizationService.reconcileAssignmentLifecycle(context.business.id);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/people');
    revalidatePath('/dashboard/people/integrity');

    return {
      success: true,
      message: `Lifecycle reconciled: ${res.activated_count} activated, ${res.ended_count} ended.`,
      data: {
        activatedCount: res.activated_count,
        endedCount: res.ended_count,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reconcile organization lifecycle.';
    return { success: false, message };
  }
}



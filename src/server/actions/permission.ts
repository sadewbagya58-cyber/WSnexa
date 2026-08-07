'use server';

import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import {
  PermissionService,
  FormattedCustomRole,
  FormattedMemberDetail,
  FormattedPermission,
} from '@/server/services/permission.service';
import {
  createCustomRoleSchema,
  updateCustomRoleSchema,
  memberOverrideSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
  MemberOverrideInput,
  UpdateMemberRoleInput,
  UpdateMemberStatusInput,
  PermissionKey,
} from '@/lib/validation/permission';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createCustomRoleAction(
  formData: CreateCustomRoleInput
): Promise<ActionResponse<FormattedCustomRole>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized. Business context required.' };
  }

  const parsed = createCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid role payload format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await PermissionService.createCustomRole(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to create custom role.' };
  }

  return {
    success: true,
    message: 'Custom role created successfully.',
    data: res.role!,
  };
}

export async function updateCustomRoleAction(
  formData: UpdateCustomRoleInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = updateCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid role update format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await PermissionService.updateCustomRole(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to update custom role.' };
  }

  return { success: true, message: 'Custom role updated successfully.' };
}

export async function listCustomRolesAction(): Promise<ActionResponse<FormattedCustomRole[]>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const roles = await PermissionService.listCustomRoles(context.business.id);
  return { success: true, data: roles };
}

export async function setMemberOverrideAction(
  formData: MemberOverrideInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = memberOverrideSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid member override payload.' };
  }

  const res = await PermissionService.setMemberOverride(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to set member override.' };
  }

  return { success: true, message: 'Member permission override updated.' };
}

export async function removeMemberOverrideAction(
  membershipId: string,
  permissionKey: PermissionKey
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const res = await PermissionService.removeMemberOverride(
    context.user.id,
    context.business.id,
    membershipId,
    permissionKey
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to remove override.' };
  }

  return { success: true, message: 'Member override removed.' };
}

export async function updateMemberRoleAction(
  formData: UpdateMemberRoleInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = updateMemberRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid member role payload.' };
  }

  const res = await PermissionService.updateMemberRole(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to update member role.' };
  }

  return { success: true, message: 'Member role updated successfully.' };
}

export async function setMembershipStatusAction(
  formData: UpdateMemberStatusInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = updateMemberStatusSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid status payload.' };
  }

  const res = await PermissionService.setMembershipStatus(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to update member status.' };
  }

  return { success: true, message: `Member status updated to ${parsed.data.status}.` };
}

export async function listTeamMembersAction(): Promise<ActionResponse<FormattedMemberDetail[]>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const members = await PermissionService.listTeamMembers(context.business.id);
  return { success: true, data: members };
}

export async function listPermissionCatalogAction(): Promise<ActionResponse<FormattedPermission[]>> {
  const catalog = await PermissionService.listPermissionCatalog();
  return { success: true, data: catalog };
}

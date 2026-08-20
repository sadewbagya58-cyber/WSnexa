'use server';

import { can, resolveAuthorizationContext } from '@/server/auth';
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized. Business context required.' };
  }

  const canManage = await can({
    context: authContext,
    permission: 'roles.manage',
  });
  if (!canManage) {
    return { success: false, message: 'Forbidden. Role management permission required.' };
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
    authContext.userId,
    authContext.businessId,
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canManage = await can({
    context: authContext,
    permission: 'roles.manage',
  });
  if (!canManage) {
    return { success: false, message: 'Forbidden. Role management permission required.' };
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
    authContext.userId,
    authContext.businessId,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to update custom role.' };
  }

  return {
    success: true,
    message: 'Custom role updated successfully.',
  };
}

export async function listCustomRolesAction(): Promise<ActionResponse<FormattedCustomRole[]>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const roles = await PermissionService.listCustomRoles(authContext.businessId);
  return { success: true, data: roles };
}

export async function setMemberOverrideAction(
  formData: MemberOverrideInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: formData.membershipId };
  const canManage =
    (await can({ context: authContext, permission: 'roles.manage', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'staff.role.assign', resource: memberResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Permission management permission required.' };
  }

  const parsed = memberOverrideSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid member override payload.' };
  }

  const res = await PermissionService.setMemberOverride(
    authContext.userId,
    authContext.businessId,
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: membershipId };
  const canManage =
    (await can({ context: authContext, permission: 'roles.manage', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'staff.role.assign', resource: memberResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Permission management permission required.' };
  }

  const res = await PermissionService.removeMemberOverride(
    authContext.userId,
    authContext.businessId,
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: formData.membershipId };
  const canAssign =
    (await can({ context: authContext, permission: 'staff.role.assign', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'roles.manage', resource: memberResource }));

  if (!canAssign) {
    return { success: false, message: 'Forbidden. Staff role assignment permission required.' };
  }

  const parsed = updateMemberRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid member role payload.' };
  }

  const res = await PermissionService.updateMemberRole(
    authContext.userId,
    authContext.businessId,
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: formData.membershipId };
  const canManage =
    (await can({ context: authContext, permission: 'staff.suspend', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'staff.manage', resource: memberResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Staff management permission required.' };
  }

  const parsed = updateMemberStatusSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid status payload.' };
  }

  const res = await PermissionService.setMembershipStatus(
    authContext.userId,
    authContext.businessId,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to update member status.' };
  }

  return { success: true, message: `Member status updated to ${parsed.data.status}.` };
}

export async function listTeamMembersAction(): Promise<ActionResponse<FormattedMemberDetail[]>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const members = await PermissionService.listTeamMembers(authContext.businessId);
  return { success: true, data: members };
}

export async function listPermissionCatalogAction(): Promise<ActionResponse<FormattedPermission[]>> {
  const catalog = await PermissionService.listPermissionCatalog();
  return { success: true, data: catalog };
}

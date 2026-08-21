'use server';

import { can, resolveAuthorizationContext } from '@/server/auth';
import {
  PermissionService,
  FormattedCustomRole,
  FormattedMemberDetail,
  FormattedPermission,
} from '@/server/services/permission.service';
import { ScopeGrantService } from '@/server/services/scope-grant.service';
import {
  ScopeGrantDetail,
  RoleScopePresetDetail,
  EffectiveAccessPreview,
  ScopeType,
} from '@/types/authorization.types';
import {
  createCustomRoleSchema,
  updateCustomRoleSchema,
  memberOverrideSchema,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
  createScopeGrantInputSchema,
  updateScopeGrantInputSchema,
  updateRoleScopePresetInputSchema,
  scopedMemberOverrideSchema,
  convertLegacyOverrideSchema,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
  MemberOverrideInput,
  UpdateMemberRoleInput,
  UpdateMemberStatusInput,
  CreateScopeGrantInput,
  UpdateScopeGrantInput,
  UpdateRoleScopePresetInput,
  ScopedMemberOverrideInput,
  ConvertLegacyOverrideInput,
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

// ====================================================================
// Phase 30 Step 6: Scope Grants & Overrides Management Server Actions
// ====================================================================

export async function listRoleScopePresetsAction(): Promise<ActionResponse<RoleScopePresetDetail[]>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canView = await can({ context: authContext, permission: 'roles.view' });
  if (!canView) {
    return { success: false, message: 'Forbidden. roles.view permission required.' };
  }

  const presets = await ScopeGrantService.listRoleScopePresets(authContext.businessId);
  return { success: true, data: presets };
}

export async function updateRoleScopePresetAction(
  formData: UpdateRoleScopePresetInput
): Promise<ActionResponse<RoleScopePresetDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canManage = await can({ context: authContext, permission: 'roles.manage' });
  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage permission required.' };
  }

  const parsed = updateRoleScopePresetInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid preset input.' };
  }

  try {
    const res = await ScopeGrantService.updateRoleScopePreset(authContext, parsed.data);
    return { success: true, message: res.message, data: res.preset };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update preset.';
    return { success: false, message };
  }
}

export async function listPermissionScopeGrantsAction(params?: {
  roleKey?: string | null;
  customRoleId?: string | null;
  businessMembershipId?: string | null;
  scopeType?: ScopeType;
  permissionKey?: string;
}): Promise<ActionResponse<ScopeGrantDetail[]>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canView = await can({ context: authContext, permission: 'roles.view' });
  if (!canView) {
    return { success: false, message: 'Forbidden. roles.view permission required.' };
  }

  const grants = await ScopeGrantService.listScopeGrants({
    businessId: authContext.businessId,
    roleKey: params?.roleKey,
    customRoleId: params?.customRoleId,
    businessMembershipId: params?.businessMembershipId,
    scopeType: params?.scopeType,
    permissionKey: params?.permissionKey,
  });

  return { success: true, data: grants };
}

export async function createPermissionScopeGrantAction(
  formData: CreateScopeGrantInput
): Promise<ActionResponse<ScopeGrantDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canManage =
    (await can({ context: authContext, permission: 'roles.manage' })) ||
    (await can({ context: authContext, permission: 'permissions.override.manage' }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage permission required.' };
  }

  const parsed = createScopeGrantInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid grant input.' };
  }

  try {
    const res = await ScopeGrantService.createScopeGrant(authContext, parsed.data);
    return { success: true, message: res.message, data: res.grant };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create scope grant.';
    return { success: false, message };
  }
}

export async function updatePermissionScopeGrantAction(
  formData: UpdateScopeGrantInput
): Promise<ActionResponse<ScopeGrantDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canManage =
    (await can({ context: authContext, permission: 'roles.manage' })) ||
    (await can({ context: authContext, permission: 'permissions.override.manage' }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage permission required.' };
  }

  const parsed = updateScopeGrantInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid grant input.' };
  }

  try {
    const res = await ScopeGrantService.updateScopeGrant(authContext, parsed.data);
    return { success: true, message: res.message, data: res.grant };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update scope grant.';
    return { success: false, message };
  }
}

export async function revokePermissionScopeGrantAction(grantId: string): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canManage =
    (await can({ context: authContext, permission: 'roles.manage' })) ||
    (await can({ context: authContext, permission: 'permissions.override.manage' }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage permission required.' };
  }

  try {
    const res = await ScopeGrantService.revokeScopeGrant(authContext, grantId);
    return { success: true, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to revoke scope grant.';
    return { success: false, message };
  }
}

export async function setScopedMemberOverrideAction(
  formData: ScopedMemberOverrideInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: formData.membershipId };
  const canManage =
    (await can({ context: authContext, permission: 'roles.manage', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'permissions.override.manage', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'staff.role.assign', resource: memberResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage or permissions.override.manage required.' };
  }

  const parsed = scopedMemberOverrideSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid scoped override format.' };
  }

  try {
    const res = await PermissionService.setScopedMemberOverride(authContext, parsed.data);
    return { success: true, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to set scoped override.';
    return { success: false, message };
  }
}

export async function convertLegacyOverrideAction(
  formData: ConvertLegacyOverrideInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const memberResource = { type: 'business_membership' as const, id: formData.membershipId };
  const canManage =
    (await can({ context: authContext, permission: 'roles.manage', resource: memberResource })) ||
    (await can({ context: authContext, permission: 'permissions.override.manage', resource: memberResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. roles.manage permission required.' };
  }

  const parsed = convertLegacyOverrideSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid override conversion input.' };
  }

  try {
    const res = await PermissionService.convertLegacyOverride(authContext, parsed.data);
    return { success: true, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to convert legacy override.';
    return { success: false, message };
  }
}

export async function previewMemberEffectiveAccessAction(
  membershipId: string
): Promise<ActionResponse<EffectiveAccessPreview>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canView =
    (await can({ context: authContext, permission: 'roles.view' })) ||
    (await can({ context: authContext, permission: 'staff.view' }));

  if (!canView) {
    return { success: false, message: 'Forbidden. roles.view or staff.view required.' };
  }

  const preview = await ScopeGrantService.previewMemberEffectiveAccess(authContext.businessId, membershipId);
  if (!preview) {
    return { success: false, message: 'Member not found.' };
  }

  return { success: true, data: preview };
}


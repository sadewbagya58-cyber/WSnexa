'use server';

import { can, resolveAuthorizationContext, authorize } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import {
  PermissionService,
  FormattedMemberDetail,
  FormattedPermission,
} from '@/server/services/permission.service';
import { RoleGovernanceService } from '@/server/services/role-governance.service';
import { ScopeGrantService } from '@/server/services/scope-grant.service';
import {
  ScopeGrantDetail,
  RoleScopePresetDetail,
  EffectiveAccessPreview,
  ScopeType,
  BuiltInRoleKey,
  BuiltInRoleTemplate,
  CustomRoleDetail,
  RoleUsageInfo,
  RoleEffectiveAccessSummary,
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
  cloneRoleSchema,
  archiveCustomRoleSchema,
  restoreCustomRoleSchema,
  reassignRoleMembersSchema,
  assignMemberRoleSchema,
  roleUsageQuerySchema,
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
  CloneRoleInput,
  ArchiveCustomRoleInput,
  RestoreCustomRoleInput,
  ReassignRoleMembersInput,
  AssignMemberRoleInput,
  RoleUsageQueryInput,
  PermissionKey,
} from '@/lib/validation/permission';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function listRoleTemplatesAction(): Promise<ActionResponse<BuiltInRoleTemplate[]>> {
  try {
    const templates = RoleGovernanceService.listBuiltInRoleTemplates();
    return { success: true, data: templates };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list role templates.';
    return { success: false, message };
  }
}

export async function getRoleTemplateAction(
  roleKey: BuiltInRoleKey
): Promise<ActionResponse<BuiltInRoleTemplate & { permissions: string[] }>> {
  try {
    const template = await RoleGovernanceService.getBuiltInRoleTemplate(roleKey);
    if (!template) {
      return { success: false, message: 'Role template not found.' };
    }
    return { success: true, data: template };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get role template.';
    return { success: false, message };
  }
}

export async function createCustomRoleAction(
  formData: CreateCustomRoleInput
): Promise<ActionResponse<CustomRoleDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized. Business context required.' };
  }

  const parsed = createCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid role payload format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.createCustomRole(authContext, parsed.data);
    return {
      success: true,
      message: res.message || 'Custom role created successfully.',
      data: res.role!,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create custom role.';
    return { success: false, message };
  }
}

export async function updateCustomRoleAction(
  formData: UpdateCustomRoleInput
): Promise<ActionResponse<CustomRoleDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = updateCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid role update format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.updateCustomRole(authContext, parsed.data);
    return {
      success: true,
      message: res.message || 'Custom role updated successfully.',
      data: res.role,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update custom role.';
    return { success: false, message };
  }
}

export async function cloneRoleAction(
  formData: CloneRoleInput
): Promise<ActionResponse<CustomRoleDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = cloneRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid clone payload.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.cloneRole(authContext, parsed.data);
    return {
      success: true,
      message: res.message || 'Role cloned successfully.',
      data: res.role,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clone role.';
    return { success: false, message };
  }
}

export async function archiveCustomRoleAction(
  formData: ArchiveCustomRoleInput
): Promise<ActionResponse<{ reassignedCount?: number }>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = archiveCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid archive request.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.archiveCustomRole(authContext, parsed.data);
    return {
      success: true,
      message: res.message,
      data: { reassignedCount: res.reassignedCount },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to archive custom role.';
    return { success: false, message };
  }
}

export async function restoreCustomRoleAction(
  formData: RestoreCustomRoleInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = restoreCustomRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid restore request.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.restoreCustomRole(authContext, parsed.data);
    return { success: true, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to restore custom role.';
    return { success: false, message };
  }
}

export async function listCustomRolesAction(
  options?: { includeArchived?: boolean }
): Promise<ActionResponse<CustomRoleDetail[]>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  try {
    const roles = await RoleGovernanceService.listCustomRoles(authContext.businessId, options);
    return { success: true, data: roles };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list custom roles.';
    return { success: false, message };
  }
}

export async function getCustomRoleAction(
  customRoleId: string
): Promise<ActionResponse<CustomRoleDetail>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  try {
    const role = await RoleGovernanceService.getCustomRoleById(authContext.businessId, customRoleId);
    if (!role) {
      return { success: false, message: 'Custom role not found.' };
    }
    return { success: true, data: role };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get custom role.';
    return { success: false, message };
  }
}

export async function getRoleUsageAction(
  query: RoleUsageQueryInput
): Promise<ActionResponse<RoleUsageInfo>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = roleUsageQuerySchema.safeParse(query);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid role usage query.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const usage = await RoleGovernanceService.getRoleUsage(authContext, parsed.data);
    return { success: true, data: usage };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to query role usage.';
    return { success: false, message };
  }
}

export async function reassignRoleMembersAction(
  formData: ReassignRoleMembersInput
): Promise<ActionResponse<{ reassignedCount: number }>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = reassignRoleMembersSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid reassignment payload.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.reassignRoleMembers(authContext, parsed.data);
    return {
      success: true,
      message: res.message,
      data: { reassignedCount: res.reassignedCount },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reassign members.';
    return { success: false, message };
  }
}

export async function assignMemberRoleAction(
  formData: AssignMemberRoleInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = assignMemberRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Invalid role assignment payload.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const res = await RoleGovernanceService.assignMemberRole(authContext, parsed.data);
    return { success: true, message: res.message };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to assign member role.';
    return { success: false, message };
  }
}

export async function previewRoleEffectiveAccessAction(
  identifier: { roleKey?: string; customRoleId?: string }
): Promise<ActionResponse<RoleEffectiveAccessSummary>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  try {
    const preview = await RoleGovernanceService.previewRoleEffectiveAccess(authContext, identifier);
    return { success: true, data: preview };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate effective access preview.';
    return { success: false, message };
  }
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

export interface DiagnosticQueryInput {
  membershipId: string;
  permission: string;
  resourceType?: string;
  resourceId?: string;
  branchId?: string;
  departmentId?: string;
  organizationUnitId?: string;
  serviceAreaId?: string;
  ownerUserId?: string;
}

export interface DiagnosticResultData {
  decision: import('@/types/authorization.types').AuthorizationDecision;
  memberName: string;
  memberRole: string;
  memberCustomRoleName?: string;
  explanation: string;
}

export async function diagnoseAccessAction(
  input: DiagnosticQueryInput,
  options?: { overrideUserId?: string; requestedBusinessId?: string }
): Promise<ActionResponse<DiagnosticResultData>> {
  const authContext = await resolveAuthorizationContext({
    overrideUserId: options?.overrideUserId,
    requestedBusinessId: options?.requestedBusinessId,
  });
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const canView =
    (await can({ context: authContext, permission: 'roles.view' })) ||
    (await can({ context: authContext, permission: 'staff.view' }));

  if (!canView) {
    return { success: false, message: 'Forbidden. roles.view or staff.view required.' };
  }

  const admin = createAdminClient();
  const { data: mem, error: memErr } = await admin
    .from('business_memberships')
    .select('id, user_id, business_id, role, custom_role_id')
    .eq('id', input.membershipId)
    .maybeSingle();

  if (memErr || !mem) {
    return { success: false, message: `Target member not found: ${memErr?.message || 'No row'}` };
  }

  if (mem.business_id !== authContext.businessId) {
    return { success: false, message: 'Forbidden. Member belongs to a different business.' };
  }

  let memberName = 'Staff Member';
  const { data: userProf } = await admin
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', mem.user_id)
    .maybeSingle();

  if (userProf) {
    memberName = `${userProf.first_name || ''} ${userProf.last_name || ''}`.trim() || 'Staff Member';
  }

  let customRoleName: string | undefined;
  if (mem.custom_role_id) {
    const { data: custRole } = await admin
      .from('custom_roles')
      .select('name')
      .eq('id', mem.custom_role_id)
      .maybeSingle();
    customRoleName = custRole?.name;
  }

  try {
    // Resolve target member's trusted authorization context
    const targetAuthContext = await resolveAuthorizationContext({
      overrideUserId: mem.user_id,
      requestedBusinessId: authContext.businessId,
    });

    let resource: import('@/types/authorization.types').AuthorizeOptions['resource'];
    if (input.resourceType && input.resourceType !== 'none') {
      resource = {
        type: input.resourceType as any,
        id: input.resourceId || undefined,
        branchId: input.branchId || undefined,
        departmentId: input.departmentId || undefined,
        organizationUnitId: input.organizationUnitId || undefined,
        serviceAreaId: input.serviceAreaId || undefined,
        ownerUserId: input.ownerUserId || undefined,
      } as any;
    } else if (input.branchId) {
      resource = {
        type: 'branch' as any,
        id: input.branchId,
        branchId: input.branchId,
      };
    }

    const decision = await authorize({
      context: targetAuthContext,
      permission: input.permission,
      resource,
    });

    // Generate human-friendly explanation
    let explanation = '';
    if (decision.allowed) {
      switch (decision.source) {
        case 'owner_policy':
          explanation = `Business Owner has organization-wide reach across all business resources.`;
          break;
        case 'explicit_override':
          explanation = `An explicit ALLOW member permission override was matched.`;
          break;
        case 'scope_grant':
          explanation = `A concrete permission scope grant matching scope ${decision.matchedScope || ''} granted access.`;
          break;
        case 'role_permission':
          explanation = `The member's active role includes permission '${input.permission}' within scope '${decision.matchedScope || 'ASSIGNED'}'.`;
          break;
        case 'acting_assignment':
          explanation = `An active acting assignment dynamically expanded the member's scope reach.`;
          break;
        case 'secondment':
          explanation = `An active secondment dynamically expanded the member's property reach to host branch.`;
          break;
        case 'self_ownership':
          explanation = `The resource matches the member's self ownership (${decision.resourceScope?.ownerUserId}).`;
          break;
        default:
          explanation = `Access granted based on valid role and assignment scope.`;
      }
    } else {
      switch (decision.reason) {
        case 'EXPLICIT_DENY':
          explanation = `An explicit DENY member override or scope grant takes absolute precedence and denied access.`;
          break;
        case 'PERMISSION_MISSING':
          explanation = `The member's role does not contain permission '${input.permission}'.`;
          break;
        case 'OUTSIDE_SCOPE':
          explanation = `The member holds permission '${input.permission}', but target resource is outside their authorized scope.`;
          break;
        case 'TENANT_MISMATCH':
          explanation = `Target resource belongs to a different business tenant.`;
          break;
        case 'RESOURCE_NOT_FOUND':
          explanation = `Target resource could not be found or verified in database.`;
          break;
        case 'INVALID_PERMISSION':
          explanation = `Permission key '${input.permission}' is invalid or uncataloged.`;
          break;
        case 'MEMBERSHIP_INACTIVE':
          explanation = `Member's business membership status is inactive or suspended.`;
          break;
        default:
          explanation = `Access denied by Policy Engine default deny rule.`;
      }
    }

    return {
      success: true,
      data: {
        decision,
        memberName,
        memberRole: mem.role,
        memberCustomRoleName: customRoleName,
        explanation,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Diagnostic evaluation failed.';
    return { success: false, message };
  }
}



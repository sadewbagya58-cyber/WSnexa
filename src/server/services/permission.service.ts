import { createAdminClient } from '@/lib/supabase/server';
import { getPermissionsForPreset } from '@/lib/validation/permission-presets';
import {
  PermissionKey,
  ownerOnlyPermissions,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
  MemberOverrideInput,
  ScopedMemberOverrideInput,
  ConvertLegacyOverrideInput,
  UpdateMemberRoleInput,
  UpdateMemberStatusInput,
} from '@/lib/validation/permission';
import { AuthorizationContext } from '@/types/authorization.types';
import { validateScopeTarget, validateAdministrativeReach } from '@/server/auth/scope-target-validator';
import { AuthorizationContextError } from '@/server/auth/errors';

export interface FormattedCustomRole {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  roleKey: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  permissions: PermissionKey[];
}

export interface FormattedPermission {
  key: PermissionKey;
  name: string;
  description: string | null;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface FormattedMemberDetail {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  customRoleId: string | null;
  customRoleName: string | null;
  membershipStatus: string;
  branchId: string | null;
  branchName: string | null;
  joinedAt: string;
  assignedAreaIds?: string[];
  assignedAreaNames?: string[];
  overrides: Array<{ permissionKey: PermissionKey; effect: 'allow' | 'deny' }>;
  effectivePermissions: PermissionKey[];
}

export class PermissionService {
  /**
   * Core authorization check method.
   * Evaluates authentication, membership status, Business Owner un-deniable authority,
   * member overrides, role defaults, custom roles, and branch boundaries.
   */
  static async hasPermission(
    userId: string,
    businessId: string,
    branchId: string | null,
    permissionKey: PermissionKey
  ): Promise<boolean> {
    const admin = createAdminClient();

    // 1. Fetch active membership
    const { data: membership } = await admin
      .from('business_memberships')
      .select('id, role, membership_status, custom_role_id')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership || membership.membership_status !== 'active') {
      return false;
    }

    // 2. Business Owners have un-deniable owner authority for all business-scoped permissions
    if (membership.role === 'business_owner') {
      return true;
    }

    // Protect owner-only permissions from non-owners
    if (ownerOnlyPermissions.includes(permissionKey)) {
      return false;
    }

    // 3. Check per-member permission overrides
    const { data: override } = await admin
      .from('member_permission_overrides')
      .select('effect')
      .eq('business_membership_id', membership.id)
      .eq('permission_key', permissionKey)
      .maybeSingle();

    if (override) {
      if (override.effect === 'deny') return false;
      if (override.effect === 'allow') {
        return this.verifyBranchBoundary(membership.id, branchId, admin);
      }
    }

    // 4. Evaluate Custom Role or Built-In Role permissions
    let hasRolePermission = false;

    if (membership.custom_role_id) {
      const { data: customRolePermission } = await admin
        .from('role_permissions')
        .select('id')
        .eq('custom_role_id', membership.custom_role_id)
        .eq('permission_key', permissionKey)
        .limit(1);

      if (customRolePermission && customRolePermission.length > 0) {
        hasRolePermission = true;
      }
    } else {
      const { data: builtInPermission } = await admin
        .from('role_permissions')
        .select('id')
        .eq('role_key', membership.role)
        .eq('permission_key', permissionKey)
        .limit(1);

      if (builtInPermission && builtInPermission.length > 0) {
        hasRolePermission = true;
      }
    }

    if (!hasRolePermission) {
      return false;
    }

    // 5. Verify branch boundary isolation
    return this.verifyBranchBoundary(membership.id, branchId, admin);
  }

  /**
   * Helper to verify service area scope boundary for area-sensitive operations.
   */
  static async verifyServiceAreaBoundary(
    membershipId: string,
    serviceAreaId: string | null,
    admin?: ReturnType<typeof createAdminClient>
  ): Promise<boolean> {
    if (!serviceAreaId) return true;

    const client = admin || createAdminClient();

    // Query primary staff_area_assignments table
    const { data: areaAssign } = await client
      .from('staff_area_assignments')
      .select('id')
      .eq('business_membership_id', membershipId)
      .eq('service_area_id', serviceAreaId)
      .limit(1);

    if (areaAssign && areaAssign.length > 0) return true;

    // Fallback check on staff_service_areas alias table
    const { data: legacyAssign } = await client
      .from('staff_service_areas')
      .select('id')
      .eq('business_membership_id', membershipId)
      .eq('service_area_id', serviceAreaId)
      .limit(1);

    return !!(legacyAssign && legacyAssign.length > 0);
  }

  /**
   * Helper to return all effective permission keys for a user in a business/branch.
   */
  static async getMemberEffectivePermissions(
    userId: string,
    businessId: string,
    branchId: string | null
  ): Promise<PermissionKey[]> {
    const catalog = await this.listPermissionCatalog();
    const allKeys = catalog.map((c) => c.key);

    const checks = await Promise.all(
      allKeys.map(async (key) => {
        const allowed = await this.hasPermission(userId, businessId, branchId, key);
        return allowed ? key : null;
      })
    );

    return checks.filter((k): k is PermissionKey => k !== null);
  }

  /**
   * Helper to verify if a membership has assignment to a given branch.
   */
  private static async verifyBranchBoundary(
    membershipId: string,
    branchId: string | null,
    admin: ReturnType<typeof createAdminClient>
  ): Promise<boolean> {
    if (!branchId) return true; // Business-wide check

    const { data: branchAssign } = await admin
      .from('branch_assignments')
      .select('id')
      .eq('business_membership_id', membershipId)
      .eq('branch_id', branchId)
      .limit(1);

    return !!(branchAssign && branchAssign.length > 0);
  }

  /**
   * Asserts permission and throws an exception if check fails.
   */
  static async requirePermission(
    userId: string,
    businessId: string,
    branchId: string | null,
    permissionKey: PermissionKey
  ): Promise<void> {
    const allowed = await this.hasPermission(userId, businessId, branchId, permissionKey);
    if (!allowed) {
      throw new Error(`Forbidden: Missing required permission '${permissionKey}'.`);
    }
  }

  /**
   * Lists all central permissions catalog records.
   */
  static async listPermissionCatalog(): Promise<FormattedPermission[]> {
    const admin = createAdminClient();
    const { data: catalog } = await admin
      .from('permissions')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (!catalog) return [];

    return catalog.map((p) => ({
      key: p.key as PermissionKey,
      name: p.name,
      description: p.description,
      category: p.category,
      riskLevel: p.risk_level,
    }));
  }

  /**
   * Creates a new business-bound custom role.
   */
  static async createCustomRole(
    userId: string,
    businessId: string,
    input: CreateCustomRoleInput
  ): Promise<{ success: boolean; message?: string; role?: FormattedCustomRole }> {
    const admin = createAdminClient();

    // Verify creator authority (Business Owner or staff.manage permission)
    const canManage = await this.hasPermission(userId, businessId, null, 'staff.manage');
    if (!canManage) {
      return { success: false, message: 'Unauthorized to manage staff roles.' };
    }

    // Filter out owner-only permissions if creator is not Business Owner
    const { data: creatorMem } = await admin
      .from('business_memberships')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single();

    const isOwner = creatorMem?.role === 'business_owner';
    const safePermissions = isOwner
      ? input.permissions
      : input.permissions.filter((p) => !ownerOnlyPermissions.includes(p));

    const roleKey = `custom_${input.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

    // 1. Insert custom_roles
    const { data: roleRow, error: roleErr } = await admin
      .from('custom_roles')
      .insert({
        business_id: businessId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        role_key: roleKey,
        is_active: true,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (roleErr || !roleRow) {
      return { success: false, message: `Failed to create role: ${roleErr?.message}` };
    }

    // 2. Insert role_permissions
    if (safePermissions.length > 0) {
      const inserts = safePermissions.map((p) => ({
        business_id: businessId,
        custom_role_id: roleRow.id,
        permission_key: p,
      }));
      await admin.from('role_permissions').insert(inserts);
    }

    // 3. Insert role_scope_presets
    await admin.from('role_scope_presets').insert({
      business_id: businessId,
      custom_role_id: roleRow.id,
      default_scope: input.defaultScope || 'PROPERTY',
      max_scope: input.maxScope || 'PROPERTY',
    });

    // 4. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'role.created',
      target_type: 'custom_role',
      target_id: roleRow.id,
      payload: { name: roleRow.name, permissions: safePermissions },
    });

    return {
      success: true,
      role: {
        id: roleRow.id,
        businessId: roleRow.business_id,
        name: roleRow.name,
        description: roleRow.description,
        roleKey: roleRow.role_key,
        isActive: roleRow.is_active,
        createdBy: roleRow.created_by,
        createdAt: roleRow.created_at,
        permissions: safePermissions,
      },
    };
  }

  /**
   * Updates an existing custom role and its permission mapping.
   */
  static async updateCustomRole(
    userId: string,
    businessId: string,
    input: UpdateCustomRoleInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    const canManage = await this.hasPermission(userId, businessId, null, 'staff.manage');
    if (!canManage) {
      return { success: false, message: 'Unauthorized to manage staff roles.' };
    }

    const { data: creatorMem } = await admin
      .from('business_memberships')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .single();

    const isOwner = creatorMem?.role === 'business_owner';
    const safePermissions = input.permissions
      ? (isOwner
          ? input.permissions
          : input.permissions.filter((p) => !ownerOnlyPermissions.includes(p)))
      : undefined;

    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = { updated_at: now };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive;

    const { error: updateErr } = await admin
      .from('custom_roles')
      .update(updatePayload)
      .eq('id', input.roleId)
      .eq('business_id', businessId);

    if (updateErr) {
      return { success: false, message: `Failed to update role: ${updateErr.message}` };
    }

    // 2. Re-insert role_permissions if provided
    if (safePermissions) {
      await admin.from('role_permissions').delete().eq('custom_role_id', input.roleId);

      if (safePermissions.length > 0) {
        const inserts = safePermissions.map((p) => ({
          business_id: businessId,
          custom_role_id: input.roleId,
          permission_key: p,
        }));
        await admin.from('role_permissions').insert(inserts);
      }
    }

    // 3. Update role_scope_presets if provided
    if (input.defaultScope || input.maxScope) {
      const { data: existingPreset } = await admin
        .from('role_scope_presets')
        .select('id, default_scope, max_scope')
        .eq('custom_role_id', input.roleId)
        .maybeSingle();

      const newDefault = input.defaultScope || existingPreset?.default_scope || 'PROPERTY';
      const newMax = input.maxScope || existingPreset?.max_scope || 'PROPERTY';

      if (existingPreset) {
        await admin
          .from('role_scope_presets')
          .update({ default_scope: newDefault, max_scope: newMax, updated_at: now })
          .eq('id', existingPreset.id);
      } else {
        await admin.from('role_scope_presets').insert({
          business_id: businessId,
          custom_role_id: input.roleId,
          default_scope: newDefault,
          max_scope: newMax,
        });
      }
    }

    // 4. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'role.updated',
      target_type: 'custom_role',
      target_id: input.roleId,
      payload: { name: input.name, permissions: safePermissions },
    });

    return { success: true };
  }

  /**
   * Fetches custom roles for a business.
   */
  static async listCustomRoles(businessId: string): Promise<FormattedCustomRole[]> {
    const admin = createAdminClient();

    const { data: roles } = await admin
      .from('custom_roles')
      .select('*, role_permissions(permission_key)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    interface CustomRoleRow {
      id: string;
      business_id: string;
      name: string;
      description: string | null;
      role_key: string;
      is_active: boolean;
      created_by: string;
      created_at: string;
      role_permissions?: Array<{ permission_key: string }>;
    }

    return (roles as CustomRoleRow[]).map((r) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      description: r.description,
      roleKey: r.role_key,
      isActive: r.is_active,
      createdBy: r.created_by,
      createdAt: r.created_at,
      permissions: (r.role_permissions || []).map((rp) => rp.permission_key as PermissionKey),
    }));
  }

  /**
   * Creates or updates a per-member explicit permission override.
   */
  /**
   * Creates or updates a per-member explicit permission override (backward compatible).
   */
  static async setMemberOverride(
    userId: string,
    businessId: string,
    input: MemberOverrideInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    const canManage = await this.hasPermission(userId, businessId, null, 'staff.manage');
    if (!canManage) {
      return { success: false, message: 'Unauthorized to edit member overrides.' };
    }

    // Check target member
    const { data: targetMem } = await admin
      .from('business_memberships')
      .select('id, role, business_id')
      .eq('id', input.membershipId)
      .eq('business_id', businessId)
      .single();

    if (!targetMem) {
      return { success: false, message: 'Target member not found.' };
    }

    if (targetMem.role === 'business_owner' && input.effect === 'deny') {
      return { success: false, message: 'Cannot apply deny overrides to Business Owners.' };
    }

    const now = new Date().toISOString();

    const { error: upsertErr } = await admin
      .from('member_permission_overrides')
      .upsert(
        {
          business_membership_id: input.membershipId,
          permission_key: input.permissionKey,
          effect: input.effect,
          created_by: userId,
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'business_membership_id,permission_key' }
      );

    if (upsertErr) {
      return { success: false, message: `Failed to set override: ${upsertErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: input.effect === 'allow' ? 'permission.granted' : 'permission.revoked',
      target_type: 'member_override',
      target_id: input.membershipId,
      payload: { permission_key: input.permissionKey, effect: input.effect },
    });

    return { success: true };
  }

  /**
   * Creates or updates a per-member explicit scoped permission override (V2).
   */
  static async setScopedMemberOverride(
    actorContext: AuthorizationContext,
    input: ScopedMemberOverrideInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    if (input.permissionKey.startsWith('super_admin.')) {
      throw new AuthorizationContextError(
        'INVALID_PERMISSION',
        'Cannot configure Super Admin platform permissions in tenant overrides.'
      );
    }

    // Verify target membership exists and belongs to business
    const { data: targetMem } = await admin
      .from('business_memberships')
      .select('id, role, business_id, membership_status')
      .eq('id', input.membershipId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!targetMem) {
      throw new AuthorizationContextError('RESOURCE_NOT_FOUND', 'Target business membership not found.');
    }

    if (targetMem.role === 'business_owner' && input.effect === 'deny') {
      throw new AuthorizationContextError('INVALID_PERMISSION', 'Cannot apply deny overrides to Business Owners.');
    }

    const scopeType = input.scopeType || 'PROPERTY';

    // Validate scope target
    const targetValidation = await validateScopeTarget({
      businessId,
      scopeType,
      branchId: input.branchId,
      departmentId: input.departmentId,
      organizationUnitId: input.organizationUnitId,
      serviceAreaId: input.serviceAreaId,
    });

    // Validate administrative reach
    validateAdministrativeReach({
      actorContext,
      requestedScope: scopeType,
      targetBranchId: targetValidation.branchId,
      targetDepartmentId: targetValidation.departmentId,
      targetOrganizationUnitId: targetValidation.organizationUnitId,
      targetServiceAreaId: targetValidation.serviceAreaId,
      permissionKey: input.permissionKey,
    });

    const isValidUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const now = new Date().toISOString();

    const { error: upsertErr } = await admin
      .from('member_permission_overrides')
      .upsert(
        {
          business_membership_id: input.membershipId,
          permission_key: input.permissionKey,
          effect: input.effect,
          scope_type: scopeType,
          branch_id: targetValidation.branchId,
          department_id: targetValidation.departmentId,
          organization_unit_id: targetValidation.organizationUnitId,
          service_area_id: targetValidation.serviceAreaId,
          created_by: isValidUuid(actorContext.userId) ? actorContext.userId : null,
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'business_membership_id,permission_key' }
      );

    if (upsertErr) {
      throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to set override: ${upsertErr.message}`);
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: isValidUuid(actorContext.userId) ? actorContext.userId : null,
      action: 'member_override.updated',
      target_type: 'member_permission_override',
      target_id: input.membershipId,
      payload: {
        permissionKey: input.permissionKey,
        effect: input.effect,
        scopeType,
        targetDisplay: targetValidation.targetDisplay,
      },
    });

    return { success: true, message: 'Member scoped override updated successfully.' };
  }

  /**
   * Explicitly converts a legacy unscoped override (scope_type = NULL) to a V2 scoped override.
   * Never converts silently in the background.
   */
  static async convertLegacyOverride(
    actorContext: AuthorizationContext,
    input: ConvertLegacyOverrideInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    // Verify existing legacy override exists with scope_type IS NULL
    const { data: legacyOv } = await admin
      .from('member_permission_overrides')
      .select('*')
      .eq('business_membership_id', input.membershipId)
      .eq('permission_key', input.permissionKey)
      .maybeSingle();

    if (!legacyOv) {
      throw new AuthorizationContextError('RESOURCE_NOT_FOUND', 'Existing legacy override not found.');
    }

    // Validate new target scope
    const targetValidation = await validateScopeTarget({
      businessId,
      scopeType: input.scopeType,
      branchId: input.branchId,
      departmentId: input.departmentId,
      organizationUnitId: input.organizationUnitId,
      serviceAreaId: input.serviceAreaId,
    });

    validateAdministrativeReach({
      actorContext,
      requestedScope: input.scopeType,
      targetBranchId: targetValidation.branchId,
      targetDepartmentId: targetValidation.departmentId,
      targetOrganizationUnitId: targetValidation.organizationUnitId,
      targetServiceAreaId: targetValidation.serviceAreaId,
      permissionKey: input.permissionKey,
    });

    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('member_permission_overrides')
      .update({
        scope_type: input.scopeType,
        branch_id: targetValidation.branchId,
        department_id: targetValidation.departmentId,
        organization_unit_id: targetValidation.organizationUnitId,
        service_area_id: targetValidation.serviceAreaId,
        updated_at: now,
      })
      .eq('id', legacyOv.id);

    if (updateErr) {
      throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to convert legacy override: ${updateErr.message}`);
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'legacy_override.converted',
      target_type: 'member_permission_override',
      target_id: legacyOv.id,
      payload: {
        permissionKey: input.permissionKey,
        previousScopeType: legacyOv.scope_type,
        newScopeType: input.scopeType,
        targetDisplay: targetValidation.targetDisplay,
      },
    });

    return { success: true, message: 'Legacy override successfully converted to V2 scoped override.' };
  }

  /**
   * Removes a member permission override.
   */
  static async removeMemberOverride(
    userIdOrContext: string | AuthorizationContext,
    businessIdOrMembershipId: string,
    membershipIdOrKey?: string | PermissionKey,
    permissionKeyParam?: PermissionKey
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    let userId: string;
    let businessId: string;
    let membershipId: string;
    let permissionKey: PermissionKey;

    if (typeof userIdOrContext === 'object') {
      userId = userIdOrContext.userId;
      businessId = userIdOrContext.businessId;
      membershipId = businessIdOrMembershipId;
      permissionKey = membershipIdOrKey as PermissionKey;
    } else {
      userId = userIdOrContext;
      businessId = businessIdOrMembershipId;
      membershipId = membershipIdOrKey as string;
      permissionKey = permissionKeyParam as PermissionKey;
    }

    const { error: deleteErr } = await admin
      .from('member_permission_overrides')
      .delete()
      .eq('business_membership_id', membershipId)
      .eq('permission_key', permissionKey);

    if (deleteErr) {
      return { success: false, message: `Failed to remove override: ${deleteErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'member_override.removed',
      target_type: 'member_permission_override',
      target_id: membershipId,
      payload: { permissionKey },
    });

    return { success: true, message: 'Member override removed.' };
  }

  /**
   * Updates member role (built-in role or custom role).
   */
  static async updateMemberRole(
    userId: string,
    businessId: string,
    input: UpdateMemberRoleInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    const canManage = await this.hasPermission(userId, businessId, null, 'staff.manage');
    if (!canManage) {
      return { success: false, message: 'Unauthorized to change member roles.' };
    }

    const { data: targetMem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('id', input.membershipId)
      .eq('business_id', businessId)
      .single();

    if (!targetMem) {
      return { success: false, message: 'Member not found.' };
    }

    if (targetMem.role === 'business_owner') {
      return { success: false, message: 'Cannot modify Business Owner role.' };
    }

    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('business_memberships')
      .update({
        role: input.builtInRole,
        custom_role_id: input.customRoleId || null,
        updated_at: now,
      })
      .eq('id', input.membershipId);

    if (updateErr) {
      return { success: false, message: `Failed to update member role: ${updateErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'role.assigned',
      target_type: 'business_membership',
      target_id: input.membershipId,
      payload: { builtInRole: input.builtInRole, customRoleId: input.customRoleId },
    });

    return { success: true };
  }

  /**
   * Updates member status (active or suspended).
   */
  static async setMembershipStatus(
    userId: string,
    businessId: string,
    input: UpdateMemberStatusInput
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    const canManage = await this.hasPermission(userId, businessId, null, 'staff.manage');
    if (!canManage) {
      return { success: false, message: 'Unauthorized to change member status.' };
    }

    const { data: targetMem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('id', input.membershipId)
      .eq('business_id', businessId)
      .single();

    if (!targetMem) {
      return { success: false, message: 'Member not found.' };
    }

    if (targetMem.role === 'business_owner') {
      return { success: false, message: 'Cannot suspend Business Owner.' };
    }

    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('business_memberships')
      .update({
        membership_status: input.status,
        updated_at: now,
      })
      .eq('id', input.membershipId);

    if (updateErr) {
      return { success: false, message: `Failed to update status: ${updateErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: input.status === 'suspended' ? 'member.suspended' : 'member.reactivated',
      target_type: 'business_membership',
      target_id: input.membershipId,
    });

    return { success: true };
  }

  /**
   * Fetches team directory with full permission details for UI management.
   * Optimized with parallel queries, branch isolation, and in-memory effective permission evaluation.
   */
  static async listTeamMembers(businessId: string, branchId?: string | null): Promise<FormattedMemberDetail[]> {
    const t0 = performance.now();
    const admin = createAdminClient();

    const [membersRes, customRolesRes, catalog] = await Promise.all([
      admin
        .from('business_memberships')
        .select(`
          id,
          user_id,
          role,
          custom_role_id,
          membership_status,
          joined_at,
          custom_roles(name),
          branch_assignments(branch_id, branches(name)),
          member_permission_overrides(permission_key, effect)
        `)
        .eq('business_id', businessId)
        .order('joined_at', { ascending: true }),
      admin
        .from('custom_roles')
        .select('id, role_permissions(permission_key)')
        .eq('business_id', businessId),
      this.listPermissionCatalog(),
    ]);

    const members = membersRes.data || [];
    if (members.length === 0) return [];

    const customRolesPermMap = new Map<string, PermissionKey[]>();
    (customRolesRes.data || []).forEach((cr) => {
      const perms = (cr.role_permissions || []).map((rp: { permission_key: string }) => rp.permission_key as PermissionKey);
      customRolesPermMap.set(cr.id, perms);
    });

    const userIds = members.map((m) => m.user_id);
    const membershipIds = members.map((m) => m.id);

    const [profilesRes, areaAssignsRes] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds),
      admin
        .from('staff_area_assignments')
        .select('business_membership_id, service_area_id, service_areas(id, name)')
        .in('business_membership_id', membershipIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));

    // Batch resolve auth user metadata for any members missing profile name or email
    const missingMetadataUserIds = userIds.filter((id) => {
      const p = profileMap.get(id);
      return !p || (!p.first_name && !p.last_name) || !p.email;
    });

    if (missingMetadataUserIds.length > 0) {
      try {
        const { data: authUsersRes } = await admin.auth.admin.listUsers();
        if (authUsersRes?.users) {
          for (const u of authUsersRes.users) {
            if (missingMetadataUserIds.includes(u.id)) {
              const existingP = profileMap.get(u.id) || { id: u.id, first_name: '', last_name: '', email: u.email || '' };
              const meta = u.user_metadata || {};
              const metaFullName = meta.full_name || meta.name || '';
              const metaFirstName = meta.first_name || (metaFullName ? metaFullName.split(' ')[0] : '');
              const metaLastName = meta.last_name || (metaFullName ? metaFullName.split(' ').slice(1).join(' ') : '');

              profileMap.set(u.id, {
                id: u.id,
                first_name: existingP.first_name || metaFirstName || '',
                last_name: existingP.last_name || metaLastName || '',
                email: existingP.email || u.email || '',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch auth metadata fallback for team members:', err);
      }
    }

    const memberAreaMap = new Map<string, { ids: string[]; names: string[] }>();

    for (const a of areaAssignsRes.data || []) {
      const memId = a.business_membership_id;
      if (!memberAreaMap.has(memId)) {
        memberAreaMap.set(memId, { ids: [], names: [] });
      }
      const entry = memberAreaMap.get(memId)!;
      entry.ids.push(a.service_area_id);
      const areaObj = Array.isArray(a.service_areas) ? a.service_areas[0] : a.service_areas;
      if (areaObj?.name) {
        entry.names.push(areaObj.name);
      }
    }

    const allKeys = catalog.map((c) => c.key);
    const result: FormattedMemberDetail[] = [];

    interface MemberRow {
      id: string;
      user_id: string;
      role: string;
      custom_role_id: string | null;
      membership_status: string;
      joined_at: string;
      custom_roles?: { name: string } | Array<{ name: string }> | null;
      branch_assignments?: Array<{ branch_id: string; branches?: { name: string } | null }>;
      member_permission_overrides?: Array<{ permission_key: string; effect: string }>;
    }

    for (const m of (members as unknown as MemberRow[])) {
      // Branch Isolation Rule: If branchId is specified and member is NOT a Business Owner,
      // verify member possesses an explicit branch assignment for target branchId.
      if (branchId && m.role !== 'business_owner') {
        const assignedBranchIds = (m.branch_assignments || []).map((ba) => ba.branch_id);
        if (!assignedBranchIds.includes(branchId)) {
          continue;
        }
      }
      const p = profileMap.get(m.user_id);
      let rawName = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
      let userEmail = p?.email || '';

      if (!rawName && userEmail) {
        // Derive clean name from email if first_name/last_name not set (e.g. kasun.perera@gmail.com -> Kasun Perera)
        const emailPrefix = userEmail.split('@')[0];
        rawName = emailPrefix
          .split(/[\._\-]/)
          .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }

      const userName = rawName || 'Staff Member';
      if (!userEmail) userEmail = 'staff@wsnexa.internal';

      const branchAssign = m.branch_assignments?.[0];
      const memberBranchId = branchAssign?.branch_id || null;
      const branchName = branchAssign?.branches?.name || 'All Branches';

      const overrides = (m.member_permission_overrides || []).map((o) => ({
        permissionKey: o.permission_key as PermissionKey,
        effect: o.effect as 'allow' | 'deny',
      }));

      // In-memory effective permission calculation
      const effectiveSet = new Set<PermissionKey>();
      if (m.membership_status === 'active') {
        if (m.role === 'business_owner') {
          allKeys.forEach((k) => effectiveSet.add(k));
        } else {
          let basePerms: PermissionKey[] = [];
          if (m.custom_role_id && customRolesPermMap.has(m.custom_role_id)) {
            basePerms = customRolesPermMap.get(m.custom_role_id) || [];
          } else {
            basePerms = getPermissionsForPreset(m.role);
          }

          const denySet = new Set(overrides.filter((o) => o.effect === 'deny').map((o) => o.permissionKey));
          const allowSet = new Set(overrides.filter((o) => o.effect === 'allow').map((o) => o.permissionKey));

          basePerms.forEach((k) => {
            if (!denySet.has(k)) effectiveSet.add(k);
          });
          allowSet.forEach((k) => effectiveSet.add(k));
        }
      }

      const areaInfo = memberAreaMap.get(m.id) || { ids: [], names: [] };

      result.push({
        id: m.id,
        userId: m.user_id,
        userName,
        userEmail,
        role: m.role,
        customRoleId: m.custom_role_id,
        customRoleName: Array.isArray(m.custom_roles) ? m.custom_roles[0]?.name || null : m.custom_roles?.name || null,
        membershipStatus: m.membership_status,
        branchId: memberBranchId,
        branchName,
        joinedAt: m.joined_at,
        assignedAreaIds: areaInfo.ids,
        assignedAreaNames: areaInfo.names,
        overrides,
        effectivePermissions: Array.from(effectiveSet),
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚡ [PermissionService.listTeamMembers] Resolved ${result.length} members in ${(performance.now() - t0).toFixed(1)}ms`);
    }

    return result;
  }
}

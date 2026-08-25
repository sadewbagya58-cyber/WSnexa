import { createAdminClient } from '@/lib/supabase/server';
import {
  AuthorizationContext,
  ScopeType,
  BuiltInRoleKey,
  BuiltInRoleTemplate,
  BUILT_IN_ROLE_TEMPLATES,
  CustomRoleDetail,
  RoleUsageInfo,
  RoleEffectiveAccessSummary,
  SCOPE_RANK,
} from '@/types/authorization.types';
import { AuthorizationContextError } from '@/server/auth/errors';
import {
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
  CloneRoleInput,
  ArchiveCustomRoleInput,
  RestoreCustomRoleInput,
  ReassignRoleMembersInput,
  AssignMemberRoleInput,
  RoleUsageQueryInput,
  PermissionKey,
  ownerOnlyPermissions,
} from '@/lib/validation/permission';
import { can } from '@/server/auth/policy-engine';

export class RoleGovernanceService {
  /**
   * Returns all canonical built-in role templates.
   */
  static listBuiltInRoleTemplates(): BuiltInRoleTemplate[] {
    return Object.values(BUILT_IN_ROLE_TEMPLATES).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Retrieves a single built-in role template with its canonical permissions.
   */
  static async getBuiltInRoleTemplate(
    roleKey: BuiltInRoleKey
  ): Promise<(BuiltInRoleTemplate & { permissions: string[] }) | null> {
    const template = BUILT_IN_ROLE_TEMPLATES[roleKey];
    if (!template) return null;

    const admin = createAdminClient();
    const { data: perms } = await admin
      .from('role_permissions')
      .select('permission_key')
      .eq('role_key', roleKey)
      .is('business_id', null);

    return {
      ...template,
      permissions: (perms || []).map((p) => p.permission_key),
    };
  }

  /**
   * Lists custom roles for a business with full scope presets and active status.
   */
  static async listCustomRoles(
    businessId: string,
    options: { includeArchived?: boolean } = {}
  ): Promise<CustomRoleDetail[]> {
    const admin = createAdminClient();

    let query = admin
      .from('custom_roles')
      .select('*, role_permissions(permission_key), role_scope_presets(default_scope, max_scope)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (!options.includeArchived) {
      query = query.eq('is_active', true);
    }

    const { data: roles, error } = await query;
    if (error || !roles) {
      return [];
    }

    interface CustomRoleRow {
      id: string;
      business_id: string;
      name: string;
      description: string | null;
      role_key: string;
      is_active: boolean;
      created_by: string;
      created_at: string;
      updated_at: string;
      role_permissions?: Array<{ permission_key: string }>;
      role_scope_presets?: Array<{ default_scope: ScopeType; max_scope: ScopeType }>;
    }

    return (roles as CustomRoleRow[]).map((r) => {
      const preset = (r.role_scope_presets && r.role_scope_presets[0]) || {
        default_scope: 'PROPERTY' as ScopeType,
        max_scope: 'PROPERTY' as ScopeType,
      };

      return {
        id: r.id,
        businessId: r.business_id,
        name: r.name,
        description: r.description,
        roleKey: r.role_key,
        isActive: r.is_active,
        isArchived: !r.is_active,
        defaultScope: preset.default_scope,
        maxScope: preset.max_scope,
        permissions: (r.role_permissions || []).map((rp) => rp.permission_key),
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  /**
   * Retrieves a single custom role by ID with tenant boundary verification.
   */
  static async getCustomRoleById(
    businessId: string,
    customRoleId: string
  ): Promise<CustomRoleDetail | null> {
    const admin = createAdminClient();

    const { data: r, error } = await admin
      .from('custom_roles')
      .select('*, role_permissions(permission_key), role_scope_presets(default_scope, max_scope)')
      .eq('id', customRoleId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error || !r) return null;

    const preset = (r.role_scope_presets && r.role_scope_presets[0]) || {
      default_scope: 'PROPERTY' as ScopeType,
      max_scope: 'PROPERTY' as ScopeType,
    };

    // Fetch usage counts
    const { count: memberCount } = await admin
      .from('business_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('custom_role_id', customRoleId)
      .eq('membership_status', 'active');

    const { count: inviteCount } = await admin
      .from('staff_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('custom_role_id', customRoleId)
      .eq('status', 'pending');

    return {
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      description: r.description,
      roleKey: r.role_key,
      isActive: r.is_active,
      isArchived: !r.is_active,
      defaultScope: preset.default_scope,
      maxScope: preset.max_scope,
      permissions: (r.role_permissions || []).map((rp: { permission_key: string }) => rp.permission_key),
      assignedMembersCount: memberCount || 0,
      pendingInvitationsCount: inviteCount || 0,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Creates a new business-bound custom role with scope policy enforcement.
   */
  static async createCustomRole(
    actorContext: AuthorizationContext,
    input: CreateCustomRoleInput
  ): Promise<{ success: boolean; message?: string; role?: CustomRoleDetail }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    // 1. Authorize: Actor must have roles.manage or staff.manage
    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError(
        'UNAUTHORIZED',
        'Forbidden. Role management permission (roles.manage) required.'
      );
    }

    const { SubscriptionService } = await import('./subscription.service');
    const limitRes = await SubscriptionService.validateLimit(businessId, 'customRoles');
    if (!limitRes.allowed) {
      throw new AuthorizationContextError(
        'UNAUTHORIZED',
        limitRes.message || `Custom role limit reached (${limitRes.effectiveLimit}). Upgrade your plan to add more custom roles.`
      );
    }

    // 2. Validate Reserved Role Names
    const normalizedName = input.name.trim();
    const normalizedLower = normalizedName.toLowerCase().replace(/[\s_-]+/g, '');
    const reservedTokens = ['businessowner', 'owner', 'branchmanager', 'manager', 'cashier', 'kitchenstaff', 'kitchen', 'waiter', 'superadmin', 'admin'];
    if (reservedTokens.includes(normalizedLower)) {
      throw new AuthorizationContextError(
        'ROLE_RESERVED',
        `Role name "${normalizedName}" is reserved for built-in system roles.`
      );
    }

    // 3. Validate Scope Policy Hierarchy (defaultScope <= maxScope)
    const defaultScope: ScopeType = input.defaultScope || 'PROPERTY';
    const maxScope: ScopeType = input.maxScope || 'PROPERTY';

    if (SCOPE_RANK[defaultScope] > SCOPE_RANK[maxScope]) {
      throw new AuthorizationContextError(
        'ROLE_SCOPE_EXCEEDED',
        `defaultScope (${defaultScope}) cannot exceed maxScope (${maxScope}).`
      );
    }

    // 4. Validate Administrative Reach Ceiling
    if (!actorContext.isBusinessOwner) {
      // Non-owners cannot create ORGANIZATION maxScope roles
      if (maxScope === 'ORGANIZATION') {
        throw new AuthorizationContextError(
          'ROLE_SCOPE_EXCEEDED',
          'Only Business Owners can create roles with ORGANIZATION max scope.'
        );
      }
    }

    // 5. Validate Permission Catalog & Filter Owner-Only Permissions
    const requestedPerms = input.permissions || [];
    for (const p of requestedPerms) {
      if (p.startsWith('super_admin.')) {
        throw new AuthorizationContextError(
          'INVALID_PERMISSION',
          'Super Admin platform permissions cannot be added to tenant custom roles.'
        );
      }
    }

    const safePermissions = actorContext.isBusinessOwner
      ? requestedPerms
      : requestedPerms.filter((p) => !ownerOnlyPermissions.includes(p));

    const roleKey = `custom_${normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

    // 6. Insert custom_roles
    const { data: roleRow, error: roleErr } = await admin
      .from('custom_roles')
      .insert({
        business_id: businessId,
        name: normalizedName,
        description: input.description?.trim() || null,
        role_key: roleKey,
        is_active: true,
        created_by: actorContext.userId,
      })
      .select('*')
      .single();

    if (roleErr || !roleRow) {
      if (roleErr?.code === '23505') {
        throw new AuthorizationContextError(
          'ROLE_NAME_DUPLICATE',
          `A custom role with name "${normalizedName}" already exists in this business.`
        );
      }
      throw new AuthorizationContextError('DATABASE_ERROR', `Failed to create role: ${roleErr?.message}`);
    }

    // 7. Insert role_permissions
    if (safePermissions.length > 0) {
      const inserts = safePermissions.map((p) => ({
        business_id: businessId,
        custom_role_id: roleRow.id,
        permission_key: p,
      }));
      await admin.from('role_permissions').insert(inserts);
    }

    // 8. Insert role_scope_presets
    await admin.from('role_scope_presets').insert({
      business_id: businessId,
      custom_role_id: roleRow.id,
      default_scope: defaultScope,
      max_scope: maxScope,
    });

    // 9. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'custom_role.created',
      target_type: 'custom_role',
      target_id: roleRow.id,
      payload: {
        name: roleRow.name,
        roleKey: roleRow.role_key,
        permissions: safePermissions,
        defaultScope,
        maxScope,
      },
    });

    return {
      success: true,
      message: 'Custom role created successfully.',
      role: {
        id: roleRow.id,
        businessId: roleRow.business_id,
        name: roleRow.name,
        description: roleRow.description,
        roleKey: roleRow.role_key,
        isActive: roleRow.is_active,
        isArchived: false,
        defaultScope,
        maxScope,
        permissions: safePermissions,
        createdBy: roleRow.created_by,
        createdAt: roleRow.created_at,
        updatedAt: roleRow.updated_at,
      },
    };
  }

  /**
   * Updates an existing custom role and its permission/scope configuration.
   */
  static async updateCustomRole(
    actorContext: AuthorizationContext,
    input: UpdateCustomRoleInput
  ): Promise<{ success: boolean; message?: string; role?: CustomRoleDetail }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    // 1. Authorize
    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role management permission required.');
    }

    // 2. Verify target custom role belongs to this business
    const { data: existingRole, error: fetchErr } = await admin
      .from('custom_roles')
      .select('*, role_scope_presets(id, default_scope, max_scope)')
      .eq('id', input.roleId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (fetchErr || !existingRole) {
      throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found in this business.');
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = { updated_at: now };

    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      const reservedNames = ['business_owner', 'owner', 'branch_manager', 'manager', 'cashier', 'kitchen_staff', 'kitchen', 'waiter', 'super_admin', 'admin'];
      if (reservedNames.includes(normalizedName.toLowerCase())) {
        throw new AuthorizationContextError(
          'ROLE_RESERVED',
          `Role name "${normalizedName}" is reserved for built-in system roles.`
        );
      }
      updatePayload.name = normalizedName;
    }

    if (input.description !== undefined) {
      updatePayload.description = input.description?.trim() || null;
    }

    if (input.isActive !== undefined) {
      updatePayload.is_active = input.isActive;
    }

    // 3. Update custom_roles row
    const { error: updateErr } = await admin
      .from('custom_roles')
      .update(updatePayload)
      .eq('id', input.roleId)
      .eq('business_id', businessId);

    if (updateErr) {
      if (updateErr.code === '23505') {
        throw new AuthorizationContextError(
          'ROLE_NAME_DUPLICATE',
          `A custom role with name "${input.name}" already exists in this business.`
        );
      }
      throw new AuthorizationContextError('DATABASE_ERROR', `Failed to update role: ${updateErr.message}`);
    }

    // 4. Update Permissions if provided
    let safePermissions: string[] | undefined;
    if (input.permissions !== undefined) {
      for (const p of input.permissions) {
        if (p.startsWith('super_admin.')) {
          throw new AuthorizationContextError(
            'INVALID_PERMISSION',
            'Super Admin platform permissions cannot be added to tenant custom roles.'
          );
        }
      }

      safePermissions = actorContext.isBusinessOwner
        ? input.permissions
        : input.permissions.filter((p) => !ownerOnlyPermissions.includes(p));

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

    // 5. Update Scope Preset if provided
    let effectiveDefaultScope = input.defaultScope;
    let effectiveMaxScope = input.maxScope;

    const existingPreset = existingRole.role_scope_presets?.[0];
    if (input.defaultScope || input.maxScope) {
      const newDefault = (input.defaultScope || existingPreset?.default_scope || 'PROPERTY') as ScopeType;
      const newMax = (input.maxScope || existingPreset?.max_scope || 'PROPERTY') as ScopeType;

      if (SCOPE_RANK[newDefault] > SCOPE_RANK[newMax]) {
        throw new AuthorizationContextError(
          'ROLE_SCOPE_EXCEEDED',
          `defaultScope (${newDefault}) cannot exceed maxScope (${newMax}).`
        );
      }

      if (!actorContext.isBusinessOwner && newMax === 'ORGANIZATION') {
        throw new AuthorizationContextError(
          'ROLE_SCOPE_EXCEEDED',
          'Only Business Owners can set ORGANIZATION max scope.'
        );
      }

      effectiveDefaultScope = newDefault;
      effectiveMaxScope = newMax;

      if (existingPreset) {
        await admin
          .from('role_scope_presets')
          .update({
            default_scope: newDefault,
            max_scope: newMax,
            updated_at: now,
          })
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

    // 6. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'custom_role.updated',
      target_type: 'custom_role',
      target_id: input.roleId,
      payload: {
        updatedFields: updatePayload,
        permissions: safePermissions,
        defaultScope: effectiveDefaultScope,
        maxScope: effectiveMaxScope,
      },
    });

    const updatedRole = await this.getCustomRoleById(businessId, input.roleId);
    return {
      success: true,
      message: 'Custom role updated successfully.',
      role: updatedRole || undefined,
    };
  }

  /**
   * Replaces the entire permission bundle for a custom role.
   */
  static async setCustomRolePermissions(
    actorContext: AuthorizationContext,
    roleId: string,
    permissions: PermissionKey[]
  ): Promise<{ success: boolean; permissions: string[] }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role management permission required.');
    }

    const { data: role } = await admin
      .from('custom_roles')
      .select('id, name')
      .eq('id', roleId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!role) {
      throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found.');
    }

    for (const p of permissions) {
      if (p.startsWith('super_admin.')) {
        throw new AuthorizationContextError(
          'INVALID_PERMISSION',
          'Super Admin platform permissions cannot be added to tenant custom roles.'
        );
      }
    }

    const safePermissions = actorContext.isBusinessOwner
      ? permissions
      : permissions.filter((p) => !ownerOnlyPermissions.includes(p));

    await admin.from('role_permissions').delete().eq('custom_role_id', roleId);

    if (safePermissions.length > 0) {
      const inserts = safePermissions.map((p) => ({
        business_id: businessId,
        custom_role_id: roleId,
        permission_key: p,
      }));
      await admin.from('role_permissions').insert(inserts);
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'custom_role.permissions_updated',
      target_type: 'custom_role',
      target_id: roleId,
      payload: { roleName: role.name, permissions: safePermissions },
    });

    return { success: true, permissions: safePermissions };
  }

  /**
   * Clones an existing built-in or custom role into a new tenant custom role.
   */
  static async cloneRole(
    actorContext: AuthorizationContext,
    input: CloneRoleInput
  ): Promise<{ success: boolean; message?: string; role?: CustomRoleDetail }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role management permission required.');
    }

    let sourcePermissions: string[] = [];
    let sourceDefaultScope: ScopeType = 'PROPERTY';
    let sourceMaxScope: ScopeType = 'PROPERTY';

    if (input.sourceType === 'built_in') {
      const builtInKey = input.sourceRoleKey as BuiltInRoleKey;
      const template = BUILT_IN_ROLE_TEMPLATES[builtInKey];
      if (!template) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', `Built-in role "${input.sourceRoleKey}" not found.`);
      }

      // Fetch built-in permissions
      const { data: perms } = await admin
        .from('role_permissions')
        .select('permission_key')
        .eq('role_key', builtInKey)
        .is('business_id', null);

      sourcePermissions = (perms || []).map((p) => p.permission_key);
      sourceDefaultScope = template.defaultScope;
      sourceMaxScope = template.maxScope;
    } else {
      const sourceRole = await this.getCustomRoleById(businessId, input.sourceCustomRoleId!);
      if (!sourceRole) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Source custom role not found in this business.');
      }
      sourcePermissions = sourceRole.permissions;
      sourceDefaultScope = sourceRole.defaultScope;
      sourceMaxScope = sourceRole.maxScope;
    }

    // Determine target scopes (override if specified in input)
    let targetDefaultScope = input.defaultScope || sourceDefaultScope;
    let targetMaxScope = input.maxScope || sourceMaxScope;

    // Non-owner actor ceiling: cap maxScope and defaultScope at PROPERTY if actor is not Business Owner
    if (!actorContext.isBusinessOwner) {
      if (targetMaxScope === 'ORGANIZATION') {
        targetMaxScope = 'PROPERTY';
      }
      if (targetDefaultScope === 'ORGANIZATION') {
        targetDefaultScope = 'PROPERTY';
      }
    }

    // Filter owner-only permissions if actor is not Business Owner
    const safePermissions = actorContext.isBusinessOwner
      ? sourcePermissions
      : sourcePermissions.filter((p) => !ownerOnlyPermissions.includes(p as PermissionKey));

    // Create new role via createCustomRole to enforce all naming and reach rules
    const cloneResult = await this.createCustomRole(actorContext, {
      name: input.name,
      description: input.description || `Cloned from ${input.sourceRoleKey || 'custom role'}`,
      permissions: safePermissions as PermissionKey[],
      defaultScope: targetDefaultScope,
      maxScope: targetMaxScope,
    });

    if (cloneResult.success && cloneResult.role) {
      await admin.from('audit_logs').insert({
        business_id: businessId,
        actor_id: actorContext.userId,
        action: 'custom_role.cloned',
        target_type: 'custom_role',
        target_id: cloneResult.role.id,
        payload: {
          sourceType: input.sourceType,
          sourceRoleKey: input.sourceRoleKey,
          sourceCustomRoleId: input.sourceCustomRoleId,
          name: input.name,
          permissionsCount: safePermissions.length,
        },
      });
    }

    return cloneResult;
  }

  /**
   * Queries role usage metrics across active members, pending invitations, and scope grants.
   */
  static async getRoleUsage(
    actorContext: AuthorizationContext,
    input: RoleUsageQueryInput
  ): Promise<RoleUsageInfo> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (input.customRoleId) {
      const role = await this.getCustomRoleById(businessId, input.customRoleId);
      if (!role) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found.');
      }

      const { count: memberCount } = await admin
        .from('business_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('custom_role_id', input.customRoleId)
        .eq('membership_status', 'active');

      const { count: inviteCount } = await admin
        .from('staff_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('custom_role_id', input.customRoleId)
        .eq('status', 'pending');

      const { count: grantCount } = await admin
        .from('permission_scope_grants')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('custom_role_id', input.customRoleId);

      const activeMembers = memberCount || 0;
      const pendingInvitations = inviteCount || 0;
      const scopeGrants = grantCount || 0;

      return {
        roleIdentifier: input.customRoleId,
        isCustomRole: true,
        customRoleId: input.customRoleId,
        name: role.name,
        isActive: role.isActive,
        activeMembers,
        pendingInvitations,
        scopeGrants,
        canSafelyArchive: activeMembers === 0 && pendingInvitations === 0,
        canSafelyDelete: activeMembers === 0 && pendingInvitations === 0 && scopeGrants === 0,
      };
    } else {
      const roleKey = input.roleKey!;
      const template = BUILT_IN_ROLE_TEMPLATES[roleKey as BuiltInRoleKey];
      const roleName = template?.displayName || roleKey;

      const { count: memberCount } = await admin
        .from('business_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('role', roleKey)
        .eq('membership_status', 'active');

      const { count: inviteCount } = await admin
        .from('staff_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('assigned_role', roleKey)
        .eq('status', 'pending');

      const { count: grantCount } = await admin
        .from('permission_scope_grants')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('role_key', roleKey);

      return {
        roleIdentifier: roleKey,
        isCustomRole: false,
        roleKey,
        name: roleName,
        isActive: true,
        activeMembers: memberCount || 0,
        pendingInvitations: inviteCount || 0,
        scopeGrants: grantCount || 0,
        canSafelyArchive: false, // Built-in roles cannot be archived
        canSafelyDelete: false, // Built-in roles cannot be deleted
      };
    }
  }

  /**
   * Safely archives a custom role with in-use protection or atomic reassignment.
   */
  static async archiveCustomRole(
    actorContext: AuthorizationContext,
    input: ArchiveCustomRoleInput
  ): Promise<{ success: boolean; message: string; reassignedCount?: number }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role management permission required.');
    }

    const role = await this.getCustomRoleById(businessId, input.roleId);
    if (!role) {
      throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found.');
    }

    // 1. Check Usage
    const usage = await this.getRoleUsage(actorContext, { customRoleId: input.roleId });

    let reassignedCount = 0;
    if (usage.activeMembers > 0) {
      // If reassignment target is provided, reassign members
      if (input.reassignToRoleKey || input.reassignToCustomRoleId) {
        const reassignRes = await this.reassignRoleMembers(actorContext, {
          fromCustomRoleId: input.roleId,
          toRoleKey: input.reassignToRoleKey,
          toCustomRoleId: input.reassignToCustomRoleId,
        });
        reassignedCount = reassignRes.reassignedCount;
      } else {
        throw new AuthorizationContextError(
          'ROLE_IN_USE',
          `Cannot archive custom role "${role.name}" because it is currently assigned to ${usage.activeMembers} active member(s). Specify a reassignment target first.`,
          { usage }
        );
      }
    }

    // 2. Set is_active = false
    const now = new Date().toISOString();
    await admin
      .from('custom_roles')
      .update({ is_active: false, updated_at: now })
      .eq('id', input.roleId)
      .eq('business_id', businessId);

    // 3. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'custom_role.archived',
      target_type: 'custom_role',
      target_id: input.roleId,
      payload: {
        roleName: role.name,
        reassignedMembers: reassignedCount,
        reassignedTo: input.reassignToRoleKey || input.reassignToCustomRoleId || null,
      },
    });

    return {
      success: true,
      message: `Custom role "${role.name}" has been archived successfully.`,
      reassignedCount,
    };
  }

  /**
   * Restores an archived custom role to active status.
   */
  static async restoreCustomRole(
    actorContext: AuthorizationContext,
    input: RestoreCustomRoleInput
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role management permission required.');
    }

    const { data: role } = await admin
      .from('custom_roles')
      .select('id, name, is_active')
      .eq('id', input.roleId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!role) {
      throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found.');
    }

    const now = new Date().toISOString();
    await admin
      .from('custom_roles')
      .update({ is_active: true, updated_at: now })
      .eq('id', input.roleId)
      .eq('business_id', businessId);

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'custom_role.restored',
      target_type: 'custom_role',
      target_id: input.roleId,
      payload: { roleName: role.name },
    });

    return {
      success: true,
      message: `Custom role "${role.name}" has been restored to active status.`,
    };
  }

  /**
   * Atomically reassigns members from one role to another within a business.
   */
  static async reassignRoleMembers(
    actorContext: AuthorizationContext,
    input: ReassignRoleMembersInput
  ): Promise<{ success: boolean; reassignedCount: number; message: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    const canManage =
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.role.assign' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canManage) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role assignment permission required.');
    }

    // 1. Validate Target Role
    let targetBuiltInRole = input.toRoleKey;
    const targetCustomRoleId = input.toCustomRoleId || null;

    if (targetCustomRoleId) {
      const targetRole = await this.getCustomRoleById(businessId, targetCustomRoleId);
      if (!targetRole || !targetRole.isActive) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Target custom role is inactive or not found.');
      }
      targetBuiltInRole = targetBuiltInRole || 'waiter'; // Fallback base role for custom role
    } else if (targetBuiltInRole) {
      if (!BUILT_IN_ROLE_TEMPLATES[targetBuiltInRole as BuiltInRoleKey]) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', `Invalid target role key "${targetBuiltInRole}".`);
      }
      if (targetBuiltInRole === 'business_owner' && !actorContext.isBusinessOwner) {
        throw new AuthorizationContextError('OWNER_ROLE_PROTECTED', 'Only Business Owners can reassign members to Business Owner.');
      }
    }

    // 2. Select Members to Reassign
    let memberQuery = admin
      .from('business_memberships')
      .select('id, user_id, role, custom_role_id')
      .eq('business_id', businessId)
      .eq('membership_status', 'active');

    if (input.fromCustomRoleId) {
      memberQuery = memberQuery.eq('custom_role_id', input.fromCustomRoleId);
    } else if (input.fromRoleKey) {
      memberQuery = memberQuery.eq('role', input.fromRoleKey).is('custom_role_id', null);
    }

    const { data: membersToMove, error: selectErr } = await memberQuery;
    if (selectErr || !membersToMove || membersToMove.length === 0) {
      return { success: true, reassignedCount: 0, message: 'No active members found to reassign.' };
    }

    // 3. Prevent modifying active Business Owners
    const safeMembers = membersToMove.filter((m) => m.role !== 'business_owner');
    if (safeMembers.length === 0) {
      return { success: true, reassignedCount: 0, message: 'Cannot reassign Business Owners.' };
    }

    const memberIds = safeMembers.map((m) => m.id);
    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('business_memberships')
      .update({
        role: targetBuiltInRole,
        custom_role_id: targetCustomRoleId,
        updated_at: now,
      })
      .in('id', memberIds);

    if (updateErr) {
      throw new AuthorizationContextError('DATABASE_ERROR', `Failed to reassign members: ${updateErr.message}`);
    }

    // 4. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'role_members.reassigned',
      target_type: 'business_memberships',
      target_id: businessId,
      payload: {
        reassignedMemberIds: memberIds,
        fromCustomRoleId: input.fromCustomRoleId || null,
        fromRoleKey: input.fromRoleKey || null,
        toRoleKey: targetBuiltInRole,
        toCustomRoleId: targetCustomRoleId,
        count: safeMembers.length,
      },
    });

    return {
      success: true,
      reassignedCount: safeMembers.length,
      message: `Successfully reassigned ${safeMembers.length} member(s).`,
    };
  }

  /**
   * Authoritatively updates an individual member's role with privilege escalation & owner safeguards.
   */
  static async assignMemberRole(
    actorContext: AuthorizationContext,
    input: AssignMemberRoleInput
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    // 1. Authorize: Actor must have staff.role.assign or roles.manage or staff.manage
    const canAssign =
      (await can({ context: actorContext, permission: 'staff.role.assign' })) ||
      (await can({ context: actorContext, permission: 'roles.manage' })) ||
      (await can({ context: actorContext, permission: 'staff.manage' }));

    if (!canAssign) {
      throw new AuthorizationContextError('UNAUTHORIZED', 'Forbidden. Role assignment permission required.');
    }

    // 2. Fetch target membership
    const { data: targetMem, error: fetchErr } = await admin
      .from('business_memberships')
      .select('id, user_id, role, custom_role_id, business_id, membership_status')
      .eq('id', input.membershipId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (fetchErr || !targetMem) {
      throw new AuthorizationContextError('RESOURCE_NOT_FOUND', 'Target business membership not found.');
    }

    // 3. Owner Protection: Target is currently business_owner
    if (targetMem.role === 'business_owner') {
      if (!actorContext.isBusinessOwner) {
        throw new AuthorizationContextError(
          'OWNER_ROLE_PROTECTED',
          'Cannot demote or modify the Business Owner role.'
        );
      }

      if (input.builtInRole && input.builtInRole !== 'business_owner') {
        const { count: ownerCount } = await admin
          .from('business_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('role', 'business_owner')
          .eq('membership_status', 'active');

        if ((ownerCount || 0) <= 1) {
          throw new AuthorizationContextError(
            'OWNER_ROLE_PROTECTED',
            'Cannot demote the last Business Owner of a business. Transfer ownership or assign another owner first.'
          );
        }
      }
    }

    // 4. Owner Protection: Attempting to assign business_owner
    if (input.builtInRole === 'business_owner') {
      if (!actorContext.isBusinessOwner) {
        throw new AuthorizationContextError(
          'OWNER_ROLE_PROTECTED',
          'Only existing Business Owners can assign the Business Owner role.'
        );
      }
    }

    // 5. Self-Escalation Prevention: Non-owner cannot modify their own role to escalate
    if (targetMem.user_id === actorContext.userId && !actorContext.isBusinessOwner) {
      throw new AuthorizationContextError(
        'SELF_ESCALATION_DENIED',
        'Self-role modification is prohibited to prevent privilege escalation.'
      );
    }

    // 6. Validate Custom Role if provided
    const newBuiltInRole = input.builtInRole || targetMem.role;
    const newCustomRoleId = input.customRoleId || null;

    if (input.customRoleId) {
      const customRole = await this.getCustomRoleById(businessId, input.customRoleId);
      if (!customRole) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found in this business.');
      }
      if (!customRole.isActive) {
        throw new AuthorizationContextError('ROLE_ARCHIVED', 'Cannot assign an archived custom role.');
      }

      // Check Administrative Reach vs Custom Role Max Scope
      if (!actorContext.isBusinessOwner) {
        if (customRole.maxScope === 'ORGANIZATION') {
          throw new AuthorizationContextError(
            'ROLE_SCOPE_EXCEEDED',
            'Cannot assign a custom role with ORGANIZATION max scope.'
          );
        }
      }
    } else if (input.builtInRole) {
      if (!BUILT_IN_ROLE_TEMPLATES[input.builtInRole as BuiltInRoleKey]) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', `Invalid built-in role key "${input.builtInRole}".`);
      }
      // Non-owners cannot assign ORGANIZATION max scope roles (e.g. business_owner)
      const template = BUILT_IN_ROLE_TEMPLATES[input.builtInRole as BuiltInRoleKey];
      if (!actorContext.isBusinessOwner && template.maxScope === 'ORGANIZATION') {
        throw new AuthorizationContextError(
          'ROLE_SCOPE_EXCEEDED',
          'Cannot assign a role with ORGANIZATION max scope.'
        );
      }
    }

    // 7. Update business_memberships row
    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from('business_memberships')
      .update({
        role: newBuiltInRole,
        custom_role_id: newCustomRoleId,
        updated_at: now,
      })
      .eq('id', targetMem.id)
      .eq('business_id', businessId);

    if (updateErr) {
      throw new AuthorizationContextError('DATABASE_ERROR', `Failed to update member role: ${updateErr.message}`);
    }

    // 8. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'member_role.changed',
      target_type: 'business_membership',
      target_id: targetMem.id,
      payload: {
        previousRole: targetMem.role,
        previousCustomRoleId: targetMem.custom_role_id,
        newRole: newBuiltInRole,
        newCustomRoleId: newCustomRoleId,
      },
    });

    return {
      success: true,
      message: 'Member role updated successfully.',
    };
  }

  /**
   * Generates a preview of effective access capabilities for a built-in or custom role.
   */
  static async previewRoleEffectiveAccess(
    actorContext: AuthorizationContext,
    identifier: { roleKey?: string; customRoleId?: string }
  ): Promise<RoleEffectiveAccessSummary> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (identifier.customRoleId) {
      const customRole = await this.getCustomRoleById(businessId, identifier.customRoleId);
      if (!customRole) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', 'Custom role not found.');
      }

      // Fetch permission details
      const { data: permDetails } = await admin
        .from('permissions')
        .select('key, name, category, risk_level')
        .in('key', customRole.permissions);

      const { count: grantCount } = await admin
        .from('permission_scope_grants')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('custom_role_id', identifier.customRoleId);

      return {
        roleSource: 'custom',
        customRoleId: customRole.id,
        displayName: customRole.name,
        description: customRole.description,
        defaultScope: customRole.defaultScope,
        maxScope: customRole.maxScope,
        isProtected: false,
        isArchived: customRole.isArchived,
        permissions: (permDetails || []).map((p) => ({
          key: p.key,
          name: p.name,
          category: p.category,
          riskLevel: p.risk_level,
        })),
        scopePreset: {
          defaultScope: customRole.defaultScope,
          maxScope: customRole.maxScope,
        },
        concreteGrantsCount: grantCount || 0,
      };
    } else {
      const roleKey = (identifier.roleKey || 'waiter') as BuiltInRoleKey;
      const template = BUILT_IN_ROLE_TEMPLATES[roleKey];
      if (!template) {
        throw new AuthorizationContextError('ROLE_NOT_FOUND', `Built-in role "${roleKey}" not found.`);
      }

      const { data: rp } = await admin
        .from('role_permissions')
        .select('permission_key')
        .eq('role_key', roleKey)
        .is('business_id', null);

      const permKeys = (rp || []).map((p) => p.permission_key);
      const { data: permDetails } = await admin
        .from('permissions')
        .select('key, name, category, risk_level')
        .in('key', permKeys);

      const { count: grantCount } = await admin
        .from('permission_scope_grants')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('role_key', roleKey);

      return {
        roleSource: 'built_in',
        roleKey,
        displayName: template.displayName,
        description: template.description,
        defaultScope: template.defaultScope,
        maxScope: template.maxScope,
        isProtected: template.isProtected,
        isArchived: false,
        permissions: (permDetails || []).map((p) => ({
          key: p.key,
          name: p.name,
          category: p.category,
          riskLevel: p.risk_level,
        })),
        scopePreset: {
          defaultScope: template.defaultScope,
          maxScope: template.maxScope,
        },
        concreteGrantsCount: grantCount || 0,
      };
    }
  }
}

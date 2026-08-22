import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import {
  ScopeType,
  GrantEffect,
  GrantSource,
  ScopeGrantDetail,
  RoleScopePresetDetail,
  EffectiveAccessPreview,
  AuthorizationContext,
} from '@/types/authorization.types';
import {
  CreateScopeGrantInput,
  UpdateScopeGrantInput,
  UpdateRoleScopePresetInput,
} from '@/lib/validation/permission';
import {
  validateScopeTarget,
  validateMaxScope,
  validateAdministrativeReach,
} from '@/server/auth/scope-target-validator';
import { AuthorizationContextError } from '@/server/auth/errors';

export class ScopeGrantService {
  /**
   * Lists permission scope grants matching criteria for a business.
   */
  static async listScopeGrants(params: {
    businessId: string;
    roleKey?: string | null;
    customRoleId?: string | null;
    businessMembershipId?: string | null;
    scopeType?: ScopeType;
    permissionKey?: string;
  }): Promise<ScopeGrantDetail[]> {
    const admin = createAdminClient();

    let query = admin
      .from('permission_scope_grants')
      .select(`
        *,
        custom_roles(name),
        business_memberships(user_id, role),
        branches(name),
        organization_departments(name),
        organization_units(name),
        service_areas(name),
        permissions(name)
      `)
      .or(`business_id.eq.${params.businessId},business_id.is.null`);

    if (params.roleKey) {
      query = query.eq('role_key', params.roleKey);
    }
    if (params.customRoleId) {
      query = query.eq('custom_role_id', params.customRoleId);
    }
    if (params.businessMembershipId) {
      query = query.eq('business_membership_id', params.businessMembershipId);
    }
    if (params.scopeType) {
      query = query.eq('scope_type', params.scopeType);
    }
    if (params.permissionKey) {
      query = query.eq('permission_key', params.permissionKey);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    interface GrantJoinRow {
      id: string;
      business_id: string | null;
      role_key: string | null;
      custom_role_id: string | null;
      business_membership_id: string | null;
      permission_key: string;
      effect: string;
      scope_type: string;
      branch_id: string | null;
      department_id: string | null;
      organization_unit_id: string | null;
      service_area_id: string | null;
      grant_source: string;
      source_id: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      custom_roles?: { name: string } | null;
      business_memberships?: { user_id: string; role: string } | null;
      branches?: { name: string } | null;
      organization_departments?: { name: string } | null;
      organization_units?: { name: string } | null;
      service_areas?: { name: string } | null;
      permissions?: { name: string } | null;
    }

    return (data as unknown as GrantJoinRow[]).map((r) => ({
      id: r.id,
      businessId: r.business_id,
      roleKey: r.role_key,
      customRoleId: r.custom_role_id,
      customRoleName: r.custom_roles?.name || null,
      businessMembershipId: r.business_membership_id,
      permissionKey: r.permission_key,
      permissionName: r.permissions?.name || r.permission_key,
      effect: r.effect as GrantEffect,
      scopeType: r.scope_type as ScopeType,
      branchId: r.branch_id,
      branchName: r.branches?.name || null,
      departmentId: r.department_id,
      departmentName: r.organization_departments?.name || null,
      organizationUnitId: r.organization_unit_id,
      organizationUnitName: r.organization_units?.name || null,
      serviceAreaId: r.service_area_id,
      serviceAreaName: r.service_areas?.name || null,
      grantSource: r.grant_source as GrantSource,
      sourceId: r.source_id,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Fetches a single scope grant by ID.
   */
  static async getScopeGrantById(businessId: string, grantId: string): Promise<ScopeGrantDetail | null> {
    const grants = await this.listScopeGrants({ businessId });
    return grants.find((g) => g.id === grantId) || null;
  }

  /**
   * Creates a concrete permission scope grant after validating scope target,
   * max scope rank, principal authenticity, and actor administrative reach.
   */
  static async createScopeGrant(
    actorContext: AuthorizationContext,
    input: CreateScopeGrantInput
  ): Promise<{ success: boolean; grant?: ScopeGrantDetail; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    // 1. Verify Permission Existence & Platform Isolation
    if (input.permissionKey.startsWith('super_admin.')) {
      throw new AuthorizationContextError(
        'INVALID_PERMISSION',
        'Cannot grant Super Admin platform permissions inside tenant RBAC.'
      );
    }

    const { data: permExists } = await admin
      .from('permissions')
      .select('key, name')
      .eq('key', input.permissionKey)
      .maybeSingle();

    if (!permExists) {
      throw new AuthorizationContextError('INVALID_PERMISSION', `Permission not found: ${input.permissionKey}`);
    }

    // 2. Validate Principal & Determine Target Max Scope
    let targetMaxScope: ScopeType = 'ORGANIZATION';

    if (input.roleKey) {
      if (input.roleKey === 'super_admin') {
        throw new AuthorizationContextError(
          'INVALID_PERMISSION',
          'Cannot create grants for super_admin role key in tenant RBAC.'
        );
      }

      // Lookup preset for built-in role
      const { data: preset } = await admin
        .from('role_scope_presets')
        .select('default_scope, max_scope')
        .eq('role_key', input.roleKey)
        .or(`business_id.eq.${businessId},business_id.is.null`)
        .order('business_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      targetMaxScope = (preset?.max_scope as ScopeType) || 'PROPERTY';
    } else if (input.customRoleId) {
      const { data: customRole } = await admin
        .from('custom_roles')
        .select('id, business_id')
        .eq('id', input.customRoleId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!customRole) {
        throw new AuthorizationContextError(
          'RESOURCE_NOT_FOUND',
          `Custom role not found or belongs to another business: ${input.customRoleId}`
        );
      }

      const { data: preset } = await admin
        .from('role_scope_presets')
        .select('default_scope, max_scope')
        .eq('custom_role_id', input.customRoleId)
        .eq('business_id', businessId)
        .maybeSingle();

      targetMaxScope = (preset?.max_scope as ScopeType) || 'ORGANIZATION';
    } else if (input.businessMembershipId) {
      const { data: membership } = await admin
        .from('business_memberships')
        .select('id, business_id, role, membership_status, custom_role_id')
        .eq('id', input.businessMembershipId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!membership) {
        throw new AuthorizationContextError(
          'RESOURCE_NOT_FOUND',
          `Business membership not found or belongs to another business: ${input.businessMembershipId}`
        );
      }

      if (membership.membership_status !== 'active') {
        throw new AuthorizationContextError(
          'MEMBERSHIP_INACTIVE',
          `Cannot create grants for inactive membership: ${input.businessMembershipId}`
        );
      }

      if (membership.role === 'business_owner') {
        targetMaxScope = 'ORGANIZATION';
      } else if (membership.custom_role_id) {
        const { data: preset } = await admin
          .from('role_scope_presets')
          .select('max_scope')
          .eq('custom_role_id', membership.custom_role_id)
          .eq('business_id', businessId)
          .maybeSingle();
        targetMaxScope = (preset?.max_scope as ScopeType) || 'ORGANIZATION';
      } else {
        const { data: preset } = await admin
          .from('role_scope_presets')
          .select('max_scope')
          .eq('role_key', membership.role)
          .or(`business_id.eq.${businessId},business_id.is.null`)
          .order('business_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        targetMaxScope = (preset?.max_scope as ScopeType) || 'PROPERTY';
      }
    }

    // 3. Validate Scope Target Integrity
    const targetValidation = await validateScopeTarget({
      businessId,
      scopeType: input.scopeType,
      branchId: input.branchId,
      departmentId: input.departmentId,
      organizationUnitId: input.organizationUnitId,
      serviceAreaId: input.serviceAreaId,
    });

    // 4. Validate Max Scope Rank
    validateMaxScope(targetMaxScope, input.scopeType);

    // 5. Validate Actor Administrative Reach & Anti-Escalation
    validateAdministrativeReach({
      actorContext,
      requestedScope: input.scopeType,
      targetBranchId: targetValidation.branchId,
      targetDepartmentId: targetValidation.departmentId,
      targetOrganizationUnitId: targetValidation.organizationUnitId,
      targetServiceAreaId: targetValidation.serviceAreaId,
      permissionKey: input.permissionKey,
    });

    // 6. Check for semantic duplicate or opposite-effect grant
    let duplicateQuery = admin
      .from('permission_scope_grants')
      .select('id, effect')
      .eq('permission_key', input.permissionKey)
      .eq('scope_type', input.scopeType);

    if (input.roleKey) {
      duplicateQuery = duplicateQuery.eq('role_key', input.roleKey).eq('business_id', businessId);
    } else if (input.customRoleId) {
      duplicateQuery = duplicateQuery.eq('custom_role_id', input.customRoleId).eq('business_id', businessId);
    } else if (input.businessMembershipId) {
      duplicateQuery = duplicateQuery
        .eq('business_membership_id', input.businessMembershipId)
        .eq('business_id', businessId);
    }

    if (targetValidation.branchId) {
      duplicateQuery = duplicateQuery.eq('branch_id', targetValidation.branchId);
    }
    if (targetValidation.departmentId) {
      duplicateQuery = duplicateQuery.eq('department_id', targetValidation.departmentId);
    }
    if (targetValidation.organizationUnitId) {
      duplicateQuery = duplicateQuery.eq('organization_unit_id', targetValidation.organizationUnitId);
    }
    if (targetValidation.serviceAreaId) {
      duplicateQuery = duplicateQuery.eq('service_area_id', targetValidation.serviceAreaId);
    }

    const { data: existingGrants } = await duplicateQuery.limit(1).maybeSingle();

    const now = new Date().toISOString();

    if (existingGrants) {
      // If same effect exists, update timestamp and return
      if (existingGrants.effect === input.effect) {
        await admin
          .from('permission_scope_grants')
          .update({ updated_at: now })
          .eq('id', existingGrants.id);

        const updated = await this.getScopeGrantById(businessId, existingGrants.id);
        return { success: true, grant: updated || undefined, message: 'Existing scope grant refreshed.' };
      }

      // If opposite effect, update to new effect
      const { error: updateErr } = await admin
        .from('permission_scope_grants')
        .update({
          effect: input.effect,
          updated_at: now,
        })
        .eq('id', existingGrants.id);

      if (updateErr) {
        throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to update grant: ${updateErr.message}`);
      }

      await admin.from('audit_logs').insert({
        business_id: businessId,
        actor_id: actorContext.userId,
        action: 'scope_grant.updated',
        target_type: 'permission_scope_grant',
        target_id: existingGrants.id,
        payload: {
          permissionKey: input.permissionKey,
          scopeType: input.scopeType,
          oldEffect: existingGrants.effect,
          newEffect: input.effect,
        },
      });

      const updated = await this.getScopeGrantById(businessId, existingGrants.id);
      return { success: true, grant: updated || undefined, message: 'Scope grant effect updated.' };
    }

    const isValidUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // 7. Insert New Scope Grant
    const { data: newGrant, error: insertErr } = await admin
      .from('permission_scope_grants')
      .insert({
        business_id: businessId,
        role_key: input.roleKey || null,
        custom_role_id: input.customRoleId || null,
        business_membership_id: input.businessMembershipId || null,
        permission_key: input.permissionKey,
        effect: (input.effect ? String(input.effect).toLowerCase() : 'allow') as GrantEffect,
        scope_type: input.scopeType,
        branch_id: targetValidation.branchId,
        department_id: targetValidation.departmentId,
        organization_unit_id: targetValidation.organizationUnitId,
        service_area_id: targetValidation.serviceAreaId,
        grant_source: input.grantSource || 'role_preset',
        source_id: input.sourceId || null,
        created_by: isValidUuid(actorContext.userId) ? actorContext.userId : null,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (insertErr || !newGrant) {
      throw new AuthorizationContextError(
        'INVALID_PERMISSION',
        `Failed to persist permission scope grant: ${insertErr?.message || 'Unknown database error'}`
      );
    }

    // 8. Audit Record
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'scope_grant.created',
      target_type: 'permission_scope_grant',
      target_id: newGrant.id,
      payload: {
        permissionKey: input.permissionKey,
        effect: input.effect,
        scopeType: input.scopeType,
        roleKey: input.roleKey,
        customRoleId: input.customRoleId,
        businessMembershipId: input.businessMembershipId,
        targetDisplay: targetValidation.targetDisplay,
      },
    });

    const grantDetail = await this.getScopeGrantById(businessId, newGrant.id);
    return { success: true, grant: grantDetail || undefined, message: 'Scope grant created successfully.' };
  }

  /**
   * Updates an existing permission scope grant.
   */
  static async updateScopeGrant(
    actorContext: AuthorizationContext,
    input: UpdateScopeGrantInput
  ): Promise<{ success: boolean; grant?: ScopeGrantDetail; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    const { data: existing, error } = await admin
      .from('permission_scope_grants')
      .select('*')
      .eq('id', input.grantId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error || !existing) {
      throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Scope grant not found: ${input.grantId}`);
    }

    const targetScopeType = input.scopeType || existing.scope_type;

    const targetValidation = await validateScopeTarget({
      businessId,
      scopeType: targetScopeType,
      branchId: input.branchId !== undefined ? input.branchId : existing.branch_id,
      departmentId: input.departmentId !== undefined ? input.departmentId : existing.department_id,
      organizationUnitId: input.organizationUnitId !== undefined ? input.organizationUnitId : existing.organization_unit_id,
      serviceAreaId: input.serviceAreaId !== undefined ? input.serviceAreaId : existing.service_area_id,
    });

    validateAdministrativeReach({
      actorContext,
      requestedScope: targetScopeType,
      targetBranchId: targetValidation.branchId,
      targetDepartmentId: targetValidation.departmentId,
      targetOrganizationUnitId: targetValidation.organizationUnitId,
      targetServiceAreaId: targetValidation.serviceAreaId,
      permissionKey: existing.permission_key,
    });

    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('permission_scope_grants')
      .update({
        effect: (input.effect ? String(input.effect).toLowerCase() : existing.effect) as GrantEffect,
        scope_type: targetScopeType,
        branch_id: targetValidation.branchId,
        department_id: targetValidation.departmentId,
        organization_unit_id: targetValidation.organizationUnitId,
        service_area_id: targetValidation.serviceAreaId,
        updated_at: now,
      })
      .eq('id', input.grantId);

    if (updateErr) {
      throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to update scope grant: ${updateErr.message}`);
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'scope_grant.updated',
      target_type: 'permission_scope_grant',
      target_id: input.grantId,
      payload: {
        permissionKey: existing.permission_key,
        oldScopeType: existing.scope_type,
        newScopeType: targetScopeType,
        targetDisplay: targetValidation.targetDisplay,
      },
    });

    const updated = await this.getScopeGrantById(businessId, input.grantId);
    return { success: true, grant: updated || undefined, message: 'Scope grant updated successfully.' };
  }

  /**
   * Revokes (deletes) a permission scope grant.
   */
  static async revokeScopeGrant(
    actorContext: AuthorizationContext,
    grantId: string
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    const { data: existing, error } = await admin
      .from('permission_scope_grants')
      .select('*')
      .eq('id', grantId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error || !existing) {
      throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Scope grant not found: ${grantId}`);
    }

    validateAdministrativeReach({
      actorContext,
      requestedScope: existing.scope_type,
      targetBranchId: existing.branch_id,
      targetDepartmentId: existing.department_id,
      targetOrganizationUnitId: existing.organization_unit_id,
      targetServiceAreaId: existing.service_area_id,
      permissionKey: existing.permission_key,
    });

    const { error: deleteErr } = await admin
      .from('permission_scope_grants')
      .delete()
      .eq('id', grantId)
      .eq('business_id', businessId);

    if (deleteErr) {
      throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to revoke scope grant: ${deleteErr.message}`);
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: actorContext.userId,
      action: 'scope_grant.revoked',
      target_type: 'permission_scope_grant',
      target_id: grantId,
      payload: {
        permissionKey: existing.permission_key,
        scopeType: existing.scope_type,
        roleKey: existing.role_key,
        customRoleId: existing.custom_role_id,
        businessMembershipId: existing.business_membership_id,
      },
    });

    return { success: true, message: 'Scope grant revoked successfully.' };
  }

  /**
   * Lists role scope presets for a business (including global built-in defaults).
   */
  static async listRoleScopePresets(businessId: string): Promise<RoleScopePresetDetail[]> {
    const admin = createAdminClient();

    const { data: presets, error } = await admin
      .from('role_scope_presets')
      .select(`
        *,
        custom_roles(name)
      `)
      .or(`business_id.eq.${businessId},business_id.is.null`)
      .order('business_id', { ascending: false, nullsFirst: false });

    if (error || !presets) {
      return [];
    }

    interface PresetJoinRow {
      id: string;
      business_id: string | null;
      role_key: string | null;
      custom_role_id: string | null;
      default_scope: string;
      max_scope: string;
      created_at: string;
      updated_at: string;
      custom_roles?: { name: string } | null;
    }

    return (presets as unknown as PresetJoinRow[]).map((p) => ({
      id: p.id,
      businessId: p.business_id,
      roleKey: p.role_key,
      roleName: p.role_key ? p.role_key.replace('_', ' ') : null,
      customRoleId: p.custom_role_id,
      customRoleName: p.custom_roles?.name || null,
      defaultScope: p.default_scope as ScopeType,
      maxScope: p.max_scope as ScopeType,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      isSystemProtected: p.role_key === 'business_owner' || p.business_id === null,
    }));
  }

  /**
   * Updates or overrides a role scope preset for a tenant.
   * Built-in role presets create a tenant-specific row to protect global defaults.
   */
  static async updateRoleScopePreset(
    actorContext: AuthorizationContext,
    input: UpdateRoleScopePresetInput
  ): Promise<{ success: boolean; preset?: RoleScopePresetDetail; message?: string }> {
    const admin = createAdminClient();
    const businessId = actorContext.businessId;

    if (!businessId) {
      throw new AuthorizationContextError('TENANT_MISMATCH', 'Business context required.');
    }

    if (!actorContext.isBusinessOwner && !actorContext.rolePermissions.includes('roles.manage')) {
      throw new AuthorizationContextError('PERMISSION_DENIED', 'Forbidden. roles.manage permission required.');
    }

    if (input.roleKey === 'business_owner' && input.maxScope !== 'ORGANIZATION') {
      throw new AuthorizationContextError('INVALID_PERMISSION', 'Business Owner max scope must remain ORGANIZATION.');
    }

    const now = new Date().toISOString();

    if (input.roleKey) {
      const { data, error } = await admin
        .from('role_scope_presets')
        .upsert(
          {
            business_id: businessId,
            role_key: input.roleKey,
            custom_role_id: null,
            default_scope: input.defaultScope,
            max_scope: input.maxScope,
            updated_at: now,
          },
          { onConflict: 'business_id,role_key' }
        )
        .select('id')
        .single();

      if (error || !data) {
        throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to update preset: ${error?.message}`);
      }

      await admin.from('audit_logs').insert({
        business_id: businessId,
        actor_id: actorContext.userId,
        action: 'role_scope_preset.updated',
        target_type: 'role_scope_preset',
        target_id: data.id,
        payload: { roleKey: input.roleKey, defaultScope: input.defaultScope, maxScope: input.maxScope },
      });

      const presets = await this.listRoleScopePresets(businessId);
      const updated = presets.find((p) => p.roleKey === input.roleKey && p.businessId === businessId);
      return { success: true, preset: updated, message: `Role scope preset for ${input.roleKey} updated.` };
    }

    if (input.customRoleId) {
      const { data: customRole } = await admin
        .from('custom_roles')
        .select('id')
        .eq('id', input.customRoleId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!customRole) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Custom role not found: ${input.customRoleId}`);
      }

      const { data, error } = await admin
        .from('role_scope_presets')
        .upsert(
          {
            business_id: businessId,
            role_key: null,
            custom_role_id: input.customRoleId,
            default_scope: input.defaultScope,
            max_scope: input.maxScope,
            updated_at: now,
          },
          { onConflict: 'business_id,custom_role_id' }
        )
        .select('id')
        .single();

      if (error || !data) {
        throw new AuthorizationContextError('INVALID_PERMISSION', `Failed to update preset: ${error?.message}`);
      }

      await admin.from('audit_logs').insert({
        business_id: businessId,
        actor_id: actorContext.userId,
        action: 'role_scope_preset.updated',
        target_type: 'role_scope_preset',
        target_id: data.id,
        payload: { customRoleId: input.customRoleId, defaultScope: input.defaultScope, maxScope: input.maxScope },
      });

      const presets = await this.listRoleScopePresets(businessId);
      const updated = presets.find((p) => p.customRoleId === input.customRoleId);
      return { success: true, preset: updated, message: 'Custom role scope preset updated.' };
    }

    throw new AuthorizationContextError('INVALID_PERMISSION', 'Target roleKey or customRoleId required.');
  }

  /**
   * Previews aggregated effective access for a business member.
   */
  static async previewMemberEffectiveAccess(
    businessId: string,
    membershipId: string
  ): Promise<EffectiveAccessPreview | null> {
    const admin = createAdminClient();

    const { data: mem, error: memErr } = await admin
      .from('business_memberships')
      .select(`
        id,
        business_id,
        user_id,
        role,
        custom_role_id,
        custom_roles(name)
      `)
      .eq('id', membershipId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (memErr || !mem) {
      return null;
    }

    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', mem.user_id)
      .maybeSingle();

    interface MembershipPreviewRow {
      id: string;
      business_id: string;
      user_id: string;
      role: string;
      custom_role_id: string | null;
      custom_roles?: { name: string } | null;
    }

    const membership = mem as unknown as MembershipPreviewRow;

    // Fetch presets
    const { data: preset } = await admin
      .from('role_scope_presets')
      .select('default_scope, max_scope, role_key, custom_role_id')
      .or(
        membership.custom_role_id
          ? `custom_role_id.eq.${membership.custom_role_id}`
          : `role_key.eq.${membership.role}`
      )
      .or(`business_id.eq.${businessId},business_id.is.null`)
      .order('business_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // Fetch role permissions
    let rolePermissions: string[] = [];
    if (membership.custom_role_id) {
      const { data: customPerms } = await admin
        .from('role_permissions')
        .select('permission_key')
        .eq('custom_role_id', membership.custom_role_id);
      rolePermissions = (customPerms || []).map((p) => p.permission_key);
    } else {
      const { data: builtInPerms } = await admin
        .from('role_permissions')
        .select('permission_key')
        .eq('role_key', membership.role);
      rolePermissions = (builtInPerms || []).map((p) => p.permission_key);
    }

    // Fetch scope grants
    const scopeGrants = await this.listScopeGrants({
      businessId,
      businessMembershipId: membershipId,
    });

    // Fetch scoped overrides
    const { data: rawOverrides } = await admin
      .from('member_permission_overrides')
      .select(`
        id,
        permission_key,
        effect,
        scope_type,
        branch_id,
        department_id,
        organization_unit_id,
        service_area_id,
        branches(name),
        organization_departments(name),
        organization_units(name),
        service_areas(name)
      `)
      .eq('business_membership_id', membershipId);

    interface OverridePreviewRow {
      id: string;
      permission_key: string;
      effect: string;
      scope_type: string | null;
      branch_id: string | null;
      department_id: string | null;
      organization_unit_id: string | null;
      service_area_id: string | null;
      branches?: { name: string } | null;
      organization_departments?: { name: string } | null;
      organization_units?: { name: string } | null;
      service_areas?: { name: string } | null;
    }

    const scopedOverrides = ((rawOverrides || []) as unknown as OverridePreviewRow[]).map((o) => {
      let targetName: string | null = null;
      if (o.branches?.name) targetName = `Branch: ${o.branches.name}`;
      else if (o.organization_departments?.name) targetName = `Department: ${o.organization_departments.name}`;
      else if (o.organization_units?.name) targetName = `Unit: ${o.organization_units.name}`;
      else if (o.service_areas?.name) targetName = `Area: ${o.service_areas.name}`;

      return {
        id: o.id,
        permissionKey: o.permission_key,
        effect: o.effect as GrantEffect,
        scopeType: (o.scope_type as ScopeType) || null,
        branchId: o.branch_id,
        departmentId: o.department_id,
        organizationUnitId: o.organization_unit_id,
        serviceAreaId: o.service_area_id,
        targetName,
      };
    });

    // Aggregate summary map
    const effectiveMap = new Map<
      string,
      { effect: GrantEffect; scopeType: ScopeType; targets: { type: ScopeType; id?: string | null; name?: string }[]; source: string }
    >();

    // 1. Role permissions base
    const defaultScope = (preset?.default_scope as ScopeType) || 'PROPERTY';
    for (const perm of rolePermissions) {
      effectiveMap.set(perm, {
        effect: 'allow',
        scopeType: defaultScope,
        targets: [{ type: defaultScope, name: 'Role Default Scope' }],
        source: 'role_permission',
      });
    }

    // 2. Concrete scope grants
    for (const grant of scopeGrants) {
      let targetName = 'Organization-wide';
      if (grant.branchName) targetName = `Branch: ${grant.branchName}`;
      else if (grant.departmentName) targetName = `Department: ${grant.departmentName}`;
      else if (grant.organizationUnitName) targetName = `Unit: ${grant.organizationUnitName}`;
      else if (grant.serviceAreaName) targetName = `Area: ${grant.serviceAreaName}`;

      effectiveMap.set(grant.permissionKey, {
        effect: grant.effect,
        scopeType: grant.scopeType,
        targets: [{ type: grant.scopeType, id: grant.branchId || grant.departmentId, name: targetName }],
        source: 'scope_grant',
      });
    }

    // 3. Scoped overrides (highest precedence)
    for (const ov of scopedOverrides) {
      effectiveMap.set(ov.permissionKey, {
        effect: ov.effect,
        scopeType: ov.scopeType || defaultScope,
        targets: [{ type: ov.scopeType || defaultScope, name: ov.targetName || 'Member Override' }],
        source: 'member_override',
      });
    }

    const effectiveSummary = Array.from(effectiveMap.entries()).map(([permissionKey, val]) => ({
      permissionKey,
      effect: val.effect,
      scopeType: val.scopeType,
      scopeTargets: val.targets,
      source: val.source,
    }));

    return {
      membershipId,
      userId: membership.user_id,
      userEmail: userProfile?.email || '',
      businessId,
      role: membership.role,
      customRoleId: membership.custom_role_id,
      customRoleName: membership.custom_roles?.name || null,
      preset: preset
        ? {
            roleKey: preset.role_key,
            customRoleId: preset.custom_role_id,
            defaultScope: preset.default_scope as ScopeType,
            maxScope: preset.max_scope as ScopeType,
          }
        : null,
      rolePermissions,
      scopeGrants,
      scopedOverrides,
      effectiveSummary,
      temporaryAuthority: {
        actingAssignments: [],
        secondmentAssignments: [],
      },
    };
  }
}

import 'server-only';
import { cookies } from 'next/headers';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  AuthorizationContext,
  AuthorizedBranchAssignment,
  EffectiveStaffAssignment,
  AuthorizedDepartment,
  AuthorizedOrganizationUnit,
  AuthorizedServiceArea,
  EffectivePermissionOverride,
  EffectiveScopeGrant,
  RoleScopePresetInfo,
  ResolveContextOptions,
  ScopeType,
  GrantEffect,
  GrantSource,
} from '@/types/authorization.types';
import { AuthorizationContextError } from './errors';
import { isTemporaryAssignmentEffective } from './temporary-assignment';

export const ACTIVE_BUSINESS_COOKIE = 'wsnexa_active_business';
export const ACTIVE_BRANCH_COOKIE = 'wsnexa_active_branch';

/**
 * Resolves trusted server-side authorization context for the authenticated user and active business.
 *
 * Golden Rule:
 * Permission = WHAT
 * Scope = WHERE
 * Context = TRUSTED INPUT FOR AUTHORIZATION
 *
 * Identity, memberships, branch assignments, staff assignments, acting/secondment windows,
 * role permissions, overrides, and scope grants are completely rebuilt server-side from database state.
 * Client cookies or requested IDs only serve as non-authoritative selection hints.
 */
export async function resolveAuthorizationContext(
  options: ResolveContextOptions = {}
): Promise<AuthorizationContext> {
  const admin = createAdminClient();

  // 1. Authenticate Identity
  let userId: string;
  let userEmail = '';

  if (options.overrideUserId) {
    userId = options.overrideUserId;
    // Resolve email if available
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
    userEmail = userProfile ? `${userProfile.first_name || 'user'}@system.local` : 'actor@system.local';
  } else {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthorizationContextError(
        'UNAUTHENTICATED',
        'Authentication required. No active session found.'
      );
    }
    userId = user.id;
    userEmail = user.email || '';
  }

  // 2. Resolve Active Business Membership
  const { data: allMemberships, error: memErr } = await admin
    .from('business_memberships')
    .select('*, businesses(*)')
    .eq('user_id', userId);

  if (memErr) {
    throw new AuthorizationContextError(
      'NO_ACTIVE_MEMBERSHIP',
      'Failed to resolve business memberships from database.'
    );
  }

  if (!allMemberships || allMemberships.length === 0) {
    throw new AuthorizationContextError(
      'NO_ACTIVE_MEMBERSHIP',
      'User does not belong to any businesses.'
    );
  }

  const activeMemberships = allMemberships.filter(
    (m) => m.membership_status === 'active'
  );

  if (activeMemberships.length === 0) {
    throw new AuthorizationContextError(
      'MEMBERSHIP_INACTIVE',
      'User membership is suspended, pending, or inactive in all associated businesses.'
    );
  }

  // Determine requested business ID
  let targetBusinessId = options.requestedBusinessId;
  if (!targetBusinessId && !options.overrideUserId) {
    try {
      const cookieStore = await cookies();
      targetBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
    } catch {
      // Running outside request context (e.g. background job / test)
    }
  }

  let activeMembership = activeMemberships[0];
  if (targetBusinessId) {
    const matched = activeMemberships.find((m) => m.business_id === targetBusinessId);
    if (!matched) {
      // Check if user is inactive in requested business specifically
      const inactiveInTarget = allMemberships.find((m) => m.business_id === targetBusinessId);
      if (inactiveInTarget) {
        throw new AuthorizationContextError(
          'MEMBERSHIP_INACTIVE',
          'User membership in the requested business is inactive or suspended.',
          { businessId: targetBusinessId }
        );
      }
      throw new AuthorizationContextError(
        'TENANT_MISMATCH',
        'User does not hold an active membership in the requested business.',
        { requestedBusinessId: targetBusinessId }
      );
    }
    activeMembership = matched;
  }

  const business = activeMembership.businesses as unknown as {
    id: string;
    name: string;
    slug: string;
    status: string;
  };

  if (!business || business.status === 'suspended' || business.status === 'deleted') {
    throw new AuthorizationContextError(
      'NO_ACTIVE_MEMBERSHIP',
      'The requested business is inactive, suspended, or not found.'
    );
  }

  const isBusinessOwner = activeMembership.role === 'business_owner';
  const now = new Date();
  const nowIso = now.toISOString();

  // 3. Concurrently fetch all authorization dimensions in a single bounded batch
  const [
    branchesRes,
    branchAssignmentsRes,
    staffAssignmentsRes,
    staffAreaAssignmentsRes,
    rolePermissionsRes,
    overridesRes,
    scopeGrantsRes,
    roleScopePresetsRes,
    departmentsRes,
    unitsRes,
  ] = await Promise.all([
    // 3.1 All active branches for the business
    admin
      .from('branches')
      .select('id, name, code, is_default, status, deleted_at')
      .eq('business_id', business.id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false }),

    // 3.2 Branch assignments for current membership
    admin
      .from('branch_assignments')
      .select('id, branch_id, is_primary, created_at')
      .eq('business_membership_id', activeMembership.id),

    // 3.3 Staff assignments from Phase 29
    admin
      .from('staff_assignments')
      .select(
        'id, business_membership_id, assignment_type, status, is_primary, branch_id, department_id, unit_id, position_id, starts_at, ends_at, source_assignment_id, acting_for_assignment_id, coverage_absence_id, organization_positions(id, position_code)'
      )
      .eq('business_membership_id', activeMembership.id)
      .eq('status', 'active'),

    // 3.4 Staff area assignments (waiter service areas)
    admin
      .from('staff_area_assignments')
      .select('id, service_area_id, service_areas(id, name, code, branch_id)')
      .eq('business_membership_id', activeMembership.id),

    // 3.5 Role permissions (custom or built-in)
    activeMembership.custom_role_id
      ? admin
          .from('custom_roles')
          .select('id, is_active, role_permissions(permission_key)')
          .eq('id', activeMembership.custom_role_id)
          .eq('business_id', business.id)
          .maybeSingle()
      : admin
          .from('role_permissions')
          .select('permission_key')
          .eq('role_key', activeMembership.role)
          .is('business_id', null),

    // 3.6 Member permission overrides
    admin
      .from('member_permission_overrides')
      .select('id, business_membership_id, permission_key, effect, scope_type, branch_id, department_id, organization_unit_id, service_area_id, created_at')
      .eq('business_membership_id', activeMembership.id),

    // 3.7 Applicable permission scope grants
    admin
      .from('permission_scope_grants')
      .select('id, permission_key, effect, scope_type, branch_id, department_id, organization_unit_id, service_area_id, grant_source, source_id')
      .or(
        `business_membership_id.eq.${activeMembership.id},` +
          `role_key.eq.${activeMembership.role}` +
          (activeMembership.custom_role_id ? `,custom_role_id.eq.${activeMembership.custom_role_id}` : '')
      ),

    // 3.8 Role scope presets
    admin
      .from('role_scope_presets')
      .select('role_key, custom_role_id, default_scope, max_scope')
      .or(
        `role_key.eq.${activeMembership.role}` +
          (activeMembership.custom_role_id ? `,custom_role_id.eq.${activeMembership.custom_role_id}` : '')
      ),

    // 3.9 Organization departments
    admin
      .from('organization_departments')
      .select('id, name, code, branch_id, is_active')
      .eq('business_id', business.id)
      .eq('is_active', true),

    // 3.10 Organization units
    admin
      .from('organization_units')
      .select('id, name, unit_type, department_id, branch_id, is_active')
      .eq('business_id', business.id)
      .eq('is_active', true),
  ]);

  const allBranches = branchesRes.data || [];
  const branchMap = new Map(allBranches.map((b) => [b.id, b]));

  // 4. Temporal Evaluation of Staff Assignments (Tasks 9, 10, 11)
  const rawStaffAssignments = staffAssignmentsRes.data || [];
  const validStaffAssignments: EffectiveStaffAssignment[] = [];
  const actingAssignments: EffectiveStaffAssignment[] = [];
  const secondments: EffectiveStaffAssignment[] = [];

  for (const a of rawStaffAssignments) {
    // Check temporal window against server/database time using authoritative helper
    const isEffective = isTemporaryAssignmentEffective(
      {
        status: a.status,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
      },
      now
    );

    if (isEffective) {
      const isActing = a.assignment_type === 'acting';
      const isSecondment = a.assignment_type === 'secondment';
      const pos = a.organization_positions as unknown as { id: string; position_code?: string } | null;

      const assignmentObj: EffectiveStaffAssignment = {
        id: a.id,
        businessMembershipId: a.business_membership_id,
        assignmentType: a.assignment_type as EffectiveStaffAssignment['assignmentType'],
        status: a.status as EffectiveStaffAssignment['status'],
        isPrimary: Boolean(a.is_primary),
        branchId: a.branch_id || null,
        departmentId: a.department_id || null,
        organizationUnitId: (a as unknown as { unit_id?: string | null }).unit_id || null,
        positionId: a.position_id || null,
        positionTitle: pos?.position_code || null,
        startsAt: a.starts_at,
        endsAt: a.ends_at || null,
        sourceAssignmentId: a.source_assignment_id || null,
        actingForAssignmentId: a.acting_for_assignment_id || null,
        coverageAbsenceId: a.coverage_absence_id || null,
        isActing,
        isSecondment,
      };

      validStaffAssignments.push(assignmentObj);
      if (isActing) actingAssignments.push(assignmentObj);
      if (isSecondment) secondments.push(assignmentObj);
    }
  }

  // 5. Authorized Branch Set & Active Branch Resolution (Task 4)
  const branchAssignmentsList = branchAssignmentsRes.data || [];
  const authorizedBranchIdSet = new Set<string>();
  const branchAssignments: AuthorizedBranchAssignment[] = [];

  if (isBusinessOwner) {
    // Business owners have authorized access across all active non-deleted branches
    for (const b of allBranches) {
      authorizedBranchIdSet.add(b.id);
      branchAssignments.push({
        id: `owner-${b.id}`,
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        isPrimary: false,
        isDefault: Boolean(b.is_default),
        status: b.status,
        assignedAt: activeMembership.joined_at || nowIso,
      });
    }
  } else {
    // Non-owners: resolve concrete branch assignments
    for (const ba of branchAssignmentsList) {
      const b = branchMap.get(ba.branch_id);
      if (b) {
        authorizedBranchIdSet.add(b.id);
        branchAssignments.push({
          id: ba.id,
          branchId: b.id,
          branchName: b.name,
          branchCode: b.code,
          isPrimary: Boolean(ba.is_primary),
          isDefault: Boolean(b.is_default),
          status: b.status,
          assignedAt: ba.created_at || nowIso,
        });
      }
    }

    // Include host branch for active secondments (Task 11)
    for (const sec of secondments) {
      if (sec.branchId && branchMap.has(sec.branchId)) {
        authorizedBranchIdSet.add(sec.branchId);
        if (!branchAssignments.some((ba) => ba.branchId === sec.branchId)) {
          const b = branchMap.get(sec.branchId)!;
          branchAssignments.push({
            id: `sec-${sec.id}`,
            branchId: b.id,
            branchName: b.name,
            branchCode: b.code,
            isPrimary: false,
            isDefault: Boolean(b.is_default),
            status: b.status,
            assignedAt: sec.startsAt || nowIso,
          });
        }
      }
    }

    // Include branch reach for active acting assignments (Task 4)
    for (const act of actingAssignments) {
      if (act.branchId && branchMap.has(act.branchId)) {
        authorizedBranchIdSet.add(act.branchId);
        if (!branchAssignments.some((ba) => ba.branchId === act.branchId)) {
          const b = branchMap.get(act.branchId)!;
          branchAssignments.push({
            id: `act-${act.id}`,
            branchId: b.id,
            branchName: b.name,
            branchCode: b.code,
            isPrimary: false,
            isDefault: Boolean(b.is_default),
            status: act.status,
            assignedAt: act.startsAt || nowIso,
          });
        }
      }
    }
  }

  const authorizedBranchIds = Array.from(authorizedBranchIdSet);

  // Determine active branch deterministically
  let requestedBranchId = options.requestedBranchId;
  if (!requestedBranchId && !options.overrideUserId) {
    try {
      const cookieStore = await cookies();
      requestedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    } catch {
      // Ignore outside request context
    }
  }

  let activeBranchId: string | null = null;
  if (requestedBranchId && authorizedBranchIdSet.has(requestedBranchId)) {
    activeBranchId = requestedBranchId;
  } else if (authorizedBranchIds.length > 0) {
    const defaultBranch = allBranches.find((b) => b.is_default && authorizedBranchIdSet.has(b.id));
    activeBranchId = defaultBranch ? defaultBranch.id : authorizedBranchIds[0];
  }

  // 6. Departments Resolution (Task 12)
  const allDepts = departmentsRes.data || [];
  const deptMap = new Map(allDepts.map((d) => [d.id, d]));
  const authorizedDeptMap = new Map<string, AuthorizedDepartment>();

  if (isBusinessOwner) {
    for (const d of allDepts) {
      authorizedDeptMap.set(d.id, {
        id: d.id,
        name: d.name,
        code: d.code,
        branchId: d.branch_id,
        source: 'business_owner',
      });
    }
  } else {
    for (const sa of validStaffAssignments) {
      if (sa.departmentId && deptMap.has(sa.departmentId)) {
        const d = deptMap.get(sa.departmentId)!;
        const source = sa.isActing ? 'acting' : sa.isSecondment ? 'secondment' : 'staff_assignment';
        authorizedDeptMap.set(d.id, {
          id: d.id,
          name: d.name,
          code: d.code,
          branchId: d.branch_id,
          source,
        });
      }
    }
  }

  const departments = Array.from(authorizedDeptMap.values());
  const departmentIds = departments.map((d) => d.id);

  // 7. Organization Units & Service Areas Resolution (Task 13 - AREA_TEAM)
  const allUnits = unitsRes.data || [];
  const unitMap = new Map(allUnits.map((u) => [u.id, u]));
  const authorizedUnitMap = new Map<string, AuthorizedOrganizationUnit>();

  if (isBusinessOwner) {
    for (const u of allUnits) {
      authorizedUnitMap.set(u.id, {
        id: u.id,
        name: u.name,
        unitType: u.unit_type,
        departmentId: u.department_id,
        branchId: u.branch_id,
        source: 'business_owner',
      });
    }
  } else {
    for (const sa of validStaffAssignments) {
      if (sa.organizationUnitId && unitMap.has(sa.organizationUnitId)) {
        const u = unitMap.get(sa.organizationUnitId)!;
        const source = sa.isActing ? 'acting' : sa.isSecondment ? 'secondment' : 'staff_assignment';
        authorizedUnitMap.set(u.id, {
          id: u.id,
          name: u.name,
          unitType: u.unit_type,
          departmentId: u.department_id,
          branchId: u.branch_id,
          source,
        });
      }
    }
  }

  const organizationUnits = Array.from(authorizedUnitMap.values());
  const organizationUnitIds = organizationUnits.map((u) => u.id);

  // Service Areas (staff_area_assignments)
  const staffAreaList = staffAreaAssignmentsRes.data || [];
  const authorizedServiceAreaMap = new Map<string, AuthorizedServiceArea>();

  if (isBusinessOwner) {
    // Business owner has authority across all business service areas
    const { data: allServiceAreas } = await admin
      .from('service_areas')
      .select('id, name, code, branch_id')
      .eq('business_id', business.id)
      .eq('is_active', true);

    for (const sa of allServiceAreas || []) {
      authorizedServiceAreaMap.set(sa.id, {
        id: sa.id,
        name: sa.name,
        code: sa.code,
        branchId: sa.branch_id,
        source: 'business_owner',
      });
    }
  } else {
    for (const item of staffAreaList) {
      const area = item.service_areas as unknown as { id: string; name: string; code?: string | null; branch_id: string } | null;
      if (area) {
        authorizedServiceAreaMap.set(area.id, {
          id: area.id,
          name: area.name,
          code: area.code || null,
          branchId: area.branch_id,
          source: 'staff_area_assignment',
        });
      } else if (item.service_area_id) {
        authorizedServiceAreaMap.set(item.service_area_id, {
          id: item.service_area_id,
          name: 'Assigned Area',
          code: null,
          branchId: '',
          source: 'staff_area_assignment',
        });
      }
    }
  }

  const serviceAreas = Array.from(authorizedServiceAreaMap.values());
  const serviceAreaIds = serviceAreas.map((sa) => sa.id);

  // 8. Role Permissions Resolution (Task 5)
  let rolePermissions: string[] = [];
  if (activeMembership.custom_role_id) {
    const customRoleRow = rolePermissionsRes.data as unknown as {
      id: string;
      is_active: boolean;
      role_permissions?: Array<{ permission_key: string }>;
    } | null;
    if (customRoleRow && customRoleRow.is_active) {
      rolePermissions = Array.from(
        new Set((customRoleRow.role_permissions || []).map((rp) => rp.permission_key))
      );
    }
  } else {
    const rolePermissionsRows = (rolePermissionsRes.data || []) as Array<{ permission_key: string }>;
    rolePermissions = Array.from(new Set(rolePermissionsRows.map((rp) => rp.permission_key)));
  }

  // 9. Member Permission Overrides Resolution (Task 6)
  const rawOverrides = overridesRes.data || [];
  const permissionOverrides: EffectivePermissionOverride[] = rawOverrides.map((o) => ({
    id: o.id,
    businessMembershipId: o.business_membership_id,
    permissionKey: o.permission_key,
    effect: o.effect as GrantEffect,
    scopeType: (o.scope_type as ScopeType) || null,
    branchId: o.branch_id || null,
    departmentId: o.department_id || null,
    organizationUnitId: o.organization_unit_id || null,
    serviceAreaId: o.service_area_id || null,
    createdAt: o.created_at,
  }));

  // 10. Permission Scope Grants Resolution (Task 7)
  const rawGrants = scopeGrantsRes.data || [];
  const scopeGrants: EffectiveScopeGrant[] = rawGrants.map((g) => ({
    id: g.id,
    permissionKey: g.permission_key,
    effect: g.effect as GrantEffect,
    scopeType: g.scope_type as ScopeType,
    branchId: g.branch_id || null,
    departmentId: g.department_id || null,
    organizationUnitId: g.organization_unit_id || null,
    serviceAreaId: g.service_area_id || null,
    grantSource: g.grant_source as GrantSource,
    sourceId: g.source_id || null,
  }));

  // 11. Role Scope Preset Resolution (Task 8)
  const presetRows = roleScopePresetsRes.data || [];
  const roleScopePreset: RoleScopePresetInfo | null =
    presetRows.length > 0
      ? {
          roleKey: presetRows[0].role_key || null,
          customRoleId: presetRows[0].custom_role_id || null,
          defaultScope: presetRows[0].default_scope as ScopeType,
          maxScope: presetRows[0].max_scope as ScopeType,
        }
      : null;

  // 12. SELF Scope Identity (Task 14)
  const selfIdentity = {
    userId,
    membershipId: activeMembership.id,
    staffAssignmentIds: validStaffAssignments.map((a) => a.id),
  };

  // 13. Diagnostics Metadata (Task 22)
  const diagnostics = {
    resolvedAt: nowIso,
    queryCount: isBusinessOwner ? 11 : 10,
    sources: {
      membershipSource: `business_memberships:${activeMembership.id}`,
      branchAssignmentCount: branchAssignments.length,
      staffAssignmentCount: validStaffAssignments.length,
      actingAssignmentCount: actingAssignments.length,
      secondmentCount: secondments.length,
      rolePermissionCount: rolePermissions.length,
      overrideCount: permissionOverrides.length,
      scopeGrantCount: scopeGrants.length,
    },
  };

  return {
    userId,
    userEmail,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    membershipId: activeMembership.id,
    membershipRole: activeMembership.role,
    customRoleId: activeMembership.custom_role_id || null,
    isBusinessOwner,
    activeBranchId,
    authorizedBranchIds,
    branchAssignments,
    departmentIds,
    departments,
    organizationUnitIds,
    organizationUnits,
    serviceAreaIds,
    serviceAreas,
    staffAssignments: validStaffAssignments,
    actingAssignments,
    secondments,
    rolePermissions,
    permissionOverrides,
    scopeGrants,
    roleScopePreset,
    selfIdentity,
    diagnostics,
  };
}

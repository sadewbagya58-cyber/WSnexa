import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { ScopeType, SCOPE_RANK, AuthorizationContext } from '@/types/authorization.types';
import { ownerOnlyPermissions } from '@/lib/validation/permission';
import { AuthorizationContextError } from './errors';

export interface ScopeTargetValidationResult {
  valid: boolean;
  scopeType: ScopeType;
  branchId: string | null;
  departmentId: string | null;
  resolvedBranchId: string | null;
  resolvedDepartmentId: string | null;
  organizationUnitId: string | null;
  serviceAreaId: string | null;
  targetDisplay: string;
}

export interface ValidateScopeTargetOptions {
  businessId: string;
  scopeType: ScopeType;
  branchId?: string | null;
  departmentId?: string | null;
  organizationUnitId?: string | null;
  serviceAreaId?: string | null;
  client?: unknown;
}

/**
 * Validates that a target scope configuration matches canonical RBAC V2 constraints
 * and verifies that referenced foreign keys exist and belong to the active business tenant.
 */
export async function validateScopeTarget(
  options: ValidateScopeTargetOptions
): Promise<ScopeTargetValidationResult> {
  const { businessId, scopeType, branchId, departmentId, organizationUnitId, serviceAreaId } = options;

  if (!businessId) {
    throw new AuthorizationContextError('TENANT_MISMATCH', 'Business ID is required for scope target validation.');
  }

  const admin = createAdminClient();

  switch (scopeType) {
    case 'ORGANIZATION': {
      if (branchId || departmentId || organizationUnitId || serviceAreaId) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'ORGANIZATION scope target must not specify branch, department, unit, or service area foreign keys.'
        );
      }
      return {
        valid: true,
        scopeType: 'ORGANIZATION',
        branchId: null,
        departmentId: null,
        resolvedBranchId: null,
        resolvedDepartmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        targetDisplay: 'Organization-wide',
      };
    }

    case 'PROPERTY': {
      if (!branchId) {
        throw new AuthorizationContextError('OUTSIDE_SCOPE', 'PROPERTY scope requires a valid branchId.');
      }
      if (departmentId || organizationUnitId || serviceAreaId) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'PROPERTY scope target must not specify department, unit, or service area foreign keys.'
        );
      }

      const { data: branch, error } = await admin
        .from('branches')
        .select('id, business_id, name')
        .eq('id', branchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error || !branch) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Branch not found: ${branchId}`);
      }

      if (branch.business_id !== businessId) {
        throw new AuthorizationContextError(
          'TENANT_MISMATCH',
          `Branch ${branchId} does not belong to business ${businessId}.`
        );
      }

      return {
        valid: true,
        scopeType: 'PROPERTY',
        branchId: branch.id,
        departmentId: null,
        resolvedBranchId: branch.id,
        resolvedDepartmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        targetDisplay: `Property: ${branch.name}`,
      };
    }

    case 'DEPARTMENT': {
      if (!departmentId) {
        throw new AuthorizationContextError('OUTSIDE_SCOPE', 'DEPARTMENT scope requires a valid departmentId.');
      }
      if (organizationUnitId || serviceAreaId) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'DEPARTMENT scope target must not specify unit or service area foreign keys.'
        );
      }

      const { data: dept, error } = await admin
        .from('organization_departments')
        .select('id, business_id, branch_id, name')
        .eq('id', departmentId)
        .is('archived_at', null)
        .maybeSingle();

      if (error || !dept) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Department not found: ${departmentId}`);
      }

      if (dept.business_id !== businessId) {
        throw new AuthorizationContextError(
          'TENANT_MISMATCH',
          `Department ${departmentId} does not belong to business ${businessId}.`
        );
      }

      // If branchId was provided in input, ensure it matches the department's branch
      if (branchId && dept.branch_id && branchId !== dept.branch_id) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          `Department branch mismatch: department belongs to branch ${dept.branch_id}, not ${branchId}.`
        );
      }

      return {
        valid: true,
        scopeType: 'DEPARTMENT',
        branchId: null,
        departmentId: dept.id,
        resolvedBranchId: dept.branch_id || branchId || null,
        resolvedDepartmentId: dept.id,
        organizationUnitId: null,
        serviceAreaId: null,
        targetDisplay: `Department: ${dept.name}`,
      };
    }

    case 'AREA_TEAM': {
      const hasUnit = Boolean(organizationUnitId);
      const hasArea = Boolean(serviceAreaId);

      if ((hasUnit && hasArea) || (!hasUnit && !hasArea)) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'AREA_TEAM scope target requires exactly one concrete target: either organizationUnitId OR serviceAreaId.'
        );
      }

      if (branchId || departmentId) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'AREA_TEAM scope target inputs must not directly specify branchId or departmentId (derived from unit/area).'
        );
      }

      if (organizationUnitId) {
        const { data: unit, error } = await admin
          .from('organization_units')
          .select('id, business_id, branch_id, department_id, name')
          .eq('id', organizationUnitId)
          .is('archived_at', null)
          .maybeSingle();

        if (error || !unit) {
          throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Organization unit not found: ${organizationUnitId}`);
        }

        if (unit.business_id !== businessId) {
          throw new AuthorizationContextError(
            'TENANT_MISMATCH',
            `Organization unit ${organizationUnitId} does not belong to business ${businessId}.`
          );
        }

        return {
          valid: true,
          scopeType: 'AREA_TEAM',
          branchId: null,
          departmentId: null,
          resolvedBranchId: unit.branch_id || null,
          resolvedDepartmentId: unit.department_id || null,
          organizationUnitId: unit.id,
          serviceAreaId: null,
          targetDisplay: `Team/Unit: ${unit.name}`,
        };
      }

      if (serviceAreaId) {
        const { data: area, error } = await admin
          .from('service_areas')
          .select('id, business_id, branch_id, name')
          .eq('id', serviceAreaId)
          .is('deleted_at', null)
          .maybeSingle();

        if (error || !area) {
          throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Service area not found: ${serviceAreaId}`);
        }

        if (area.business_id !== businessId) {
          throw new AuthorizationContextError(
            'TENANT_MISMATCH',
            `Service area ${serviceAreaId} does not belong to business ${businessId}.`
          );
        }

        return {
          valid: true,
          scopeType: 'AREA_TEAM',
          branchId: null,
          departmentId: null,
          resolvedBranchId: area.branch_id || null,
          resolvedDepartmentId: null,
          organizationUnitId: null,
          serviceAreaId: area.id,
          targetDisplay: `Service Area: ${area.name}`,
        };
      }

      throw new AuthorizationContextError('OUTSIDE_SCOPE', 'Invalid AREA_TEAM configuration.');
    }

    case 'SELF': {
      if (branchId || departmentId || organizationUnitId || serviceAreaId) {
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          'SELF scope target must not specify external foreign keys.'
        );
      }
      return {
        valid: true,
        scopeType: 'SELF',
        branchId: null,
        departmentId: null,
        resolvedBranchId: null,
        resolvedDepartmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        targetDisplay: 'Self Identity',
      };
    }

    default:
      throw new AuthorizationContextError('INVALID_PERMISSION', `Unsupported scope type: ${scopeType}`);
  }
}

/**
 * Validates that requested scope does not exceed target role/preset max scope capability.
 */
export function validateMaxScope(targetMaxScope: ScopeType, requestedScope: ScopeType): void {
  const targetRank = SCOPE_RANK[targetMaxScope] ?? 0;
  const requestedRank = SCOPE_RANK[requestedScope] ?? 0;

  if (requestedRank > targetRank) {
    throw new AuthorizationContextError(
      'OUTSIDE_SCOPE',
      `Requested grant scope (${requestedScope}, rank ${requestedRank}) exceeds target maximum allowed scope (${targetMaxScope}, rank ${targetRank}).`
    );
  }
}

export interface ValidateAdministrativeReachOptions {
  actorContext: AuthorizationContext;
  requestedScope: ScopeType;
  targetBranchId?: string | null;
  targetDepartmentId?: string | null;
  targetOrganizationUnitId?: string | null;
  targetServiceAreaId?: string | null;
  permissionKey?: string;
}

/**
 * Ensures an actor cannot grant permissions or scopes beyond their own administrative authority.
 */
export function validateAdministrativeReach(options: ValidateAdministrativeReachOptions): void {
  const {
    actorContext,
    requestedScope,
    targetBranchId,
    targetDepartmentId,
    targetOrganizationUnitId,
    targetServiceAreaId,
    permissionKey,
  } = options;

  // 1. Super Admin platform permissions are strictly barred from tenant RBAC
  if (permissionKey && permissionKey.startsWith('super_admin.')) {
    throw new AuthorizationContextError(
      'INVALID_PERMISSION',
      'Platform Super Admin permissions cannot be granted or managed inside tenant RBAC.'
    );
  }

  // 2. Business Owners have full organizational reach over their tenant
  if (actorContext.isBusinessOwner || actorContext.membershipRole === 'business_owner') {
    return;
  }

  // 3. Sensitive owner-only permissions require Business Owner authority
  if (permissionKey && ownerOnlyPermissions.includes(permissionKey as (typeof ownerOnlyPermissions)[number])) {
    throw new AuthorizationContextError(
      'PERMISSION_DENIED',
      `Permission ${permissionKey} is owner-only and cannot be granted by non-owner administrators.`
    );
  }

  // 4. Non-owner actors must possess roles.manage or permissions.override.manage
  const hasRoleAdmin =
    actorContext.rolePermissions.includes('roles.manage') ||
    actorContext.rolePermissions.includes('permissions.override.manage');

  if (!hasRoleAdmin) {
    throw new AuthorizationContextError(
      'PERMISSION_DENIED',
      'Actor lacks roles.manage or permissions.override.manage authority.'
    );
  }

  // 5. Check Scope Reach: Non-owners cannot grant ORGANIZATION scope unless they have explicit organization-level preset
  const actorPresetMaxScope = actorContext.roleScopePreset?.maxScope || 'PROPERTY';
  if (requestedScope === 'ORGANIZATION' && actorPresetMaxScope !== 'ORGANIZATION') {
    throw new AuthorizationContextError(
      'OUTSIDE_SCOPE',
      'Actor with property-level authority cannot configure organization-wide scope grants.'
    );
  }

  // 6. Property Boundary: If target is property-bound, actor must be assigned to that branch
  if (targetBranchId) {
    if (!actorContext.authorizedBranchIds.includes(targetBranchId)) {
      throw new AuthorizationContextError(
        'OUTSIDE_SCOPE',
        `Actor is not authorized for target branch: ${targetBranchId}. Cannot manage grants outside assigned branches.`
      );
    }
  }

  // 7. Department Boundary: If actor is restricted to departments, target department must match
  if (targetDepartmentId && actorContext.departmentIds.length > 0) {
    // If actor is department-scoped (e.g. maxScope = DEPARTMENT), target must be in actor's departments
    if (actorPresetMaxScope === 'DEPARTMENT' && !actorContext.departmentIds.includes(targetDepartmentId)) {
      throw new AuthorizationContextError(
        'OUTSIDE_SCOPE',
        `Actor is not authorized for target department: ${targetDepartmentId}.`
      );
    }
  }

  // 8. Area/Unit Boundary
  if (targetOrganizationUnitId && actorPresetMaxScope === 'AREA_TEAM') {
    if (!actorContext.organizationUnitIds.includes(targetOrganizationUnitId)) {
      throw new AuthorizationContextError(
        'OUTSIDE_SCOPE',
        `Actor is not authorized for target unit: ${targetOrganizationUnitId}.`
      );
    }
  }

  if (targetServiceAreaId && actorPresetMaxScope === 'AREA_TEAM') {
    if (!actorContext.serviceAreaIds.includes(targetServiceAreaId)) {
      throw new AuthorizationContextError(
        'OUTSIDE_SCOPE',
        `Actor is not authorized for target service area: ${targetServiceAreaId}.`
      );
    }
  }
}

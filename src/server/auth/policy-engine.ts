import 'server-only';
import {
  AuthorizationContext,
  ResourceScope,
  ResourceTarget,
  AuthorizeOptions,
  CanOptions,
  RequirePermissionOptions,
  AuthorizationDecision,
  AuthorizationDecisionReason,
  AuthorizationDecisionSource,
  ScopeType,
  EffectivePermissionOverride,
  EffectiveScopeGrant,
} from '@/types/authorization.types';
import { AuthorizationContextError } from './errors';
import { resolveResourceScope } from './resource-scope-resolver';
import { resolveAuthorizationContext } from './authorization-context';
import { permissionKeyEnum } from '@/lib/validation/permission';

const CANONICAL_PERMISSION_KEYS = new Set(permissionKeyEnum.options as readonly string[]);

interface CreateDecisionParams {
  allowed: boolean;
  permission: string;
  reason: AuthorizationDecisionReason;
  source?: AuthorizationDecisionSource;
  matchedScope?: ScopeType | null;
  grantId?: string | null;
  overrideId?: string | null;
  assignmentId?: string | null;
  resourceScope?: ResourceScope | null;
  startTime: number;
  details?: Record<string, unknown>;
}

function createDecision(params: CreateDecisionParams): AuthorizationDecision {
  const durationMs = Number((performance.now() - params.startTime).toFixed(2));

  return {
    allowed: params.allowed,
    permission: params.permission,
    reason: params.reason,
    matchedScope: params.matchedScope ?? null,
    source: params.source,
    grantId: params.grantId ?? null,
    overrideId: params.overrideId ?? null,
    assignmentId: params.assignmentId ?? null,
    resourceScope: params.resourceScope ?? null,
    diagnostics: {
      evaluatedAt: new Date().toISOString(),
      evaluationDurationMs: durationMs,
      details: params.details,
    },
  };
}

/**
 * Validates whether a permission key is known in the canonical catalog or in the user's authoritative permission dataset.
 * An arbitrary uncataloged string (even if prefixed with custom_) is rejected if not backed by authoritative database data.
 */
function isValidPermissionKey(permission: string, context?: AuthorizationContext): boolean {
  if (!permission || typeof permission !== 'string') return false;
  const canonicalKeys = permissionKeyEnum.options as readonly string[];
  if (canonicalKeys.includes(permission)) return true;
  if (
    context &&
    ((context.rolePermissions || []).includes(permission) ||
      (context.permissionOverrides || []).some((o) => o.permissionKey === permission) ||
      (context.scopeGrants || []).some((g) => g.permissionKey === permission))
  ) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether an override matches a given resource scope.
 */
function overrideMatchesScope(
  override: EffectivePermissionOverride,
  resourceScope: ResourceScope | null,
  context: AuthorizationContext
): boolean {
  // 1. Legacy unscoped override (scopeType is null)
  if (override.scopeType === null) {
    if (!resourceScope || resourceScope.branchId === null) {
      return context.authorizedBranchIds.length > 0;
    }
    return context.authorizedBranchIds.includes(resourceScope.branchId);
  }

  // 2. Scoped overrides
  switch (override.scopeType) {
    case 'ORGANIZATION':
      return !resourceScope || resourceScope.businessId === context.businessId;

    case 'PROPERTY':
      if (resourceScope && resourceScope.branchId !== null) {
        return resourceScope.branchId === override.branchId;
      }
      return context.activeBranchId === override.branchId;

    case 'DEPARTMENT':
      if (resourceScope && resourceScope.departmentId !== null) {
        return resourceScope.departmentId === override.departmentId;
      }
      return false;

    case 'AREA_TEAM':
      if (!resourceScope) return false;
      if (override.organizationUnitId && resourceScope.organizationUnitId === override.organizationUnitId) {
        return true;
      }
      if (override.serviceAreaId && resourceScope.serviceAreaId === override.serviceAreaId) {
        return true;
      }
      return false;

    case 'SELF':
      if (resourceScope && resourceScope.ownerUserId !== null) {
        return resourceScope.ownerUserId === context.userId;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Evaluates whether a concrete permission scope grant matches a given resource scope.
 */
function scopeGrantMatches(
  grant: EffectiveScopeGrant,
  resourceScope: ResourceScope | null,
  context: AuthorizationContext
): boolean {
  switch (grant.scopeType) {
    case 'ORGANIZATION':
      return !resourceScope || resourceScope.businessId === context.businessId;

    case 'PROPERTY':
      if (resourceScope && resourceScope.branchId !== null) {
        return resourceScope.branchId === grant.branchId;
      }
      return context.activeBranchId === grant.branchId;

    case 'DEPARTMENT':
      if (resourceScope && resourceScope.departmentId !== null) {
        return resourceScope.departmentId === grant.departmentId;
      }
      return false;

    case 'AREA_TEAM':
      if (!resourceScope) return false;
      if (grant.organizationUnitId && resourceScope.organizationUnitId === grant.organizationUnitId) {
        return true;
      }
      if (grant.serviceAreaId && resourceScope.serviceAreaId === grant.serviceAreaId) {
        return true;
      }
      return false;

    case 'SELF':
      if (resourceScope && resourceScope.ownerUserId !== null) {
        return resourceScope.ownerUserId === context.userId;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Central Policy Decision Engine (authorize)
 *
 * Core Equation:
 * AuthorizationContext
 * + Requested Permission
 * + Trusted Resource Scope
 * + Permission Overrides
 * + Concrete Scope Grants
 * + Assignment Validity
 * + Tenant Boundary
 * = FINAL AUTHORIZATION DECISION
 */
export async function authorize(options: AuthorizeOptions): Promise<AuthorizationDecision> {
  const startTime = performance.now();
  const { context, permission, resource } = options;

  // 1. Authenticated Session & Membership Check (Task 6)
  if (!context || !context.userId) {
    return createDecision({
      allowed: false,
      permission,
      reason: 'UNAUTHENTICATED',
      source: 'default_deny',
      startTime,
    });
  }

  if (!context.businessId || !context.membershipId || !context.membershipRole) {
    return createDecision({
      allowed: false,
      permission,
      reason: 'MEMBERSHIP_INACTIVE',
      source: 'default_deny',
      startTime,
    });
  }

  // 2. Canonical & Authoritative Permission Validation
  if (!isValidPermissionKey(permission, context)) {
    return createDecision({
      allowed: false,
      permission,
      reason: 'INVALID_PERMISSION',
      source: 'default_deny',
      startTime,
    });
  }

  // 3. Trusted Resource Scope Resolution (Task 20)
  let resourceScope: ResourceScope | null = null;

  if (resource) {
    if ('type' in resource && 'id' in resource) {
      try {
        resourceScope = await resolveResourceScope({
          resourceType: (resource as ResourceTarget).type,
          resourceId: (resource as ResourceTarget).id,
          expectedBusinessId: context.businessId,
        });
      } catch (err: unknown) {
        const errCode = (err as { code?: string })?.code;
        if (errCode === 'TENANT_MISMATCH') {
          return createDecision({
            allowed: false,
            permission,
            reason: 'TENANT_MISMATCH',
            source: 'default_deny',
            startTime,
            resourceScope: null,
          });
        }
        if (errCode === 'RESOURCE_NOT_FOUND') {
          return createDecision({
            allowed: false,
            permission,
            reason: 'RESOURCE_NOT_FOUND',
            source: 'default_deny',
            startTime,
            resourceScope: null,
          });
        }
        if (errCode === 'INVALID_RESOURCE_TYPE') {
          return createDecision({
            allowed: false,
            permission,
            reason: 'INVALID_RESOURCE_TYPE',
            source: 'default_deny',
            startTime,
            resourceScope: null,
          });
        }
        return createDecision({
          allowed: false,
          permission,
          reason: 'RESOURCE_NOT_FOUND',
          source: 'default_deny',
          startTime,
          resourceScope: null,
        });
      }
    } else if ('businessId' in resource) {
      resourceScope = resource as ResourceScope;
    }
  }

  // 4. Tenant Boundary Assertion (Task 5)
  // Cross-tenant authority MUST NEVER match under any circumstances
  if (resourceScope && resourceScope.businessId !== context.businessId) {
    return createDecision({
      allowed: false,
      permission,
      reason: 'TENANT_MISMATCH',
      source: 'default_deny',
      startTime,
      resourceScope,
    });
  }

  // 5. Explicit Overrides Evaluation (Tasks 7, 8, 9)
  const applicableOverrides = (context.permissionOverrides || []).filter(
    (o) => o.permissionKey === permission
  );

  // 5.1 Explicit DENY Precedence (Highest Precedence - overrides all allowances, owners, grants)
  const matchingDeny = applicableOverrides.find(
    (o) => o.effect === 'deny' && overrideMatchesScope(o, resourceScope, context)
  );

  if (matchingDeny) {
    return createDecision({
      allowed: false,
      permission,
      reason: 'EXPLICIT_DENY',
      source: 'explicit_override',
      overrideId: matchingDeny.id,
      matchedScope: matchingDeny.scopeType,
      startTime,
      resourceScope,
    });
  }

  // 5.2 Explicit ALLOW Override
  const matchingAllow = applicableOverrides.find(
    (o) => o.effect === 'allow' && overrideMatchesScope(o, resourceScope, context)
  );

  if (matchingAllow) {
    return createDecision({
      allowed: true,
      permission,
      reason: 'ALLOWED',
      source: matchingAllow.scopeType ? 'explicit_override' : 'legacy_override',
      overrideId: matchingAllow.id,
      matchedScope: matchingAllow.scopeType,
      startTime,
      resourceScope,
    });
  }

  // 6. Business Owner Centralized Policy (Task 14, 15)
  // Active owner has tenant-wide authority for valid canonical business permissions
  if (context.isBusinessOwner || context.membershipRole === 'business_owner') {
    if (CANONICAL_PERMISSION_KEYS.has(permission)) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'owner_policy',
        matchedScope: 'ORGANIZATION',
        startTime,
        resourceScope,
      });
    }
    return createDecision({
      allowed: false,
      permission,
      reason: 'INVALID_PERMISSION',
      source: 'default_deny',
      startTime,
      resourceScope,
    });
  }

  // 7. Permission Existence Check (WHAT)
  const hasRolePermission = (context.rolePermissions || []).includes(permission);
  const matchingScopeGrants = (context.scopeGrants || []).filter(
    (g) => g.permissionKey === permission && g.effect === 'allow'
  );

  // 8. Concrete Scope Grants Evaluation (Task 13)
  for (const grant of matchingScopeGrants) {
    if (scopeGrantMatches(grant, resourceScope, context)) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'scope_grant',
        grantId: grant.id,
        matchedScope: grant.scopeType,
        startTime,
        resourceScope,
      });
    }
  }

  // If user lacks role permission and has no matching scope grant, deny
  if (!hasRolePermission) {
    // Check if SELF ownership applies for this member
    if (resourceScope && resourceScope.ownerUserId && resourceScope.ownerUserId === context.userId) {
      if (!resourceScope.branchId || context.authorizedBranchIds.includes(resourceScope.branchId)) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'self_ownership',
          matchedScope: 'SELF',
          startTime,
          resourceScope,
        });
      }
    }

    return createDecision({
      allowed: false,
      permission,
      reason: 'PERMISSION_MISSING',
      source: 'default_deny',
      startTime,
      resourceScope,
    });
  }

  // 9. Role Permissions + Substantive Organizational Reach (Tasks 10, 11, 12, 16, 17, 18, 19, 21)
  // 9.1 Non-resource operational check (e.g. navigation / general route entry)
  if (!resourceScope) {
    if (context.authorizedBranchIds.length > 0) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'role_permission',
        matchedScope: context.roleScopePreset?.defaultScope || 'PROPERTY',
        startTime,
        resourceScope: null,
      });
    }
    return createDecision({
      allowed: false,
      permission,
      reason: 'OUTSIDE_SCOPE',
      source: 'default_deny',
      startTime,
      resourceScope: null,
    });
  }

  // 9.2 Organization-level resource (branchId is null or undefined)
  if (!resourceScope.branchId) {
    if (context.roleScopePreset?.maxScope === 'ORGANIZATION') {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'role_permission',
        matchedScope: 'ORGANIZATION',
        startTime,
        resourceScope,
      });
    }
    return createDecision({
      allowed: false,
      permission,
      reason: 'OUTSIDE_SCOPE',
      source: 'default_deny',
      startTime,
      resourceScope,
    });
  }

  // 9.3 Property-level resource (branchId is not null)
  // Check if the resource's branch is in the user's authorized branches
  if ((context.authorizedBranchIds || []).includes(resourceScope.branchId)) {
    // Check for Service Area target restriction
    if (resourceScope.serviceAreaId) {
      if ((context.serviceAreaIds || []).includes(resourceScope.serviceAreaId)) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'AREA_TEAM',
          startTime,
          resourceScope,
        });
      }
      // Property-level role (e.g. branch_manager) has property-wide reach over all service areas on their branch
      const isPropertyLevelRole =
        context.membershipRole === 'branch_manager' ||
        context.roleScopePreset?.defaultScope === 'PROPERTY' ||
        context.roleScopePreset?.defaultScope === 'ORGANIZATION';

      if (isPropertyLevelRole) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'PROPERTY',
          startTime,
          resourceScope,
        });
      }
      return createDecision({
        allowed: false,
        permission,
        reason: 'OUTSIDE_SCOPE',
        source: 'default_deny',
        startTime,
        resourceScope,
      });
    }

    // Check for Organization Unit target restriction
    if (resourceScope.organizationUnitId) {
      if (context.organizationUnitIds.includes(resourceScope.organizationUnitId)) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'AREA_TEAM',
          startTime,
          resourceScope,
        });
      }

      // Check active acting assignments for organization unit coverage
      const matchingActingUnit = (context.actingAssignments || []).find(
        (a) => a.organizationUnitId === resourceScope!.organizationUnitId
      );
      if (matchingActingUnit) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'acting_assignment',
          assignmentId: matchingActingUnit.id,
          matchedScope: 'AREA_TEAM',
          startTime,
          resourceScope,
        });
      }

      // Check active secondments for organization unit coverage
      const matchingSecUnit = (context.secondments || []).find(
        (s) => s.organizationUnitId === resourceScope!.organizationUnitId
      );
      if (matchingSecUnit) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'secondment',
          assignmentId: matchingSecUnit.id,
          matchedScope: 'AREA_TEAM',
          startTime,
          resourceScope,
        });
      }

      const isPropertyLevelManager =
        context.isBusinessOwner ||
        context.membershipRole === 'branch_manager' ||
        context.roleScopePreset?.maxScope === 'ORGANIZATION';

      if (isPropertyLevelManager) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'PROPERTY',
          startTime,
          resourceScope,
        });
      }
      return createDecision({
        allowed: false,
        permission,
        reason: 'OUTSIDE_SCOPE',
        source: 'default_deny',
        startTime,
        resourceScope,
      });
    }

    // Check for Department target restriction
    if (resourceScope.departmentId) {
      if (context.departmentIds.includes(resourceScope.departmentId)) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'DEPARTMENT',
          startTime,
          resourceScope,
        });
      }

      // Check active acting assignments for department coverage
      const matchingActingDept = (context.actingAssignments || []).find(
        (a) => a.departmentId === resourceScope!.departmentId
      );
      if (matchingActingDept) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'acting_assignment',
          assignmentId: matchingActingDept.id,
          matchedScope: 'DEPARTMENT',
          startTime,
          resourceScope,
        });
      }

      // Check active secondments for department coverage
      const matchingSecDept = (context.secondments || []).find(
        (s) => s.departmentId === resourceScope!.departmentId
      );
      if (matchingSecDept) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'secondment',
          assignmentId: matchingSecDept.id,
          matchedScope: 'DEPARTMENT',
          startTime,
          resourceScope,
        });
      }

      const isPropertyLevelManager =
        context.isBusinessOwner ||
        context.membershipRole === 'branch_manager' ||
        context.roleScopePreset?.maxScope === 'ORGANIZATION';

      if (isPropertyLevelManager) {
        return createDecision({
          allowed: true,
          permission,
          reason: 'ALLOWED',
          source: 'role_permission',
          matchedScope: 'PROPERTY',
          startTime,
          resourceScope,
        });
      }
      return createDecision({
        allowed: false,
        permission,
        reason: 'OUTSIDE_SCOPE',
        source: 'default_deny',
        startTime,
        resourceScope,
      });
    }

    // General property resource (no narrower department/area target)
    const isSubstantiveBranch = (context.branchAssignments || []).some(
      (b) => b.branchId === resourceScope!.branchId && !b.id.startsWith('sec-')
    );

    if (isSubstantiveBranch) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'role_permission',
        matchedScope: 'PROPERTY',
        startTime,
        resourceScope,
      });
    }

    // 1. Secondment Reach (only if not already a substantive branch)
    const matchingSec = (context.secondments || []).find(
      (s) => s.branchId === resourceScope!.branchId
    );

    if (matchingSec) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'secondment',
        assignmentId: matchingSec.id,
        matchedScope: 'PROPERTY',
        startTime,
        resourceScope,
      });
    }

    // 2. Acting Assignment Reach (only if not already a substantive branch)
    const matchingActingBranch = (context.actingAssignments || []).find(
      (a) => a.branchId === resourceScope!.branchId
    );

    if (matchingActingBranch) {
      return createDecision({
        allowed: true,
        permission,
        reason: 'ALLOWED',
        source: 'acting_assignment',
        assignmentId: matchingActingBranch.id,
        matchedScope: 'PROPERTY',
        startTime,
        resourceScope,
      });
    }

    // 3. Fallback Substantive Role Permission on Authorized Branch
    return createDecision({
      allowed: true,
      permission,
      reason: 'ALLOWED',
      source: 'role_permission',
      matchedScope: 'PROPERTY',
      startTime,
      resourceScope,
    });
  }

  // Branch not in authorizedBranchIds
  return createDecision({
    allowed: false,
    permission,
    reason: 'OUTSIDE_SCOPE',
    source: 'default_deny',
    startTime,
    resourceScope,
  });
}

/**
 * Ergonomic Boolean Policy Check
 *
 * Evaluates whether the authenticated user has permission against a given resource/scope.
 */
export async function can(options: CanOptions): Promise<boolean> {
  const decision = await authorize(options);
  return decision.allowed;
}

/**
 * Server-Side Policy Guard (requirePermission)
 *
 * Enforces authorization and throws a structured AuthorizationContextError if denied.
 * Used to protect server actions, API routes, and service boundaries.
 */
export async function requirePermission(
  options: RequirePermissionOptions
): Promise<{
  context: AuthorizationContext;
  decision: AuthorizationDecision;
  resourceScope: ResourceScope | null;
}> {
  const context = options.context || (await resolveAuthorizationContext());
  const decision = await authorize({
    context,
    permission: options.permission,
    resource: options.resource,
  });

  if (!decision.allowed) {
    switch (decision.reason) {
      case 'UNAUTHENTICATED':
        throw new AuthorizationContextError(
          'UNAUTHENTICATED',
          'Authentication required to perform this action.'
        );

      case 'TENANT_MISMATCH':
        throw new AuthorizationContextError(
          'TENANT_MISMATCH',
          'Access denied across business tenants.'
        );

      case 'MEMBERSHIP_INACTIVE':
        throw new AuthorizationContextError(
          'MEMBERSHIP_INACTIVE',
          'Membership is suspended or inactive.'
        );

      case 'RESOURCE_NOT_FOUND':
        throw new AuthorizationContextError(
          'RESOURCE_NOT_FOUND',
          `Resource target not found for permission ${options.permission}.`
        );

      case 'INVALID_RESOURCE_TYPE':
        throw new AuthorizationContextError(
          'INVALID_RESOURCE_TYPE',
          `Invalid resource type for permission ${options.permission}.`
        );

      case 'EXPLICIT_DENY':
        throw new AuthorizationContextError(
          'EXPLICIT_DENY',
          `Permission '${options.permission}' is explicitly denied for this member.`
        );

      case 'OUTSIDE_SCOPE':
        throw new AuthorizationContextError(
          'OUTSIDE_SCOPE',
          `Permission '${options.permission}' is outside authorized organizational scope.`
        );

      case 'PERMISSION_MISSING':
      default:
        throw new AuthorizationContextError(
          'PERMISSION_DENIED',
          `Permission '${options.permission}' denied.`
        );
    }
  }

  return {
    context,
    decision,
    resourceScope: decision.resourceScope || null,
  };
}

/**
 * Ergonomic alias for requirePermission in production business actions.
 */
export async function requireBusinessPermission(
  options: RequirePermissionOptions
): Promise<{
  context: AuthorizationContext;
  decision: AuthorizationDecision;
  resourceScope: ResourceScope | null;
}> {
  return requirePermission(options);
}

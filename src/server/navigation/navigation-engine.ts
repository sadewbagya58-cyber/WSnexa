import {
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  DashboardNavSectionDTO,
  DashboardNavItemDTO,
} from '@/lib/navigation/dashboard-navigation';
import { AuthorizationContext } from '@/types/authorization.types';
import { PermissionKey } from '@/lib/validation/permission';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

/**
 * Checks whether an AuthorizationContext grants effective permission capability for a nav item.
 * Supports a single PermissionKey or an array of candidate PermissionKeys.
 * Parent hub collapses only if user has NO accessible child permission.
 */
export function hasNavCapability(
  context: AuthorizationContext,
  requiredPerm?: PermissionKey | PermissionKey[]
): boolean {
  if (!requiredPerm) return true;

  const perms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];

  // Business Owner has full access unless explicitly denied across all candidate permissions
  if (context.isBusinessOwner) {
    const allDenied = perms.every((p) =>
      (context.permissionOverrides || []).some((o) => o.permissionKey === p && o.effect === 'deny')
    );
    return !allDenied;
  }

  // Evaluate candidate permissions for built-in/custom roles, overrides, and scope grants
  return perms.some((p) => {
    // 1. Explicit DENY override precedence
    const hasDenyOverride = (context.permissionOverrides || []).some(
      (o) => o.permissionKey === p && o.effect === 'deny'
    );
    if (hasDenyOverride) return false;

    // 2. Role Permissions (built-in or custom role permissions)
    if ((context.rolePermissions || []).includes(p)) return true;

    // 3. Member Permission Overrides (ALLOW effect)
    const hasAllowOverride = (context.permissionOverrides || []).some(
      (o) => o.permissionKey === p && o.effect === 'allow'
    );
    if (hasAllowOverride) return true;

    // 4. Permission Scope Grants (ALLOW effect)
    const hasScopeGrant = (context.scopeGrants || []).some(
      (g) => g.permissionKey === p && g.effect === 'allow'
    );
    if (hasScopeGrant) return true;

    return false;
  });
}

/**
 * Checks whether the user's authorization context satisfies the scope context requirement.
 */
export function hasNavScopeContext(
  context: AuthorizationContext,
  itemContext: 'ORGANIZATION' | 'PROPERTY' | 'MIXED'
): boolean {
  switch (itemContext) {
    case 'ORGANIZATION':
      return Boolean(context.businessId);

    case 'PROPERTY':
      return (context.authorizedBranchIds || []).length > 0 || Boolean(context.activeBranchId);

    case 'MIXED':
      return true;
  }
}

/**
 * Single Canonical Navigation Visibility Resolver for WSNexa Tenant Dashboard.
 * Filters canonical navigation config in-memory based on effective permissions,
 * scope context, and feature flags.
 *
 * Golden Equation:
 * Effective Capability + Scope Context + Feature Flags = Visible Navigation UX
 */
export function resolveDashboardNavigation(
  context: AuthorizationContext
): DashboardNavSectionDTO[] {
  const result: DashboardNavSectionDTO[] = [];

  for (const section of CANONICAL_DASHBOARD_NAV_SECTIONS) {
    const visibleItems: DashboardNavItemDTO[] = [];

    for (const item of section.items) {
      // 1. Permission Capability Check
      const canAccess = hasNavCapability(context, item.requiredPermission);
      if (!canAccess) continue;

      // 2. Scope Context Check
      const hasScope = hasNavScopeContext(context, item.context);
      if (!hasScope) continue;

      // 3. Feature Flag & Badge Handling
      let badge = item.badge;
      if (item.id === 'loyalty' && !IS_LOYALTY_ENABLED) {
        badge = 'Soon';
      }

      visibleItems.push({
        id: item.id,
        label: item.label,
        href: item.href,
        badge,
        custom: item.custom,
      });
    }

    // Collapse empty sections
    if (visibleItems.length > 0) {
      result.push({
        id: section.id,
        title: section.title,
        items: visibleItems,
      });
    }
  }

  return result;
}

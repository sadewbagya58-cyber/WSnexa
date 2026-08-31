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

    // 1.1 Explicit DENY scope grant precedence
    const hasDenyScopeGrant = (context.scopeGrants || []).some(
      (g) => g.permissionKey === p && g.effect === 'deny'
    );
    if (hasDenyScopeGrant) return false;

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

export interface SearchableNavItemDTO {
  id: string;
  label: string;
  href: string;
  icon?: string;
  groupTitle: string;
  aliases?: string[];
}

/**
 * Single Canonical Navigation Visibility Resolver for WSNexa Tenant Dashboard.
 * Filters canonical navigation config in-memory based on effective permissions,
 * scope context, and feature flags.
 * Resolves both top-level groups and authorized collapsible child destinations.
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
      // 1. Permission Capability Check on parent
      const canAccessParent = hasNavCapability(context, item.requiredPermission);
      if (!canAccessParent) continue;

      // 2. Scope Context Check on parent
      const hasScope = hasNavScopeContext(context, item.context);
      if (!hasScope) continue;

      // 3. Resolve child destinations if present
      let visibleChildren: DashboardNavItemDTO[] | undefined;
      if (item.children && item.children.length > 0) {
        visibleChildren = [];
        for (const child of item.children) {
          // Feature flag filter for loyalty sub-destinations
          if (child.id.startsWith('loyalty') && !IS_LOYALTY_ENABLED && child.id !== 'loyalty_hub') {
            continue;
          }

          const canAccessChild = hasNavCapability(context, child.requiredPermission);
          if (!canAccessChild) continue;

          const hasChildScope = hasNavScopeContext(context, child.context);
          if (!hasChildScope) continue;

          let childBadge = child.badge;
          if (child.id === 'loyalty_hub' && !IS_LOYALTY_ENABLED) {
            childBadge = 'Soon';
          }

          visibleChildren.push({
            id: child.id,
            label: child.label,
            href: child.href,
            icon: child.icon,
            badge: childBadge,
            aliases: child.aliases,
            custom: child.custom,
          });
        }
      }

      // 4. Dynamic target href resolution for restricted roles
      let href = item.href;
      if (item.id === 'settings') {
        if (context.isBusinessOwner || hasNavCapability(context, 'business.settings.manage')) {
          href = '/dashboard/settings';
        } else if (hasNavCapability(context, 'business.view')) {
          href = '/dashboard/business';
        } else if (hasNavCapability(context, ['branches.view', 'branches.manage', 'branches.operational.manage'])) {
          href = '/dashboard/branches';
        } else if (hasNavCapability(context, ['venue_profile.view', 'venue_profile.manage'])) {
          href = '/dashboard/venue-profile';
        } else if (hasNavCapability(context, ['order_security.view', 'order_security.manage'])) {
          href = '/dashboard/settings/order-security';
        } else if (visibleChildren && visibleChildren.length > 0) {
          href = visibleChildren[0].href;
        } else {
          href = '/dashboard/settings';
        }
      } else if (item.id === 'orders') {
        if (hasNavCapability(context, ['orders.view', 'orders.create']) || context.isBusinessOwner) {
          href = '/dashboard/orders';
        } else if (hasNavCapability(context, 'kitchen.access')) {
          href = '/dashboard/kitchen';
        } else if (hasNavCapability(context, 'cashier.access')) {
          href = '/dashboard/cashier';
        } else if (hasNavCapability(context, 'waiter.access')) {
          href = '/dashboard/waiter';
        } else if (visibleChildren && visibleChildren.length > 0) {
          href = visibleChildren[0].href;
        }
      } else if (item.id === 'dining') {
        if (hasNavCapability(context, ['tables.view', 'tables.manage']) || context.isBusinessOwner) {
          href = '/dashboard/dining';
        } else if (hasNavCapability(context, ['areas.view', 'areas.manage'])) {
          href = '/dashboard/areas';
        } else if (hasNavCapability(context, ['qr.view', 'qr.generate', 'qr.manage', 'qr.security.reset'])) {
          href = '/dashboard/tables/qr';
        } else if (visibleChildren && visibleChildren.length > 0) {
          href = visibleChildren[0].href;
        }
      } else if (item.id === 'operations') {
        if (hasNavCapability(context, ['inventory.view', 'inventory.items.manage', 'inventory.counts.manage']) || context.isBusinessOwner) {
          href = '/dashboard/inventory';
        } else if (hasNavCapability(context, ['recipes.view', 'recipes.manage', 'recipes.costs.view'])) {
          href = '/dashboard/inventory/recipes';
        } else if (hasNavCapability(context, ['purchasing.view', 'purchasing.create', 'purchasing.approve', 'purchasing.receive'])) {
          href = '/dashboard/inventory/purchasing';
        } else if (hasNavCapability(context, ['suppliers.view', 'suppliers.manage'])) {
          href = '/dashboard/inventory/suppliers';
        } else if (visibleChildren && visibleChildren.length > 0) {
          href = visibleChildren[0].href;
        }
      } else if (item.id === 'team') {
        if (hasNavCapability(context, ['staff.view', 'staff.manage', 'staff.invite']) || context.isBusinessOwner) {
          href = '/dashboard/team';
        } else if (hasNavCapability(context, ['roles.view', 'roles.manage', 'permissions.override.manage'])) {
          href = '/dashboard/access/roles';
        } else if (hasNavCapability(context, ['organization.view', 'organization.manage', 'positions.manage'])) {
          href = '/dashboard/organization';
        } else if (hasNavCapability(context, ['people.view', 'people.manage'])) {
          href = '/dashboard/people';
        } else if (visibleChildren && visibleChildren.length > 0) {
          href = visibleChildren[0].href;
        }
      }

      // 5. Feature Flag & Badge Handling
      let badge = item.badge;
      if (item.id === 'loyalty' && !IS_LOYALTY_ENABLED) {
        badge = 'Soon';
      }

      visibleItems.push({
        id: item.id,
        label: item.label,
        href,
        icon: item.icon,
        badge,
        aliases: item.aliases,
        custom: item.custom,
        children: visibleChildren,
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

/**
 * Resolves all distinct, authorized searchable leaf destinations for Navigation Search.
 * Ensures strict RBAC filtering and prevents unauthorized routes from appearing in search results.
 */
export function resolveSearchableNavItems(
  context: AuthorizationContext
): SearchableNavItemDTO[] {
  const sections = resolveDashboardNavigation(context);
  const items: SearchableNavItemDTO[] = [];
  const seenHrefs = new Set<string>();

  for (const section of sections) {
    for (const group of section.items) {
      // If group has children, index every authorized child
      if (group.children && group.children.length > 0) {
        for (const child of group.children) {
          if (!seenHrefs.has(child.href)) {
            seenHrefs.add(child.href);
            items.push({
              id: child.id,
              label: child.label,
              href: child.href,
              icon: child.icon || group.icon,
              groupTitle: group.label,
              aliases: child.aliases,
            });
          }
        }
      } else {
        // Single destination item (e.g. Dashboard, Reservations, Reports)
        if (!seenHrefs.has(group.href)) {
          seenHrefs.add(group.href);
          items.push({
            id: group.id,
            label: group.label,
            href: group.href,
            icon: group.icon,
            groupTitle: section.title,
            aliases: group.aliases,
          });
        }
      }
    }
  }

  return items;
}

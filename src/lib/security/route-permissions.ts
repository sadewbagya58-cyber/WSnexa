import { PermissionKey } from '@/lib/validation/permission';

export interface RoutePermissionConfig {
  prefix: string;
  permission: PermissionKey;
  exact?: boolean;
}

export const ROUTE_PERMISSION_MAP: RoutePermissionConfig[] = [
  { prefix: '/dashboard/branches', permission: 'branches.manage' },
  { prefix: '/dashboard/business', permission: 'business.settings.manage' },
  { prefix: '/dashboard/cashier', permission: 'cashier.access' },
  { prefix: '/dashboard/kitchen', permission: 'kitchen.access' },
  { prefix: '/dashboard/menu/categories', permission: 'menu.categories.manage' },
  { prefix: '/dashboard/menu/items/new', permission: 'menu.items.create' },
  { prefix: '/dashboard/menu/items', permission: 'menu.view' },
  { prefix: '/dashboard/menu', permission: 'menu.view' },
  { prefix: '/dashboard/reports', permission: 'reports.view' },
  { prefix: '/dashboard/areas', permission: 'areas.manage' },
  { prefix: '/dashboard/dining', permission: 'tables.view' },
  { prefix: '/dashboard/tables/areas', permission: 'areas.manage' },
  { prefix: '/dashboard/tables/bulk', permission: 'tables.create' },
  { prefix: '/dashboard/tables/new', permission: 'tables.create' },
  { prefix: '/dashboard/tables/qr', permission: 'qr.generate' },
  { prefix: '/dashboard/tables', permission: 'tables.view' },
  { prefix: '/dashboard/team/invites', permission: 'staff.invite' },
  { prefix: '/dashboard/team/roles', permission: 'roles.view' },
  { prefix: '/dashboard/team', permission: 'staff.view' },
  { prefix: '/dashboard/waiter/order', permission: 'waiter.orders.create' },
  { prefix: '/dashboard/waiter/menu', permission: 'waiter.orders.create' },
  { prefix: '/dashboard/waiter', permission: 'waiter.requests.view' },
  { prefix: '/dashboard/venue-profile', permission: 'venue_profile.manage' },
  { prefix: '/dashboard/reviews', permission: 'reviews.respond' },
  { prefix: '/dashboard/reputation', permission: 'reputation.view' },
  { prefix: '/dashboard/loyalty/rewards', permission: 'loyalty.rewards.manage' },
  { prefix: '/dashboard/loyalty/customers', permission: 'loyalty.customers.view' },
  { prefix: '/dashboard/loyalty/tiers', permission: 'loyalty.manage' },
  { prefix: '/dashboard/loyalty', permission: 'loyalty.view' },
  { prefix: '/dashboard/inventory/items/new', permission: 'inventory.items.manage' },
  { prefix: '/dashboard/inventory/items', permission: 'inventory.view' },
  { prefix: '/dashboard/inventory/counts', permission: 'inventory.counts.manage' },
  { prefix: '/dashboard/inventory/waste', permission: 'inventory.waste.record' },
  { prefix: '/dashboard/inventory/transfers', permission: 'inventory.transfers.manage' },
  { prefix: '/dashboard/inventory/locations', permission: 'inventory.locations.manage' },
  { prefix: '/dashboard/inventory/recipes', permission: 'inventory.view' },
  { prefix: '/dashboard/inventory/purchasing', permission: 'inventory.view' },
  { prefix: '/dashboard/inventory', permission: 'inventory.view' },
  { prefix: '/dashboard/settings/order-security', permission: 'order_security.view' },
  { prefix: '/dashboard/settings/payments', permission: 'branches.manage' },
  // Phase 30 Access Management Hub
  { prefix: '/dashboard/access/roles', permission: 'roles.view' },
  { prefix: '/dashboard/access/members', permission: 'roles.view' },
  { prefix: '/dashboard/access/scope-grants', permission: 'roles.view' },
  { prefix: '/dashboard/access/diagnostics', permission: 'roles.view' },
  { prefix: '/dashboard/access', permission: 'roles.view' },
  // Phase 29 Organization & People Management
  { prefix: '/dashboard/organization/positions', permission: 'positions.manage' },
  { prefix: '/dashboard/organization/structure', permission: 'organization.view' },
  { prefix: '/dashboard/organization/chart', permission: 'organization.view' },
  { prefix: '/dashboard/organization/job-titles', permission: 'organization.view' },
  { prefix: '/dashboard/organization', permission: 'organization.view' },
  { prefix: '/dashboard/people/acting', permission: 'people.view' },
  { prefix: '/dashboard/people/secondments', permission: 'people.view' },
  { prefix: '/dashboard/people/integrity', permission: 'organization.view' },
  { prefix: '/dashboard/people', permission: 'people.view' },
  { prefix: '/dashboard', permission: 'orders.view', exact: true },
];

/**
  * Resolves the required PermissionKey for a given pathname.
  */
export function getRequiredPermissionForRoute(pathname: string): PermissionKey | null {
  // Sort by prefix length descending to match most specific subroutes first
  const sorted = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length);

  for (const config of sorted) {
    if (config.exact) {
      if (pathname === config.prefix) return config.permission;
    } else {
      if (pathname === config.prefix || pathname.startsWith(`${config.prefix}/`)) {
        return config.permission;
      }
    }
  }

  return null;
}

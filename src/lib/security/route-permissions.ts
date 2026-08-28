import { PermissionKey } from '@/lib/validation/permission';

export interface RoutePermissionConfig {
  prefix: string;
  permission: PermissionKey | PermissionKey[];
  exact?: boolean;
}

export const ROUTE_PERMISSION_MAP: RoutePermissionConfig[] = [
  { prefix: '/dashboard/branches', permission: ['branches.view', 'branches.manage', 'branches.operational.manage'] },
  { prefix: '/dashboard/business', permission: ['business.view', 'business.settings.manage'] },
  { prefix: '/dashboard/cashier', permission: 'cashier.access' },
  { prefix: '/dashboard/kitchen', permission: 'kitchen.access' },
  { prefix: '/dashboard/menu/categories', permission: ['menu.categories.manage', 'menu.manage', 'menu.view'] },
  { prefix: '/dashboard/menu/items/new', permission: ['menu.items.create', 'menu.manage'] },
  { prefix: '/dashboard/menu/items', permission: ['menu.view', 'menu.manage', 'menu.items.create', 'menu.items.edit'] },
  { prefix: '/dashboard/menu', permission: ['menu.view', 'menu.manage'] },
  { prefix: '/dashboard/reports', permission: ['reports.view', 'reports.financial.view', 'reports.export'] },
  { prefix: '/dashboard/areas', permission: ['areas.view', 'areas.manage', 'tables.view', 'tables.manage'] },
  { prefix: '/dashboard/dining', permission: ['tables.view', 'tables.manage', 'areas.view', 'areas.manage', 'qr.view', 'qr.generate', 'qr.manage'] },
  { prefix: '/dashboard/tables/areas', permission: ['areas.view', 'areas.manage', 'tables.view', 'tables.manage'] },
  { prefix: '/dashboard/tables/bulk', permission: ['tables.create', 'tables.manage'] },
  { prefix: '/dashboard/tables/new', permission: ['tables.create', 'tables.manage'] },
  { prefix: '/dashboard/tables/qr', permission: ['qr.view', 'qr.generate', 'qr.manage', 'qr.security.reset'] },
  { prefix: '/dashboard/tables', permission: ['tables.view', 'tables.manage'] },
  { prefix: '/dashboard/team/invites', permission: ['staff.invite', 'staff.manage'] },
  { prefix: '/dashboard/team/roles', permission: ['roles.view', 'roles.manage'] },
  { prefix: '/dashboard/team', permission: ['staff.view', 'staff.manage', 'roles.view', 'roles.manage', 'organization.view', 'people.view'] },
  { prefix: '/dashboard/waiter/order', permission: ['waiter.orders.create', 'waiter.access'] },
  { prefix: '/dashboard/waiter/menu', permission: ['waiter.orders.create', 'waiter.access'] },
  { prefix: '/dashboard/waiter', permission: ['waiter.requests.view', 'waiter.requests.manage', 'waiter.access'] },
  { prefix: '/dashboard/venue-profile', permission: ['venue_profile.view', 'venue_profile.manage'] },
  { prefix: '/dashboard/reviews', permission: ['reviews.view', 'reviews.respond', 'reviews.moderate'] },
  { prefix: '/dashboard/reputation', permission: ['reputation.view', 'reputation.export'] },
  { prefix: '/dashboard/loyalty/rewards', permission: ['loyalty.rewards.manage', 'loyalty.manage', 'loyalty.view'] },
  { prefix: '/dashboard/loyalty/customers', permission: ['loyalty.customers.view', 'loyalty.view'] },
  { prefix: '/dashboard/customers', permission: ['customers.view', 'customers.manage', 'customers.contact_view', 'reviews.view', 'reputation.view', 'loyalty.view'] },
  { prefix: '/dashboard/loyalty/tiers', permission: ['loyalty.manage', 'loyalty.view'] },
  { prefix: '/dashboard/loyalty', permission: ['loyalty.view', 'loyalty.manage'] },
  { prefix: '/dashboard/inventory/settings', permission: ['inventory.settings.manage'] },
  { prefix: '/dashboard/inventory/production', permission: ['inventory.production.manage'] },
  { prefix: '/dashboard/inventory/receiving', permission: ['purchasing.receive'] },
  { prefix: '/dashboard/inventory/items/new', permission: ['inventory.items.manage'] },
  { prefix: '/dashboard/inventory/items', permission: ['inventory.view', 'inventory.items.manage'] },
  { prefix: '/dashboard/inventory/counts/new', permission: ['inventory.counts.manage'] },
  { prefix: '/dashboard/inventory/counts', permission: ['inventory.counts.manage', 'inventory.counts.approve'] },
  { prefix: '/dashboard/inventory/waste', permission: ['inventory.waste.record', 'inventory.items.manage'] },
  { prefix: '/dashboard/inventory/transfers/new', permission: ['inventory.transfers.manage'] },
  { prefix: '/dashboard/inventory/transfers', permission: ['inventory.transfers.manage', 'inventory.transfers.receive'] },
  { prefix: '/dashboard/inventory/locations', permission: ['inventory.locations.manage'] },
  { prefix: '/dashboard/inventory/recipes/new', permission: ['recipes.manage'] },
  { prefix: '/dashboard/inventory/recipes', permission: ['recipes.view', 'recipes.manage', 'recipes.costs.view'] },
  { prefix: '/dashboard/inventory/purchasing/new', permission: ['purchasing.create'] },
  { prefix: '/dashboard/inventory/purchasing', permission: ['purchasing.view', 'purchasing.create', 'purchasing.approve', 'purchasing.receive'] },
  { prefix: '/dashboard/inventory/suppliers', permission: ['suppliers.view', 'suppliers.manage'] },
  { prefix: '/dashboard/inventory', permission: ['inventory.view', 'inventory.items.manage'] },
  { prefix: '/dashboard/settings/order-security', permission: ['order_security.view', 'order_security.manage'] },
  { prefix: '/dashboard/settings/payments', permission: ['branches.manage', 'business.settings.manage'] },
  { prefix: '/dashboard/settings/subscription', permission: ['business.settings.manage', 'owner.transfer'] },
  { prefix: '/dashboard/settings', permission: ['business.view', 'business.settings.manage', 'venue_profile.view', 'branches.view', 'order_security.view'] },
  { prefix: '/dashboard/reservations', permission: ['reservations.view', 'reservations.manage', 'reservations.create'] },
  // Phase 30 Access Management Hub
  { prefix: '/dashboard/access/roles', permission: ['roles.view', 'roles.manage'] },
  { prefix: '/dashboard/access/members', permission: ['roles.view', 'roles.manage'] },
  { prefix: '/dashboard/access/scope-grants', permission: ['roles.view', 'roles.manage'] },
  { prefix: '/dashboard/access/diagnostics', permission: ['roles.view', 'roles.manage'] },
  { prefix: '/dashboard/access', permission: ['roles.view', 'roles.manage'] },
  // Phase 29 Organization & People Management
  { prefix: '/dashboard/organization/positions', permission: ['positions.manage', 'organization.view'] },
  { prefix: '/dashboard/organization/structure', permission: ['organization.view', 'organization.manage'] },
  { prefix: '/dashboard/organization/chart', permission: ['organization.view', 'organization.manage'] },
  { prefix: '/dashboard/organization/job-titles', permission: ['organization.view', 'organization.manage'] },
  { prefix: '/dashboard/organization', permission: ['organization.view', 'organization.manage'] },
  { prefix: '/dashboard/people/acting', permission: ['people.view', 'people.manage'] },
  { prefix: '/dashboard/people/secondments', permission: ['people.view', 'people.manage'] },
  { prefix: '/dashboard/people/integrity', permission: ['organization.view', 'organization.manage'] },
  { prefix: '/dashboard/people', permission: ['people.view', 'people.manage'] },
  // Note: Root '/dashboard' is not restricted to orders.view; any authenticated business member can access.
];

/**
 * Resolves the required PermissionKey (or candidate array) for a given pathname.
 */
export function getRequiredPermissionForRoute(pathname: string): PermissionKey | PermissionKey[] | null {
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

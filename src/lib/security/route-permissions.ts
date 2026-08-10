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
  { prefix: '/dashboard/menu/categories', permission: 'menu.manage' },
  { prefix: '/dashboard/menu/items', permission: 'menu.manage' },
  { prefix: '/dashboard/menu/new', permission: 'menu.manage' },
  { prefix: '/dashboard/menu', permission: 'menu.view' },
  { prefix: '/dashboard/reports', permission: 'reports.view' },
  { prefix: '/dashboard/areas', permission: 'tables.manage' },
  { prefix: '/dashboard/tables/areas', permission: 'tables.manage' },
  { prefix: '/dashboard/tables/bulk', permission: 'tables.manage' },
  { prefix: '/dashboard/tables/new', permission: 'tables.manage' },
  { prefix: '/dashboard/tables/qr', permission: 'qr.manage' },
  { prefix: '/dashboard/tables', permission: 'tables.view' },
  { prefix: '/dashboard/team/invites', permission: 'invitations.manage' },
  { prefix: '/dashboard/team/roles', permission: 'staff.manage' },
  { prefix: '/dashboard/team', permission: 'staff.view' },
  { prefix: '/dashboard/waiter', permission: 'waiter.requests.view' },
  { prefix: '/dashboard/venue-profile', permission: 'venue_profile.manage' },
  { prefix: '/dashboard/reviews', permission: 'reviews.respond' },
  { prefix: '/dashboard/reputation', permission: 'reputation.view' },
  { prefix: '/dashboard/loyalty/rewards', permission: 'loyalty.rewards.manage' },
  { prefix: '/dashboard/loyalty/customers', permission: 'loyalty.customers.view' },
  { prefix: '/dashboard/loyalty/tiers', permission: 'loyalty.manage' },
  { prefix: '/dashboard/loyalty', permission: 'loyalty.view' },
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

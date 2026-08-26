import { PermissionKey } from '@/lib/validation/permission';

export type ScopeContextType = 'ORGANIZATION' | 'PROPERTY' | 'MIXED';

export interface DashboardNavItemConfig {
  id: string;
  label: string;
  href: string;
  requiredPermission?: PermissionKey | PermissionKey[];
  context: ScopeContextType;
  badge?: string;
  exact?: boolean;
  /** When true this item is rendered by a custom component (e.g. SidebarBranchPicker on mobile) */
  custom?: boolean;
}

export interface DashboardNavSectionConfig {
  id: string;
  title: string;
  items: DashboardNavItemConfig[];
}

export interface DashboardNavItemDTO {
  id: string;
  label: string;
  href: string;
  badge?: string;
  custom?: boolean;
}

export interface DashboardNavSectionDTO {
  id: string;
  title: string;
  items: DashboardNavItemDTO[];
}

/**
 * Single Canonical Navigation Configuration Source of Truth for WSNexa Dashboard.
 * Streamlined to 10 Primary Navigation Items in Phase 37 Step 2.
 */
export const CANONICAL_DASHBOARD_NAV_SECTIONS: readonly DashboardNavSectionConfig[] = [
  {
    id: 'workspace',
    title: 'NAVIGATE',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', exact: true, context: 'MIXED' },
      {
        id: 'orders',
        label: 'Orders',
        href: '/dashboard/orders',
        requiredPermission: ['orders.view', 'cashier.access', 'kitchen.access', 'waiter.requests.view', 'waiter.orders.create'],
        context: 'PROPERTY',
      },
      {
        id: 'menu',
        label: 'Menu',
        href: '/dashboard/menu',
        requiredPermission: ['menu.view', 'menu.categories.manage', 'menu.modifiers.manage'],
        context: 'PROPERTY',
      },
      {
        id: 'dining',
        label: 'Dining & QR',
        href: '/dashboard/dining',
        requiredPermission: ['tables.manage', 'tables.view', 'areas.manage', 'qr.manage'],
        context: 'PROPERTY',
      },
      {
        id: 'reservations',
        label: 'Reservations',
        href: '/dashboard/reservations',
        requiredPermission: ['reservations.view', 'reservations.manage'],
        context: 'PROPERTY',
      },
      {
        id: 'customers',
        label: 'Customers',
        href: '/dashboard/customers',
        requiredPermission: ['customers.view', 'customers.manage', 'reviews.respond', 'reputation.view', 'loyalty.view'],
        context: 'ORGANIZATION',
      },
      {
        id: 'operations',
        label: 'Operations',
        href: '/dashboard/inventory',
        requiredPermission: ['inventory.view', 'inventory.counts.manage', 'inventory.waste.record', 'inventory.transfers.manage', 'inventory.locations.manage'],
        context: 'PROPERTY',
      },
      {
        id: 'team',
        label: 'Team',
        href: '/dashboard/team',
        requiredPermission: ['staff.view', 'staff.invite', 'people.view', 'roles.view', 'roles.manage', 'organization.view', 'positions.manage'],
        context: 'ORGANIZATION',
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/dashboard/reports',
        requiredPermission: ['reports.view', 'reports.financial.view', 'reports.export'],
        context: 'MIXED',
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings/subscription',
        requiredPermission: ['business.settings.manage', 'venue_profile.manage', 'branches.manage', 'order_security.manage'],
        context: 'ORGANIZATION',
      },
    ],
  },
];

/**
 * Detail route parent navigation lookup map.
 * Used for active route highlighting when navigating inside sub-pages.
 */
export const DETAIL_ROUTE_PARENT_MAP: Record<string, string> = {
  // Orders Subroutes
  '/dashboard/cashier': '/dashboard/orders',
  '/dashboard/kitchen': '/dashboard/orders',
  '/dashboard/waiter': '/dashboard/orders',
  '/dashboard/waiter/menu': '/dashboard/orders',
  '/dashboard/waiter/order': '/dashboard/orders',

  // Menu Subroutes
  '/dashboard/menu/categories': '/dashboard/menu',
  '/dashboard/menu/items': '/dashboard/menu',

  // Dining Subroutes
  '/dashboard/tables': '/dashboard/dining',
  '/dashboard/areas': '/dashboard/dining',
  '/dashboard/tables/areas': '/dashboard/dining',
  '/dashboard/tables/bulk': '/dashboard/dining',
  '/dashboard/tables/new': '/dashboard/dining',
  '/dashboard/tables/qr': '/dashboard/dining',

  // Customers Subroutes
  '/dashboard/reviews': '/dashboard/customers',
  '/dashboard/reputation': '/dashboard/customers',
  '/dashboard/loyalty': '/dashboard/customers',

  // Operations / Inventory Subroutes
  '/dashboard/inventory/items': '/dashboard/inventory',
  '/dashboard/inventory/counts': '/dashboard/inventory',
  '/dashboard/inventory/waste': '/dashboard/inventory',
  '/dashboard/inventory/transfers': '/dashboard/inventory',
  '/dashboard/inventory/locations': '/dashboard/inventory',
  '/dashboard/inventory/recipes': '/dashboard/inventory',
  '/dashboard/inventory/purchasing': '/dashboard/inventory',
  '/dashboard/inventory/suppliers': '/dashboard/inventory',
  '/dashboard/inventory/receiving': '/dashboard/inventory',
  '/dashboard/inventory/production': '/dashboard/inventory',
  '/dashboard/inventory/settings': '/dashboard/inventory',

  // Team Subroutes
  '/dashboard/team/invites': '/dashboard/team',
  '/dashboard/team/roles': '/dashboard/team',
  '/dashboard/people': '/dashboard/team',
  '/dashboard/people/acting': '/dashboard/team',
  '/dashboard/people/secondments': '/dashboard/team',
  '/dashboard/people/integrity': '/dashboard/team',
  '/dashboard/organization': '/dashboard/team',
  '/dashboard/organization/structure': '/dashboard/team',
  '/dashboard/organization/chart': '/dashboard/team',
  '/dashboard/organization/job-titles': '/dashboard/team',
  '/dashboard/organization/positions': '/dashboard/team',
  '/dashboard/access': '/dashboard/team',
  '/dashboard/access/roles': '/dashboard/team',
  '/dashboard/access/scope-grants': '/dashboard/team',
  '/dashboard/access/diagnostics': '/dashboard/team',
  '/dashboard/access/members': '/dashboard/team',

  // Settings Subroutes
  '/dashboard/business': '/dashboard/settings/subscription',
  '/dashboard/venue-profile': '/dashboard/settings/subscription',
  '/dashboard/branches': '/dashboard/settings/subscription',
  '/dashboard/settings/order-security': '/dashboard/settings/subscription',
  '/dashboard/settings/payments': '/dashboard/settings/subscription',
  '/dashboard/help': '/dashboard/settings/subscription',
  '/dashboard/help/troubleshooting': '/dashboard/settings/subscription',
};

/**
 * Resolves the parent primary nav path for dynamic detail or nested subroutes.
 */
export function getParentNavPath(pathname: string): string {
  // Check explicit static map first
  if (DETAIL_ROUTE_PARENT_MAP[pathname]) {
    return DETAIL_ROUTE_PARENT_MAP[pathname];
  }

  // Dynamic route patterns
  if (pathname.startsWith('/dashboard/orders/')) return '/dashboard/orders';
  if (pathname.startsWith('/dashboard/access/')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/people/')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/organization/')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/inventory/')) return '/dashboard/inventory';
  if (pathname.startsWith('/dashboard/menu/')) return '/dashboard/menu';
  if (pathname.startsWith('/dashboard/customers/')) return '/dashboard/customers';
  if (pathname.startsWith('/dashboard/help/')) return '/dashboard/settings/subscription';

  return pathname;
}

/**
 * Determines whether a navigation item is active given the current pathname.
 */
export function isNavItemActive(item: { href: string; exact?: boolean }, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  const activePath = getParentNavPath(pathname);
  return activePath === item.href || activePath.startsWith(`${item.href}/`);
}

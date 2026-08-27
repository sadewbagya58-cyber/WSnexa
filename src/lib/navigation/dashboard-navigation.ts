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
 * Enriched with comprehensive candidate permission arrays in Phase 37 Step 3 Hotfix.
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
        requiredPermission: [
          'orders.view',
          'orders.create',
          'orders.update_status',
          'orders.cancel',
          'orders.history.view',
          'cashier.access',
          'payments.view',
          'payments.record',
          'payments.void',
          'payments.refund',
          'receipts.print',
          'kitchen.access',
          'kitchen.orders.view',
          'kitchen.update',
          'waiter.access',
          'waiter.requests.view',
          'waiter.requests.manage',
          'waiter.orders.create',
        ],
        context: 'PROPERTY',
      },
      {
        id: 'menu',
        label: 'Menu',
        href: '/dashboard/menu',
        requiredPermission: [
          'menu.view',
          'menu.manage',
          'menu.items.create',
          'menu.items.edit',
          'menu.price.update',
          'menu.availability.update',
          'menu.items.delete',
          'menu.categories.manage',
          'menu.modifiers.manage',
        ],
        context: 'PROPERTY',
      },
      {
        id: 'dining',
        label: 'Dining & QR',
        href: '/dashboard/dining',
        requiredPermission: [
          'tables.view',
          'tables.manage',
          'tables.status.update',
          'tables.create',
          'tables.edit',
          'tables.delete',
          'areas.view',
          'areas.manage',
          'qr.view',
          'qr.manage',
          'qr.generate',
          'qr.security.reset',
        ],
        context: 'PROPERTY',
      },
      {
        id: 'reservations',
        label: 'Reservations',
        href: '/dashboard/reservations',
        requiredPermission: [
          'reservations.view',
          'reservations.create',
          'reservations.manage',
          'reservations.cancel',
          'reservations.assign_tables',
          'reservations.waitlist_manage',
        ],
        context: 'PROPERTY',
      },
      {
        id: 'customers',
        label: 'Customers',
        href: '/dashboard/customers',
        requiredPermission: [
          'customers.view',
          'customers.manage',
          'customers.contact_view',
          'reviews.view',
          'reviews.respond',
          'reviews.moderate',
          'reputation.view',
          'reputation.export',
          'loyalty.view',
          'loyalty.manage',
          'loyalty.rewards.manage',
          'loyalty.customers.view',
          'loyalty.points.adjust',
        ],
        context: 'ORGANIZATION',
      },
      {
        id: 'operations',
        label: 'Operations',
        href: '/dashboard/inventory',
        requiredPermission: [
          'inventory.view',
          'inventory.items.manage',
          'inventory.costs.view',
          'inventory.adjust',
          'inventory.counts.manage',
          'inventory.counts.approve',
          'inventory.waste.record',
          'inventory.transfers.manage',
          'inventory.transfers.receive',
          'inventory.locations.manage',
          'inventory.reports.view',
          'recipes.view',
          'recipes.manage',
          'recipes.costs.view',
          'purchasing.view',
          'purchasing.create',
          'purchasing.approve',
          'purchasing.receive',
          'suppliers.view',
          'suppliers.manage',
          'inventory.cogs.view',
          'inventory.menu_profitability.view',
          'inventory.settings.manage',
          'inventory.production.manage',
        ],
        context: 'PROPERTY',
      },
      {
        id: 'team',
        label: 'Team',
        href: '/dashboard/team',
        requiredPermission: [
          'staff.view',
          'staff.manage',
          'staff.invite',
          'staff.edit',
          'staff.suspend',
          'staff.role.assign',
          'staff.branch.assign',
          'staff.area.assign',
          'roles.view',
          'roles.manage',
          'permissions.override.manage',
          'organization.view',
          'organization.manage',
          'people.view',
          'people.manage',
          'positions.manage',
        ],
        context: 'ORGANIZATION',
      },
      {
        id: 'reports',
        label: 'Reports',
        href: '/dashboard/reports',
        requiredPermission: [
          'reports.view',
          'reports.financial.view',
          'reports.export',
        ],
        context: 'MIXED',
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings/subscription',
        requiredPermission: [
          'business.view',
          'business.settings.manage',
          'venue_profile.view',
          'venue_profile.manage',
          'branches.view',
          'branches.manage',
          'branches.operational.manage',
          'order_security.view',
          'order_security.manage',
        ],
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
  '/dashboard/settings': '/dashboard/settings/subscription',
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
export function isNavItemActive(item: { id?: string; href: string; exact?: boolean }, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  const activePath = getParentNavPath(pathname);
  if (activePath === item.href || activePath.startsWith(`${item.href}/`)) {
    return true;
  }
  // Check mapped parent equivalences
  if (item.id === 'settings' && DETAIL_ROUTE_PARENT_MAP[pathname] === '/dashboard/settings/subscription') {
    return true;
  }
  if (item.id === 'dining' && DETAIL_ROUTE_PARENT_MAP[pathname] === '/dashboard/dining') {
    return true;
  }
  if (item.id === 'operations' && DETAIL_ROUTE_PARENT_MAP[pathname] === '/dashboard/inventory') {
    return true;
  }
  if (item.id === 'team' && DETAIL_ROUTE_PARENT_MAP[pathname] === '/dashboard/team') {
    return true;
  }
  return false;
}

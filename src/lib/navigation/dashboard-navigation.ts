import { PermissionKey } from '@/lib/validation/permission';

export type ScopeContextType = 'ORGANIZATION' | 'PROPERTY' | 'MIXED';

export interface DashboardNavItemConfig {
  id: string;
  label: string;
  href: string;
  requiredPermission?: PermissionKey;
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
 * Frozen during Phase 31 Step 1 & Step 2.
 */
export const CANONICAL_DASHBOARD_NAV_SECTIONS: readonly DashboardNavSectionConfig[] = [
  {
    id: 'overview',
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', requiredPermission: 'orders.view', exact: true, context: 'MIXED' },
      { id: 'reports', label: 'Reports & Analytics', href: '/dashboard/reports', requiredPermission: 'reports.view', context: 'MIXED' },
    ],
  },
  {
    id: 'venue-setup',
    title: 'VENUE SETUP',
    items: [
      { id: 'business', label: 'Business Profile', href: '/dashboard/business', requiredPermission: 'business.settings.manage', context: 'ORGANIZATION' },
      { id: 'venue-profile', label: 'Public Venue Profile', href: '/dashboard/venue-profile', requiredPermission: 'venue_profile.manage', context: 'ORGANIZATION' },
      { id: 'branches', label: 'Branches', href: '/dashboard/branches', requiredPermission: 'branches.manage', custom: true, context: 'ORGANIZATION' },
      { id: 'dining', label: 'Dining Setup', href: '/dashboard/dining', requiredPermission: 'tables.view', context: 'PROPERTY' },
      { id: 'team', label: 'Team & Members', href: '/dashboard/team', requiredPermission: 'staff.view', context: 'ORGANIZATION' },
      { id: 'team-invites', label: 'Staff Invitations', href: '/dashboard/team/invites', requiredPermission: 'staff.invite', context: 'ORGANIZATION' },
    ],
  },
  {
    id: 'organization-people',
    title: 'ORGANIZATION & PEOPLE',
    items: [
      { id: 'organization', label: 'Organization Hub', href: '/dashboard/organization', requiredPermission: 'organization.view', context: 'ORGANIZATION' },
      { id: 'org-structure', label: 'Structure & Units', href: '/dashboard/organization/structure', requiredPermission: 'organization.view', context: 'ORGANIZATION' },
      { id: 'org-chart', label: 'Org Chart', href: '/dashboard/organization/chart', requiredPermission: 'organization.view', context: 'ORGANIZATION' },
      { id: 'job-titles', label: 'Job Titles', href: '/dashboard/organization/job-titles', requiredPermission: 'organization.view', context: 'ORGANIZATION' },
      { id: 'positions', label: 'Positions & Headcount', href: '/dashboard/organization/positions', requiredPermission: 'positions.manage', context: 'ORGANIZATION' },
      { id: 'people', label: 'People Directory', href: '/dashboard/people', requiredPermission: 'people.view', context: 'ORGANIZATION' },
      { id: 'people-acting', label: 'Acting & Coverage', href: '/dashboard/people/acting', requiredPermission: 'people.view', context: 'PROPERTY' },
      { id: 'people-secondments', label: 'Secondments', href: '/dashboard/people/secondments', requiredPermission: 'people.view', context: 'ORGANIZATION' },
      { id: 'people-integrity', label: 'Integrity Diagnostics', href: '/dashboard/people/integrity', requiredPermission: 'organization.view', context: 'ORGANIZATION' },
    ],
  },
  {
    id: 'access-governance',
    title: 'ACCESS & GOVERNANCE',
    items: [
      { id: 'access', label: 'Access Control Hub', href: '/dashboard/access', requiredPermission: 'roles.view', context: 'ORGANIZATION' },
      { id: 'access-roles', label: 'Roles & Templates', href: '/dashboard/access/roles', requiredPermission: 'roles.view', context: 'ORGANIZATION' },
      { id: 'scope-grants', label: 'Scope Grants', href: '/dashboard/access/scope-grants', requiredPermission: 'roles.view', context: 'ORGANIZATION' },
      { id: 'access-diagnostics', label: 'Access Diagnostics', href: '/dashboard/access/diagnostics', requiredPermission: 'roles.view', context: 'ORGANIZATION' },
    ],
  },
  {
    id: 'menu',
    title: 'MENU',
    items: [
      { id: 'menu-overview', label: 'Menu Overview', href: '/dashboard/menu', requiredPermission: 'menu.view', context: 'PROPERTY' },
      { id: 'menu-categories', label: 'Categories', href: '/dashboard/menu/categories', requiredPermission: 'menu.categories.manage', context: 'PROPERTY' },
      { id: 'menu-items', label: 'Menu Items', href: '/dashboard/menu/items', requiredPermission: 'menu.view', context: 'PROPERTY' },
    ],
  },
  {
    id: 'operations',
    title: 'OPERATIONS',
    items: [
      { id: 'cashier', label: 'Cashier POS', href: '/dashboard/cashier', requiredPermission: 'cashier.access', context: 'PROPERTY' },
      { id: 'kitchen', label: 'Kitchen Queue', href: '/dashboard/kitchen', requiredPermission: 'kitchen.access', context: 'PROPERTY' },
      { id: 'waiter', label: 'Waiter Assistance', href: '/dashboard/waiter', requiredPermission: 'waiter.requests.view', context: 'PROPERTY' },
      { id: 'waiter-menu', label: 'Waiter Menu', href: '/dashboard/waiter/menu', requiredPermission: 'waiter.orders.create', context: 'PROPERTY' },
    ],
  },
  {
    id: 'inventory',
    title: 'INVENTORY',
    items: [
      { id: 'inventory-hub', label: 'Inventory Hub', href: '/dashboard/inventory', requiredPermission: 'inventory.view', context: 'PROPERTY' },
      { id: 'stock-items', label: 'Stock Items', href: '/dashboard/inventory/items', requiredPermission: 'inventory.view', context: 'PROPERTY' },
      { id: 'stock-counts', label: 'Stock Counts', href: '/dashboard/inventory/counts', requiredPermission: 'inventory.counts.manage', context: 'PROPERTY' },
      { id: 'waste-tracking', label: 'Waste Tracking', href: '/dashboard/inventory/waste', requiredPermission: 'inventory.waste.record', context: 'PROPERTY' },
      { id: 'stock-transfers', label: 'Stock Transfers', href: '/dashboard/inventory/transfers', requiredPermission: 'inventory.transfers.manage', context: 'ORGANIZATION' },
      { id: 'storage-locations', label: 'Storage Locations', href: '/dashboard/inventory/locations', requiredPermission: 'inventory.locations.manage', context: 'PROPERTY' },
      { id: 'recipes-costing', label: 'Recipes & Costing', href: '/dashboard/inventory/recipes', requiredPermission: 'inventory.view', context: 'PROPERTY' },
      { id: 'purchasing-suppliers', label: 'Purchasing & Suppliers', href: '/dashboard/inventory/purchasing', requiredPermission: 'inventory.view', context: 'ORGANIZATION' },
    ],
  },
  {
    id: 'growth-guests',
    title: 'GROWTH & GUESTS',
    items: [
      { id: 'reviews', label: 'Customer Reviews', href: '/dashboard/reviews', requiredPermission: 'reviews.respond', context: 'PROPERTY' },
      { id: 'reputation', label: 'Reputation & Rankings', href: '/dashboard/reputation', requiredPermission: 'reputation.view', context: 'ORGANIZATION' },
      { id: 'loyalty', label: 'Loyalty & Rewards', href: '/dashboard/loyalty', requiredPermission: 'loyalty.view', badge: 'Soon', context: 'ORGANIZATION' },
    ],
  },
  {
    id: 'settings',
    title: 'SETTINGS',
    items: [
      { id: 'order-security', label: 'Order Security', href: '/dashboard/settings/order-security', requiredPermission: 'order_security.view', context: 'ORGANIZATION' },
      { id: 'payments', label: 'Payment Methods', href: '/dashboard/settings/payments', requiredPermission: 'branches.manage', context: 'PROPERTY' },
    ],
  },
  {
    id: 'support-guidance',
    title: 'SUPPORT & GUIDANCE',
    items: [
      { id: 'help', label: 'Help Center', href: '/dashboard/help', context: 'MIXED' },
    ],
  },
];

/**
 * Detail route parent navigation lookup map.
 * Used for active route highlighting when navigating inside sub-pages.
 */
export const DETAIL_ROUTE_PARENT_MAP: Record<string, string> = {
  '/dashboard/access/members': '/dashboard/access',
  '/dashboard/inventory/suppliers': '/dashboard/inventory/purchasing',
  '/dashboard/inventory/receiving': '/dashboard/inventory',
  '/dashboard/inventory/production': '/dashboard/inventory',
  '/dashboard/inventory/settings': '/dashboard/inventory',
  '/dashboard/waiter/order': '/dashboard/waiter',
  '/dashboard/tables': '/dashboard/dining',
  '/dashboard/areas': '/dashboard/dining',
  '/dashboard/tables/areas': '/dashboard/dining',
  '/dashboard/tables/bulk': '/dashboard/dining',
  '/dashboard/tables/new': '/dashboard/dining',
  '/dashboard/tables/qr': '/dashboard/dining',
  '/dashboard/help/troubleshooting': '/dashboard/help',
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
  if (pathname.startsWith('/dashboard/access/members/')) return '/dashboard/access';
  if (pathname.startsWith('/dashboard/access/roles/')) return '/dashboard/access/roles';
  if (pathname.startsWith('/dashboard/people/')) return '/dashboard/people';
  if (pathname.startsWith('/dashboard/inventory/items/')) return '/dashboard/inventory/items';
  if (pathname.startsWith('/dashboard/inventory/counts/')) return '/dashboard/inventory/counts';
  if (pathname.startsWith('/dashboard/inventory/recipes/')) return '/dashboard/inventory/recipes';
  if (pathname.startsWith('/dashboard/inventory/suppliers/')) return '/dashboard/inventory/purchasing';
  if (pathname.startsWith('/dashboard/inventory/purchasing/')) return '/dashboard/inventory/purchasing';
  if (pathname.startsWith('/dashboard/help/')) return '/dashboard/help';

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

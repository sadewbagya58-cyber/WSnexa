export type PageLayoutVariant = 'standard' | 'wide' | 'workspace';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface DashboardPageMetadata {
  route: string;
  title: string;
  shortTitle?: string;
  description?: string;
  sectionId?: string;
  parentHref?: string;
  parentLabel?: string;
  contextType?: 'ORGANIZATION' | 'PROPERTY' | 'MIXED';
  layoutVariant?: PageLayoutVariant;
  icon?: string;
}

/**
 * Single source of truth for Dashboard Page UX Metadata.
 * Covers all canonical tenant dashboard primary routes, subpages, and dynamic detail routes.
 * Security & permissions remain strictly enforced by server route guards & Policy Engine.
 */
export const DASHBOARD_PAGE_METADATA_REGISTRY: Record<string, DashboardPageMetadata> = {
  '/dashboard': {
    route: '/dashboard',
    title: 'Dashboard Overview',
    shortTitle: 'Dashboard',
    description: 'High-level operational metrics, active orders summary, and quick management links.',
    sectionId: 'overview',
    contextType: 'MIXED',
    layoutVariant: 'standard',
  },
  '/dashboard/reports': {
    route: '/dashboard/reports',
    title: 'Reports & Analytics',
    shortTitle: 'Reports',
    description: 'Real-time sales summaries, revenue trends, product performance, and operational analytics.',
    sectionId: 'overview',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'MIXED',
    layoutVariant: 'wide',
  },
  '/dashboard/business': {
    route: '/dashboard/business',
    title: 'Business Profile & Settings',
    shortTitle: 'Business Profile',
    description: 'Manage legal organization profile, business identity, and master settings.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/venue-profile': {
    route: '/dashboard/venue-profile',
    title: 'Public Venue Profile',
    shortTitle: 'Venue Profile',
    description: 'Customize public customer-facing branding, cover media, description, and discoverability.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/branches': {
    route: '/dashboard/branches',
    title: 'Branches & Locations',
    shortTitle: 'Branches',
    description: 'Configure physical venue locations, branch properties, operational hours, and contact info.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/dining': {
    route: '/dashboard/dining',
    title: 'Dining & Table Setup',
    shortTitle: 'Dining Setup',
    description: 'Manage seating floor plans, seating areas, table layouts, and QR order configurations.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'wide',
  },
  '/dashboard/team': {
    route: '/dashboard/team',
    title: 'Team & Members',
    shortTitle: 'Team',
    description: 'Manage account membership, staff email invitations, role assignments, and status.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/team/invites': {
    route: '/dashboard/team/invites',
    title: 'Staff Invitations',
    shortTitle: 'Invitations',
    description: 'Send and track pending staff onboarding invitation links.',
    sectionId: 'venue-setup',
    parentHref: '/dashboard/team',
    parentLabel: 'Team & Members',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/organization': {
    route: '/dashboard/organization',
    title: 'Organization Hub',
    shortTitle: 'Org Hub',
    description: 'Multi-branch organizational architecture, department hierarchy, and headcount hub.',
    sectionId: 'organization-people',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/organization/structure': {
    route: '/dashboard/organization/structure',
    title: 'Structure & Units',
    shortTitle: 'Org Structure',
    description: 'Define organizational units, branch departments, and team divisions.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/organization',
    parentLabel: 'Organization Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/organization/chart': {
    route: '/dashboard/organization/chart',
    title: 'Organization Chart',
    shortTitle: 'Org Chart',
    description: 'Visual reporting tree and organizational hierarchy breakdown.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/organization',
    parentLabel: 'Organization Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'wide',
  },
  '/dashboard/organization/job-titles': {
    route: '/dashboard/organization/job-titles',
    title: 'Job Titles Catalog',
    shortTitle: 'Job Titles',
    description: 'Catalog of standardized job titles and employment classifications.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/organization',
    parentLabel: 'Organization Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/organization/positions': {
    route: '/dashboard/organization/positions',
    title: 'Positions & Headcount',
    shortTitle: 'Positions',
    description: 'Concrete staffing slot allocations and headcount capacity management.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/organization',
    parentLabel: 'Organization Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/people': {
    route: '/dashboard/people',
    title: 'People Directory',
    shortTitle: 'People',
    description: 'Employee records, primary department placements, job titles, and position assignments.',
    sectionId: 'organization-people',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/people/acting': {
    route: '/dashboard/people/acting',
    title: 'Acting & Coverage',
    shortTitle: 'Acting Coverage',
    description: 'Manage temporary acting supervisor assignments and operational coverage windows.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/people',
    parentLabel: 'People Directory',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/people/secondments': {
    route: '/dashboard/people/secondments',
    title: 'Secondments & Transfers',
    shortTitle: 'Secondments',
    description: 'Track inter-branch staff secondments and temporary location transfers.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/people',
    parentLabel: 'People Directory',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/people/integrity': {
    route: '/dashboard/people/integrity',
    title: 'Integrity Diagnostics',
    shortTitle: 'Integrity',
    description: 'Headcount integrity, orphaned assignments, and organizational validity audit.',
    sectionId: 'organization-people',
    parentHref: '/dashboard/people',
    parentLabel: 'People Directory',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/access': {
    route: '/dashboard/access',
    title: 'Access Control Hub',
    shortTitle: 'Access Hub',
    description: 'Policy Engine RBAC V2 governance, custom role bundles, scope grants, and overrides.',
    sectionId: 'access-governance',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/access/roles': {
    route: '/dashboard/access/roles',
    title: 'Roles & Templates',
    shortTitle: 'Roles',
    description: 'Manage built-in role templates and custom capability permission bundles.',
    sectionId: 'access-governance',
    parentHref: '/dashboard/access',
    parentLabel: 'Access Control Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/access/scope-grants': {
    route: '/dashboard/access/scope-grants',
    title: 'Scope Grants Manager',
    shortTitle: 'Scope Grants',
    description: 'Manage explicit scope grants across properties, departments, and service areas.',
    sectionId: 'access-governance',
    parentHref: '/dashboard/access',
    parentLabel: 'Access Control Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/access/diagnostics': {
    route: '/dashboard/access/diagnostics',
    title: 'Access Diagnostics Engine',
    shortTitle: 'Diagnostics',
    description: 'Interactive Policy Engine evaluation tracer, provenance breakdown, and permission simulation.',
    sectionId: 'access-governance',
    parentHref: '/dashboard/access',
    parentLabel: 'Access Control Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'wide',
  },
  '/dashboard/menu': {
    route: '/dashboard/menu',
    title: 'Menu Overview',
    shortTitle: 'Menu',
    description: 'Manage active food and beverage offerings, categories, items, and pricing.',
    sectionId: 'menu',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/menu/categories': {
    route: '/dashboard/menu/categories',
    title: 'Menu Categories',
    shortTitle: 'Categories',
    description: 'Organize menu items into display categories, reorder items, and manage availability.',
    sectionId: 'menu',
    parentHref: '/dashboard/menu',
    parentLabel: 'Menu Overview',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/menu/items': {
    route: '/dashboard/menu/items',
    title: 'Menu Items Catalog',
    shortTitle: 'Menu Items',
    description: 'Comprehensive item catalog, pricing, dietary flags, and modifier group associations.',
    sectionId: 'menu',
    parentHref: '/dashboard/menu',
    parentLabel: 'Menu Overview',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/cashier': {
    route: '/dashboard/cashier',
    title: 'Cashier POS Workspace',
    shortTitle: 'Cashier POS',
    description: 'Point of sale terminal workspace for order taking, payment collection, and bill splitting.',
    sectionId: 'operations',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'workspace',
  },
  '/dashboard/kitchen': {
    route: '/dashboard/kitchen',
    title: 'Kitchen Display Queue',
    shortTitle: 'Kitchen Queue',
    description: 'Live order display system for line cooks, preparation status, and kitchen ticket clearing.',
    sectionId: 'operations',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'workspace',
  },
  '/dashboard/waiter': {
    route: '/dashboard/waiter',
    title: 'Waiter Assistance Queue',
    shortTitle: 'Waiter Queue',
    description: 'Real-time floor request assistance workspace for waitstaff and table service.',
    sectionId: 'operations',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'workspace',
  },
  '/dashboard/waiter/menu': {
    route: '/dashboard/waiter/menu',
    title: 'Waiter Menu Quick Reference',
    shortTitle: 'Waiter Menu',
    description: 'Fast mobile-friendly menu item reference and table ordering for waitstaff.',
    sectionId: 'operations',
    parentHref: '/dashboard/waiter',
    parentLabel: 'Waiter Assistance',
    contextType: 'PROPERTY',
    layoutVariant: 'workspace',
  },
  '/dashboard/inventory': {
    route: '/dashboard/inventory',
    title: 'Inventory Hub',
    shortTitle: 'Inventory',
    description: 'Stock tracking overview, low stock alerts, valuation, and inventory operations.',
    sectionId: 'inventory',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/items': {
    route: '/dashboard/inventory/items',
    title: 'Stock Items Catalog',
    shortTitle: 'Stock Items',
    description: 'Manage raw ingredients, packaged goods, unit measures, and reorder thresholds.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/counts': {
    route: '/dashboard/inventory/counts',
    title: 'Stock Counts Audit',
    shortTitle: 'Stock Counts',
    description: 'Physical inventory audits, stock variance logging, and reconciliation records.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/waste': {
    route: '/dashboard/inventory/waste',
    title: 'Waste & Spoilage Tracking',
    shortTitle: 'Waste Tracking',
    description: 'Log ingredient spoilage, kitchen waste, damage losses, and cost variances.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/transfers': {
    route: '/dashboard/inventory/transfers',
    title: 'Inter-Branch Stock Transfers',
    shortTitle: 'Stock Transfers',
    description: 'Request, dispatch, and receive inventory transfers between branch locations.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/locations': {
    route: '/dashboard/inventory/locations',
    title: 'Storage Locations',
    shortTitle: 'Storage',
    description: 'Configure storerooms, walk-in coolers, dry storage shelves, and bin locations.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/recipes': {
    route: '/dashboard/inventory/recipes',
    title: 'Recipes & Menu Costing',
    shortTitle: 'Recipes & Costing',
    description: 'Ingredient yield formulas, recipe cost analysis, and food cost margin tracking.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/inventory/purchasing': {
    route: '/dashboard/inventory/purchasing',
    title: 'Purchasing & Suppliers',
    shortTitle: 'Purchasing & Suppliers',
    description: 'Purchase orders, vendor directory, receiving logs, and supplier management.',
    sectionId: 'inventory',
    parentHref: '/dashboard/inventory',
    parentLabel: 'Inventory Hub',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/customers': {
    route: '/dashboard/customers',
    title: 'Guest CRM & Retention',
    shortTitle: 'Guest CRM',
    description: 'Manage guest profiles, behavioral segmentation, retention risk, and auditable CRM actions.',
    sectionId: 'growth-guests',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/reviews': {
    route: '/dashboard/reviews',
    title: 'Customer Reviews',
    shortTitle: 'Reviews',
    description: 'Monitor guest feedback, respond to verified ratings, and analyze guest satisfaction.',
    sectionId: 'growth-guests',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/reputation': {
    route: '/dashboard/reputation',
    title: 'Reputation & Rankings',
    shortTitle: 'Reputation',
    description: 'Public rating confidence, customer retention analytics, and venue discovery rank.',
    sectionId: 'growth-guests',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/loyalty': {
    route: '/dashboard/loyalty',
    title: 'Loyalty & Rewards Program',
    shortTitle: 'Loyalty Program',
    description: 'Customer rewards configuration, points earning models, and redemption tiers.',
    sectionId: 'growth-guests',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/settings/order-security': {
    route: '/dashboard/settings/order-security',
    title: 'Order Security Settings',
    shortTitle: 'Order Security',
    description: 'Configure PIN verification, guest ordering security thresholds, and Fraud Protection.',
    sectionId: 'settings',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'ORGANIZATION',
    layoutVariant: 'standard',
  },
  '/dashboard/settings/payments': {
    route: '/dashboard/settings/payments',
    title: 'Payment Methods & Gateways',
    shortTitle: 'Payment Methods',
    description: 'Configure accepted card gateways, cash drawer rules, and payment processor keys.',
    sectionId: 'settings',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'PROPERTY',
    layoutVariant: 'standard',
  },
  '/dashboard/help': {
    route: '/dashboard/help',
    title: 'Help Center & Documentation',
    shortTitle: 'Help Center',
    description: 'WSNexa knowledge base, role-specific user guides, and troubleshooting support.',
    sectionId: 'support-guidance',
    parentHref: '/dashboard',
    parentLabel: 'Dashboard',
    contextType: 'MIXED',
    layoutVariant: 'standard',
  },
};

/**
 * Resolves DashboardPageMetadata for any given pathname (including dynamic detail routes).
 */
export function getPageMetadata(pathname: string): DashboardPageMetadata {
  // 1. Direct static registry lookup
  if (DASHBOARD_PAGE_METADATA_REGISTRY[pathname]) {
    return DASHBOARD_PAGE_METADATA_REGISTRY[pathname];
  }

  // 2. Dynamic Detail Route Patterns
  if (pathname.startsWith('/dashboard/access/roles/')) {
    return {
      route: pathname,
      title: 'Custom Role Details',
      shortTitle: 'Role Details',
      description: 'Inspect and configure custom role capabilities, scopes, and member assignments.',
      sectionId: 'access-governance',
      parentHref: '/dashboard/access/roles',
      parentLabel: 'Roles & Templates',
      contextType: 'ORGANIZATION',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/access/members/')) {
    return {
      route: pathname,
      title: 'Member Access Profile',
      shortTitle: 'Member Access',
      description: 'Effective permission breakdown, explicit overrides, and scope grants inspector.',
      sectionId: 'access-governance',
      parentHref: '/dashboard/access',
      parentLabel: 'Access Control Hub',
      contextType: 'ORGANIZATION',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/people/')) {
    return {
      route: pathname,
      title: 'Employee Profile',
      shortTitle: 'Employee Profile',
      description: 'Organizational employment details, department placement, position, and acting windows.',
      sectionId: 'organization-people',
      parentHref: '/dashboard/people',
      parentLabel: 'People Directory',
      contextType: 'ORGANIZATION',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/inventory/items/')) {
    return {
      route: pathname,
      title: 'Stock Item Detail',
      shortTitle: 'Item Detail',
      description: 'Stock level metrics, reorder thresholds, supplier history, and unit pricing.',
      sectionId: 'inventory',
      parentHref: '/dashboard/inventory/items',
      parentLabel: 'Stock Items',
      contextType: 'PROPERTY',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/inventory/counts/')) {
    return {
      route: pathname,
      title: 'Stock Count Audit',
      shortTitle: 'Count Audit',
      description: 'Physical inventory audit sheet, count entry, variance log, and reconciliation.',
      sectionId: 'inventory',
      parentHref: '/dashboard/inventory/counts',
      parentLabel: 'Stock Counts',
      contextType: 'PROPERTY',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/inventory/recipes/')) {
    return {
      route: pathname,
      title: 'Recipe Detail & Costing',
      shortTitle: 'Recipe Detail',
      description: 'Ingredient yield formula, food cost percentage calculation, and portion pricing.',
      sectionId: 'inventory',
      parentHref: '/dashboard/inventory/recipes',
      parentLabel: 'Recipes & Costing',
      contextType: 'PROPERTY',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/inventory/purchasing/')) {
    return {
      route: pathname,
      title: 'Purchase Order Detail',
      shortTitle: 'PO Detail',
      description: 'Vendor order line items, order status, delivery receiving, and cost totals.',
      sectionId: 'inventory',
      parentHref: '/dashboard/inventory/purchasing',
      parentLabel: 'Purchasing & Suppliers',
      contextType: 'ORGANIZATION',
      layoutVariant: 'standard',
    };
  }

  if (pathname.startsWith('/dashboard/help/')) {
    return {
      route: pathname,
      title: 'Help Article',
      shortTitle: 'Article',
      description: 'WSNexa knowledge base guide and troubleshooting article.',
      sectionId: 'support-guidance',
      parentHref: '/dashboard/help',
      parentLabel: 'Help Center',
      contextType: 'MIXED',
      layoutVariant: 'standard',
    };
  }

  // Fallback for unlisted dashboard pages
  return {
    route: pathname,
    title: 'WSNexa Dashboard',
    shortTitle: 'Dashboard',
    description: 'WSNexa POS & Management System.',
    contextType: 'MIXED',
    layoutVariant: 'standard',
  };
}

/**
 * Builds lightweight breadcrumb items chain for a given pathname.
 * Recursively resolves ancestor parents so subpages map cleanly back to Dashboard.
 */
export function getPageBreadcrumbs(pathname: string, customEntityName?: string): BreadcrumbItem[] {
  if (pathname === '/dashboard') {
    return [{ label: 'Dashboard' }];
  }

  const meta = getPageMetadata(pathname);
  const currentLabel: string = customEntityName || meta.title || meta.shortTitle || 'Detail';
  const ancestors: BreadcrumbItem[] = [];
  let currPath: string | undefined = pathname;
  const visited = new Set<string>();

  while (currPath && currPath !== '/dashboard' && !visited.has(currPath)) {
    visited.add(currPath);
    const currMeta = getPageMetadata(currPath);
    if (currMeta.parentHref && currMeta.parentLabel) {
      if (currMeta.parentHref !== '/dashboard') {
        ancestors.unshift({ label: currMeta.parentLabel, href: currMeta.parentHref });
      }
      currPath = currMeta.parentHref;
    } else {
      break;
    }
  }

  return [
    { label: 'Dashboard', href: '/dashboard' },
    ...ancestors,
    { label: currentLabel },
  ];
}

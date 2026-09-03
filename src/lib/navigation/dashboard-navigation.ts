import { PermissionKey } from '@/lib/validation/permission';

export type ScopeContextType = 'ORGANIZATION' | 'PROPERTY' | 'MIXED';

export interface DashboardNavItemConfig {
  id: string;
  label: string;
  href: string;
  icon?: string;
  requiredPermission?: PermissionKey | PermissionKey[];
  context: ScopeContextType;
  badge?: string;
  exact?: boolean;
  aliases?: string[];
  /** When true this item is rendered by a custom component (e.g. SidebarBranchPicker on mobile) */
  custom?: boolean;
  children?: DashboardNavItemConfig[];
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
  icon?: string;
  badge?: string;
  aliases?: string[];
  custom?: boolean;
  children?: DashboardNavItemDTO[];
}

export interface DashboardNavSectionDTO {
  id: string;
  title: string;
  items: DashboardNavItemDTO[];
}

/**
 * Single Canonical Navigation Configuration Source of Truth for WSNexa Dashboard.
 * 10 Primary Navigation Groups with Clean & Discoverable Collapsible Children.
 */
export const CANONICAL_DASHBOARD_NAV_SECTIONS: readonly DashboardNavSectionConfig[] = [
  {
    id: 'workspace',
    title: 'NAVIGATE',
    items: [
      // 1. Dashboard
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: '📊',
        exact: true,
        context: 'MIXED',
        aliases: ['home', 'overview', 'metrics', 'analytics summary'],
      },

      // 2. Orders
      {
        id: 'orders',
        label: 'Orders',
        href: '/dashboard/orders',
        icon: '🧾',
        context: 'PROPERTY',
        aliases: ['order', 'kds', 'pos', 'sales', 'tickets'],
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
        children: [
          {
            id: 'orders_queue',
            label: 'Orders Queue',
            href: '/dashboard/orders',
            icon: '📋',
            exact: true,
            context: 'PROPERTY',
            aliases: ['live orders', 'active orders', 'order history'],
            requiredPermission: ['orders.view', 'orders.history.view', 'orders.create'],
          },
          {
            id: 'kitchen_kds',
            label: 'Kitchen (KDS)',
            href: '/dashboard/kitchen',
            icon: '🍳',
            context: 'PROPERTY',
            aliases: ['kds', 'cook display', 'kitchen queue', 'tickets'],
            requiredPermission: ['kitchen.access', 'kitchen.orders.view', 'kitchen.update'],
          },
          {
            id: 'cashier_pos',
            label: 'Cashier & POS',
            href: '/dashboard/cashier',
            icon: '💵',
            context: 'PROPERTY',
            aliases: ['pos', 'checkout', 'bill', 'receipts', 'settlement'],
            requiredPermission: ['cashier.access', 'payments.view', 'payments.record'],
          },
          {
            id: 'waiter_terminal',
            label: 'Waiter Terminal',
            href: '/dashboard/waiter',
            icon: '🛎️',
            exact: true,
            context: 'PROPERTY',
            aliases: ['waiter calls', 'assistance', 'table call'],
            requiredPermission: ['waiter.access', 'waiter.requests.view', 'waiter.requests.manage'],
          },
          {
            id: 'waiter_order',
            label: 'Take Order',
            href: '/dashboard/waiter/order',
            icon: '📝',
            context: 'PROPERTY',
            aliases: ['waiter order entry', 'new order table'],
            requiredPermission: ['waiter.orders.create', 'waiter.access'],
          },
          {
            id: 'waiter_menu',
            label: 'Quick Menu',
            href: '/dashboard/waiter/menu',
            icon: '📖',
            context: 'PROPERTY',
            aliases: ['waiter menu items', 'dish lookup'],
            requiredPermission: ['waiter.orders.create', 'waiter.access'],
          },
        ],
      },

      // 3. Menu
      {
        id: 'menu',
        label: 'Menu',
        href: '/dashboard/menu',
        icon: '🍽️',
        context: 'PROPERTY',
        aliases: ['dishes', 'food', 'drinks', 'pricing', 'catalog'],
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
        children: [
          {
            id: 'menu_overview',
            label: 'Menu Overview',
            href: '/dashboard/menu',
            icon: '📋',
            exact: true,
            context: 'PROPERTY',
            aliases: ['menu catalog', 'all dishes'],
            requiredPermission: ['menu.view', 'menu.manage'],
          },
          {
            id: 'menu_categories',
            label: 'Categories',
            href: '/dashboard/menu/categories',
            icon: '🗂️',
            context: 'PROPERTY',
            aliases: ['sections', 'course', 'groups'],
            requiredPermission: ['menu.categories.manage', 'menu.manage', 'menu.view'],
          },
          {
            id: 'menu_items',
            label: 'Menu Items',
            href: '/dashboard/menu/items',
            icon: '🍔',
            exact: true,
            context: 'PROPERTY',
            aliases: ['dishes', 'items list', 'products'],
            requiredPermission: ['menu.view', 'menu.items.create', 'menu.items.edit', 'menu.manage'],
          },
          {
            id: 'menu_new_item',
            label: '+ Add Menu Item',
            href: '/dashboard/menu/items/new',
            icon: '➕',
            context: 'PROPERTY',
            aliases: ['create dish', 'new item', 'add food'],
            requiredPermission: ['menu.items.create', 'menu.manage'],
          },
        ],
      },

      // 4. Dining & QR
      {
        id: 'dining',
        label: 'Dining & QR',
        href: '/dashboard/dining',
        icon: '🪑',
        context: 'PROPERTY',
        aliases: ['tables', 'qr', 'zones', 'areas', 'floor plan', 'service areas'],
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
        children: [
          {
            id: 'dining_overview',
            label: 'Dining Overview',
            href: '/dashboard/dining',
            icon: '🗺️',
            exact: true,
            context: 'PROPERTY',
            aliases: ['floor overview', 'dining status'],
            requiredPermission: ['tables.view', 'tables.manage', 'areas.view'],
          },
          {
            id: 'service_areas',
            label: 'Service Areas',
            href: '/dashboard/areas',
            icon: '🏷️',
            context: 'PROPERTY',
            aliases: ['sections', 'rooftop', 'patio', 'indoor hall', 'zones'],
            requiredPermission: ['areas.view', 'areas.manage'],
          },
          {
            id: 'dining_tables',
            label: 'Dining Tables',
            href: '/dashboard/tables',
            icon: '🪑',
            exact: true,
            context: 'PROPERTY',
            aliases: ['table list', 'table numbers', 'table setup'],
            requiredPermission: ['tables.view', 'tables.manage'],
          },
          {
            id: 'qr_codes',
            label: 'QR Codes',
            href: '/dashboard/tables/qr',
            icon: '📱',
            context: 'PROPERTY',
            aliases: ['qr tokens', 'table qr', 'print qr', 'generate qr'],
            requiredPermission: ['qr.view', 'qr.generate', 'qr.manage', 'qr.security.reset'],
          },
          {
            id: 'tables_bulk',
            label: 'Bulk Table Setup',
            href: '/dashboard/tables/bulk',
            icon: '⚡',
            context: 'PROPERTY',
            aliases: ['generate tables', 'batch tables'],
            requiredPermission: ['tables.create', 'tables.manage'],
          },
        ],
      },

      // 5. Reservations
      {
        id: 'reservations',
        label: 'Reservations',
        href: '/dashboard/reservations',
        icon: '📅',
        exact: true,
        context: 'PROPERTY',
        aliases: ['booking', 'table booking', 'guest reservation', 'waitlist'],
        requiredPermission: [
          'reservations.view',
          'reservations.create',
          'reservations.manage',
          'reservations.cancel',
          'reservations.assign_tables',
          'reservations.waitlist_manage',
        ],
      },

      // 6. Customers
      {
        id: 'customers',
        label: 'Customers',
        href: '/dashboard/customers',
        icon: '👥',
        context: 'ORGANIZATION',
        aliases: ['crm', 'guests', 'clients', 'reviews', 'ratings', 'loyalty', 'points'],
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
        children: [
          {
            id: 'customer_directory',
            label: 'Customer Directory',
            href: '/dashboard/customers',
            icon: '👤',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['crm', 'guest database', 'contacts'],
            requiredPermission: ['customers.view', 'customers.manage'],
          },
          {
            id: 'customer_reviews',
            label: 'Guest Reviews',
            href: '/dashboard/reviews',
            icon: '⭐',
            context: 'ORGANIZATION',
            aliases: ['feedback', 'ratings', 'customer comments'],
            requiredPermission: ['reviews.view', 'reviews.respond', 'reviews.moderate'],
          },
          {
            id: 'customer_reputation',
            label: 'Reputation & Scores',
            href: '/dashboard/reputation',
            icon: '📈',
            context: 'ORGANIZATION',
            aliases: ['csat', 'nps', 'score trends'],
            requiredPermission: ['reputation.view', 'reputation.export'],
          },
          {
            id: 'loyalty_hub',
            label: 'Loyalty Program',
            href: '/dashboard/loyalty',
            icon: '🎁',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['rewards program', 'points rules'],
            requiredPermission: ['loyalty.view', 'loyalty.manage'],
          },
          {
            id: 'loyalty_rewards',
            label: 'Loyalty Rewards',
            href: '/dashboard/loyalty/rewards',
            icon: '🎟️',
            context: 'ORGANIZATION',
            aliases: ['coupons', 'free items', 'reward vouchers'],
            requiredPermission: ['loyalty.rewards.manage', 'loyalty.manage'],
          },
          {
            id: 'loyalty_members',
            label: 'Loyalty Members',
            href: '/dashboard/loyalty/customers',
            icon: '💳',
            context: 'ORGANIZATION',
            aliases: ['member points', 'balances', 'vip guests'],
            requiredPermission: ['loyalty.customers.view', 'loyalty.view'],
          },
        ],
      },

      // 7. Operations (Inventory & Kitchen Procurement)
      {
        id: 'operations',
        label: 'Operations',
        href: '/dashboard/inventory',
        icon: '📦',
        context: 'PROPERTY',
        aliases: ['inventory', 'stock', 'supplies', 'recipes', 'ingredients', 'purchasing', 'po', 'grn', 'suppliers', 'transfers', 'counts', 'waste'],
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
        children: [
          {
            id: 'operations_overview',
            label: 'Operations Hub',
            href: '/dashboard/inventory',
            icon: '📊',
            exact: true,
            context: 'PROPERTY',
            aliases: ['inventory overview', 'stock valuation', 'low stock alerts'],
            requiredPermission: ['inventory.view', 'inventory.items.manage'],
          },
          {
            id: 'stock_items',
            label: 'Stock Items',
            href: '/dashboard/inventory/items',
            icon: '🥦',
            context: 'PROPERTY',
            aliases: ['ingredients', 'raw materials', 'units', 'stock on hand'],
            requiredPermission: ['inventory.view', 'inventory.items.manage'],
          },
          {
            id: 'recipes_bom',
            label: 'Recipes & BOM',
            href: '/dashboard/inventory/recipes',
            icon: '🍲',
            context: 'PROPERTY',
            aliases: ['food cost', 'bill of materials', 'dish ingredients', 'cogs'],
            requiredPermission: ['recipes.view', 'recipes.manage', 'recipes.costs.view'],
          },
          {
            id: 'suppliers',
            label: 'Suppliers',
            href: '/dashboard/inventory/suppliers',
            icon: '🏭',
            context: 'PROPERTY',
            aliases: ['vendors', 'supplier directory', 'leads'],
            requiredPermission: ['suppliers.view', 'suppliers.manage'],
          },
          {
            id: 'purchasing_po',
            label: 'Purchasing (PO)',
            href: '/dashboard/inventory/purchasing',
            icon: '📦',
            context: 'PROPERTY',
            aliases: ['purchase orders', 'procurement', 'vendor orders'],
            requiredPermission: ['purchasing.view', 'purchasing.create', 'purchasing.approve'],
          },
          {
            id: 'receiving_grn',
            label: 'Goods Receiving',
            href: '/dashboard/inventory/receiving',
            icon: '📥',
            context: 'PROPERTY',
            aliases: ['grn', 'delivery check', 'receive items'],
            requiredPermission: ['purchasing.receive', 'purchasing.approve'],
          },
          {
            id: 'stock_transfers',
            label: 'Stock Transfers',
            href: '/dashboard/inventory/transfers',
            icon: '🚚',
            context: 'PROPERTY',
            aliases: ['branch transfers', 'inter-outlet transfer'],
            requiredPermission: ['inventory.transfers.manage', 'inventory.transfers.receive'],
          },
          {
            id: 'physical_counts',
            label: 'Physical Counts',
            href: '/dashboard/inventory/counts',
            icon: '📋',
            context: 'PROPERTY',
            aliases: ['stock count', 'stocktake', 'audit', 'variance'],
            requiredPermission: ['inventory.counts.manage', 'inventory.counts.approve'],
          },
          {
            id: 'storage_locations',
            label: 'Storage Locations',
            href: '/dashboard/inventory/locations',
            icon: '📍',
            context: 'PROPERTY',
            aliases: ['freezer', 'dry store', 'kitchen rack', 'warehouses'],
            requiredPermission: ['inventory.locations.manage'],
          },
          {
            id: 'waste_log',
            label: 'Waste Log',
            href: '/dashboard/inventory/waste',
            icon: '🗑️',
            context: 'PROPERTY',
            aliases: ['spoilage', 'damage', 'waste adjustments'],
            requiredPermission: ['inventory.waste.record', 'inventory.items.manage'],
          },
          {
            id: 'production_batches',
            label: 'Production Batches',
            href: '/dashboard/inventory/production',
            icon: '⚙️',
            context: 'PROPERTY',
            aliases: ['prep batches', 'sauce prep', 'butchery'],
            requiredPermission: ['inventory.production.manage'],
          },
          {
            id: 'inventory_policies',
            label: 'Inventory Policies',
            href: '/dashboard/inventory/settings',
            icon: '⚙️',
            context: 'PROPERTY',
            aliases: ['cogs rules', 'auto deduction', 'negative stock'],
            requiredPermission: ['inventory.settings.manage'],
          },
        ],
      },

      // 8. Team
      {
        id: 'team',
        label: 'Team',
        href: '/dashboard/team',
        icon: '👔',
        context: 'ORGANIZATION',
        aliases: ['staff', 'employees', 'invitations', 'roles', 'permissions', 'rbac', 'organization', 'positions', 'structure', 'org chart'],
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
        children: [
          {
            id: 'staff_directory',
            label: 'Staff Directory',
            href: '/dashboard/people',
            icon: '👥',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['employees', 'team members', 'active staff', 'all personnel', 'member profiles', 'people directory'],
            requiredPermission: ['staff.view', 'staff.manage', 'people.view', 'people.manage'],
          },
          {
            id: 'staff_invitations',
            label: 'Staff Invitations',
            href: '/dashboard/team/invites',
            icon: '🔑',
            context: 'ORGANIZATION',
            aliases: ['invite staff', 'pending invites', 'claim link'],
            requiredPermission: ['staff.invite', 'staff.manage'],
          },
          {
            id: 'roles_permissions',
            label: 'Roles & Permissions',
            href: '/dashboard/access/roles',
            icon: '🛡️',
            context: 'ORGANIZATION',
            aliases: ['rbac', 'custom roles', 'built-in roles', 'permission bundles'],
            requiredPermission: ['roles.view', 'roles.manage'],
          },
          {
            id: 'access_hub',
            label: 'Access Control Hub',
            href: '/dashboard/access',
            icon: '🔒',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['access overview', 'security governance'],
            requiredPermission: ['roles.view', 'roles.manage'],
          },
          {
            id: 'access_diagnostics',
            label: 'Access Diagnostics',
            href: '/dashboard/access/diagnostics',
            icon: '🔬',
            context: 'ORGANIZATION',
            aliases: ['debug permissions', 'can access test', 'inspect member'],
            requiredPermission: ['roles.view', 'roles.manage'],
          },
          {
            id: 'scope_grants',
            label: 'Scope Grants',
            href: '/dashboard/access/scope-grants',
            icon: '🌐',
            context: 'ORGANIZATION',
            aliases: ['branch scope', 'department scope', 'area overrides'],
            requiredPermission: ['roles.view', 'roles.manage', 'permissions.override.manage'],
          },
          {
            id: 'org_chart',
            label: 'Organization Chart',
            href: '/dashboard/organization/chart',
            icon: '📊',
            context: 'ORGANIZATION',
            aliases: ['hierarchy', 'reporting tree', 'org visual'],
            requiredPermission: ['organization.view', 'organization.manage'],
          },
          {
            id: 'org_structure',
            label: 'Organization Structure',
            href: '/dashboard/organization',
            icon: '🏢',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['departments', 'business units', 'teams'],
            requiredPermission: ['organization.view', 'organization.manage'],
          },
          {
            id: 'positions_slots',
            label: 'Positions & Slots',
            href: '/dashboard/organization/positions',
            icon: '📌',
            context: 'ORGANIZATION',
            aliases: ['headcount', 'vacancies', 'slot capacity'],
            requiredPermission: ['positions.manage', 'organization.view'],
          },
          {
            id: 'job_titles',
            label: 'Job Titles',
            href: '/dashboard/organization/job-titles',
            icon: '🏷️',
            context: 'ORGANIZATION',
            aliases: ['designations', 'title catalog'],
            requiredPermission: ['organization.view', 'organization.manage'],
          },
          {
            id: 'acting_roles',
            label: 'Acting Roles',
            href: '/dashboard/people/acting',
            icon: '⭐',
            context: 'ORGANIZATION',
            aliases: ['temporary authority', 'acting manager', 'delegation'],
            requiredPermission: ['people.view', 'people.manage'],
          },
          {
            id: 'secondments',
            label: 'Secondments',
            href: '/dashboard/people/secondments',
            icon: '🔄',
            context: 'ORGANIZATION',
            aliases: ['cross-branch loan', 'inter-branch assignment'],
            requiredPermission: ['people.view', 'people.manage'],
          },
          {
            id: 'org_integrity',
            label: 'Org Integrity',
            href: '/dashboard/people/integrity',
            icon: '🛡️',
            context: 'ORGANIZATION',
            aliases: ['orphaned records', 'audit unassigned staff'],
            requiredPermission: ['organization.view', 'organization.manage'],
          },
        ],
      },

      // 9. Reports
      {
        id: 'reports',
        label: 'Reports',
        href: '/dashboard/reports',
        icon: '📈',
        exact: true,
        context: 'MIXED',
        aliases: ['analytics', 'sales reports', 'revenue', 'financials', 'trends', 'cogs report'],
        requiredPermission: [
          'reports.view',
          'reports.financial.view',
          'reports.export',
        ],
      },

      // 10. Settings
      {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings',
        icon: '⚙️',
        context: 'ORGANIZATION',
        aliases: ['configuration', 'business profile', 'branches', 'outlets', 'venue', 'payment methods', 'order security', 'subscription', 'billing', 'help', 'guides'],
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
        children: [
          {
            id: 'settings_hub',
            label: 'Settings Hub',
            href: '/dashboard/settings',
            icon: '⚙️',
            exact: true,
            context: 'ORGANIZATION',
            aliases: ['configuration overview', 'setup overview'],
            requiredPermission: ['business.view', 'business.settings.manage', 'branches.view'],
          },
          {
            id: 'guided_setup',
            label: 'Business Setup',
            href: '/dashboard/setup',
            icon: '🚀',
            context: 'MIXED',
            aliases: ['setup', 'business setup', 'guided setup', 'setup wizard', 'onboarding', 'onboarding progress', 'getting started', 'readiness checklist', 'checklist', 'readiness'],
            requiredPermission: ['business.view', 'business.settings.manage', 'branches.view'],
          },
          {
            id: 'business_profile',
            label: 'Business Profile',
            href: '/dashboard/business',
            icon: '🏢',
            context: 'ORGANIZATION',
            aliases: ['company name', 'currency', 'timezone', 'legal entity'],
            requiredPermission: ['business.view', 'business.settings.manage'],
          },
          {
            id: 'venue_profile',
            label: 'Venue Profile',
            href: '/dashboard/venue-profile',
            icon: '🏬',
            context: 'ORGANIZATION',
            aliases: ['public storefront', 'photos', 'cuisines', 'discovery'],
            requiredPermission: ['venue_profile.view', 'venue_profile.manage'],
          },
          {
            id: 'branches',
            label: 'Branch Outlets',
            href: '/dashboard/branches',
            icon: '📍',
            context: 'ORGANIZATION',
            aliases: ['locations', 'outlets', 'gps coordinates', 'operating hours'],
            requiredPermission: ['branches.view', 'branches.manage', 'branches.operational.manage'],
          },
          {
            id: 'order_security',
            label: 'Order Security',
            href: '/dashboard/settings/order-security',
            icon: '🛡️',
            context: 'ORGANIZATION',
            aliases: ['geofencing', 'waiter approval rule', 'anti-fraud', 'table pin'],
            requiredPermission: ['order_security.view', 'order_security.manage'],
          },
          {
            id: 'payment_methods',
            label: 'Payment Methods',
            href: '/dashboard/settings/payments',
            icon: '💳',
            context: 'ORGANIZATION',
            aliases: ['gateways', 'stripe', 'payhere', 'cash payment setup'],
            requiredPermission: ['branches.manage', 'business.settings.manage'],
          },
          {
            id: 'subscription_billing',
            label: 'Billing & Plans',
            href: '/dashboard/settings/subscription',
            icon: '💎',
            context: 'ORGANIZATION',
            aliases: ['saas plan', 'pricing tier', 'upgrade', 'invoices'],
            requiredPermission: ['business.settings.manage', 'owner.transfer'],
          },
          {
            id: 'help_guides',
            label: 'Help & Guides',
            href: '/dashboard/help',
            icon: '❓',
            exact: true,
            context: 'MIXED',
            aliases: ['documentation', 'how to use', 'tutorials'],
          },
          {
            id: 'help_troubleshooting',
            label: 'Troubleshooting',
            href: '/dashboard/help/troubleshooting',
            icon: '🔧',
            context: 'MIXED',
            aliases: ['diagnostics', 'faq', 'fix issues'],
          },
        ],
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
  '/dashboard/orders': '/dashboard/orders',
  '/dashboard/cashier': '/dashboard/orders',
  '/dashboard/kitchen': '/dashboard/orders',
  '/dashboard/waiter': '/dashboard/orders',
  '/dashboard/waiter/menu': '/dashboard/orders',
  '/dashboard/waiter/order': '/dashboard/orders',

  // Menu Subroutes
  '/dashboard/menu': '/dashboard/menu',
  '/dashboard/menu/categories': '/dashboard/menu',
  '/dashboard/menu/items': '/dashboard/menu',
  '/dashboard/menu/items/new': '/dashboard/menu',

  // Dining Subroutes
  '/dashboard/dining': '/dashboard/dining',
  '/dashboard/tables': '/dashboard/dining',
  '/dashboard/areas': '/dashboard/dining',
  '/dashboard/tables/areas': '/dashboard/dining',
  '/dashboard/tables/bulk': '/dashboard/dining',
  '/dashboard/tables/new': '/dashboard/dining',
  '/dashboard/tables/qr': '/dashboard/dining',

  // Reservations
  '/dashboard/reservations': '/dashboard/reservations',

  // Customers Subroutes
  '/dashboard/customers': '/dashboard/customers',
  '/dashboard/reviews': '/dashboard/customers',
  '/dashboard/reputation': '/dashboard/customers',
  '/dashboard/loyalty': '/dashboard/customers',
  '/dashboard/loyalty/rewards': '/dashboard/customers',
  '/dashboard/loyalty/customers': '/dashboard/customers',

  // Operations / Inventory Subroutes
  '/dashboard/inventory': '/dashboard/inventory',
  '/dashboard/inventory/items': '/dashboard/inventory',
  '/dashboard/inventory/items/new': '/dashboard/inventory',
  '/dashboard/inventory/counts': '/dashboard/inventory',
  '/dashboard/inventory/counts/new': '/dashboard/inventory',
  '/dashboard/inventory/waste': '/dashboard/inventory',
  '/dashboard/inventory/transfers': '/dashboard/inventory',
  '/dashboard/inventory/transfers/new': '/dashboard/inventory',
  '/dashboard/inventory/locations': '/dashboard/inventory',
  '/dashboard/inventory/recipes': '/dashboard/inventory',
  '/dashboard/inventory/recipes/new': '/dashboard/inventory',
  '/dashboard/inventory/purchasing': '/dashboard/inventory',
  '/dashboard/inventory/purchasing/new': '/dashboard/inventory',
  '/dashboard/inventory/suppliers': '/dashboard/inventory',
  '/dashboard/inventory/receiving': '/dashboard/inventory',
  '/dashboard/inventory/production': '/dashboard/inventory',
  '/dashboard/inventory/settings': '/dashboard/inventory',

  // Team Subroutes
  '/dashboard/team': '/dashboard/team',
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

  // Reports
  '/dashboard/reports': '/dashboard/reports',

  // Settings Subroutes
  '/dashboard/settings': '/dashboard/settings',
  '/dashboard/setup': '/dashboard/settings',
  '/dashboard/business': '/dashboard/settings',
  '/dashboard/venue-profile': '/dashboard/settings',
  '/dashboard/branches': '/dashboard/settings',
  '/dashboard/settings/order-security': '/dashboard/settings',
  '/dashboard/settings/payments': '/dashboard/settings',
  '/dashboard/settings/subscription': '/dashboard/settings',
  '/dashboard/settings/subscription/checkout': '/dashboard/settings',
  '/dashboard/help': '/dashboard/settings',
  '/dashboard/help/troubleshooting': '/dashboard/settings',
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
  if (pathname.startsWith('/dashboard/orders')) return '/dashboard/orders';
  if (pathname.startsWith('/dashboard/cashier')) return '/dashboard/orders';
  if (pathname.startsWith('/dashboard/kitchen')) return '/dashboard/orders';
  if (pathname.startsWith('/dashboard/waiter')) return '/dashboard/orders';
  if (pathname.startsWith('/dashboard/access')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/people')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/organization')) return '/dashboard/team';
  if (pathname.startsWith('/dashboard/inventory')) return '/dashboard/inventory';
  if (pathname.startsWith('/dashboard/menu')) return '/dashboard/menu';
  if (pathname.startsWith('/dashboard/customers')) return '/dashboard/customers';
  if (pathname.startsWith('/dashboard/loyalty')) return '/dashboard/customers';
  if (pathname.startsWith('/dashboard/reviews') || pathname.startsWith('/dashboard/reputation')) return '/dashboard/customers';
  if (pathname.startsWith('/dashboard/dining') || pathname.startsWith('/dashboard/tables') || pathname.startsWith('/dashboard/areas')) return '/dashboard/dining';
  if (pathname.startsWith('/dashboard/help')) return '/dashboard/settings';
  if (pathname.startsWith('/dashboard/setup')) return '/dashboard/settings';
  if (pathname.startsWith('/dashboard/business') || pathname.startsWith('/dashboard/branches') || pathname.startsWith('/dashboard/venue-profile')) return '/dashboard/settings';

  return pathname;
}

/**
 * Determines whether a navigation item is active given the current pathname.
 */
export function isNavItemActive(item: { id?: string; href: string; exact?: boolean; children?: { href: string }[] }, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  if (pathname === item.href) {
    return true;
  }
  // If item has children, check if any child matches pathname exactly or as prefix
  if (item.children && item.children.length > 0) {
    if (item.children.some((c) => pathname === c.href || (c.href !== item.href && pathname.startsWith(`${c.href}/`)))) {
      return true;
    }
  }
  if (pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  const activeParent = getParentNavPath(pathname);
  if (activeParent === item.href) {
    return true;
  }
  return false;
}

import fs from 'fs';
import path from 'path';

// Bypass server-only guard for direct tsx execution
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

async function runNavigationTests() {
  const {
    CANONICAL_DASHBOARD_NAV_SECTIONS,
    getParentNavPath,
    isNavItemActive,
  } = await import('../src/lib/navigation/dashboard-navigation');
  const {
    resolveDashboardNavigation,
    resolveSearchableNavItems,
  } = await import('../src/server/navigation/navigation-engine');
  type AuthorizationContext = import('../src/types/authorization.types').AuthorizationContext;

  console.log('================================================================');
  console.log('  WSNexa Phase 37 Step 1: Clean & Discoverable Navigation v2 Tests');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      failed++;
    }
  }

  // --- 1. Canonical Navigation Structure & 10 Groups ---
  console.log('--- 1. Canonical Navigation Structure & 10 Groups ---');
  const allGroups = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  assert(allGroups.length === 10, `Exactly 10 primary groups configured (got ${allGroups.length})`);

  const expectedGroups = [
    'dashboard',
    'orders',
    'menu',
    'dining',
    'reservations',
    'customers',
    'operations',
    'team',
    'reports',
    'settings',
  ];

  for (const groupId of expectedGroups) {
    const found = allGroups.some((g) => g.id === groupId);
    assert(found, `Canonical navigation contains group ID "${groupId}"`);
  }

  // --- 2. Children Discoverability Under Groups ---
  console.log('\n--- 2. Children Discoverability Under Groups ---');
  const ordersGroup = allGroups.find((g) => g.id === 'orders');
  assert(Boolean(ordersGroup?.children && ordersGroup.children.length >= 5), `Orders group contains discoverable children (got ${ordersGroup?.children?.length})`);
  assert(ordersGroup?.children?.some((c) => c.href === '/dashboard/kitchen') || false, 'Orders contains Kitchen (KDS)');
  assert(ordersGroup?.children?.some((c) => c.href === '/dashboard/cashier') || false, 'Orders contains Cashier & POS');
  assert(ordersGroup?.children?.some((c) => c.href === '/dashboard/waiter') || false, 'Orders contains Waiter Terminal');

  const operationsGroup = allGroups.find((g) => g.id === 'operations');
  assert(Boolean(operationsGroup?.children && operationsGroup.children.length >= 8), `Operations group contains discoverable children (got ${operationsGroup?.children?.length})`);
  assert(operationsGroup?.children?.some((c) => c.href === '/dashboard/inventory/recipes') || false, 'Operations contains Recipes & BOM');
  assert(operationsGroup?.children?.some((c) => c.href === '/dashboard/inventory/suppliers') || false, 'Operations contains Suppliers');
  assert(operationsGroup?.children?.some((c) => c.href === '/dashboard/inventory/purchasing') || false, 'Operations contains Purchasing (PO)');
  assert(operationsGroup?.children?.some((c) => c.href === '/dashboard/inventory/counts') || false, 'Operations contains Physical Counts');

  const diningGroup = allGroups.find((g) => g.id === 'dining');
  assert(diningGroup?.children?.some((c) => c.href === '/dashboard/areas') || false, 'Dining & QR contains Service Areas');
  assert(diningGroup?.children?.some((c) => c.href === '/dashboard/tables') || false, 'Dining & QR contains Dining Tables');
  assert(diningGroup?.children?.some((c) => c.href === '/dashboard/tables/qr') || false, 'Dining & QR contains QR Codes');

  const teamGroup = allGroups.find((g) => g.id === 'team');
  assert(teamGroup?.children?.some((c) => c.href === '/dashboard/access/roles') || false, 'Team contains Roles & Permissions');
  assert(teamGroup?.children?.some((c) => c.href === '/dashboard/team/invites') || false, 'Team contains Staff Invitations');
  assert(teamGroup?.children?.some((c) => c.href === '/dashboard/organization') || false, 'Team contains Organization Structure');

  const settingsGroup = allGroups.find((g) => g.id === 'settings');
  assert(settingsGroup?.children?.some((c) => c.href === '/dashboard/business') || false, 'Settings contains Business Profile');
  assert(settingsGroup?.children?.some((c) => c.href === '/dashboard/branches') || false, 'Settings contains Branch Outlets');
  assert(settingsGroup?.children?.some((c) => c.href === '/dashboard/settings/order-security') || false, 'Settings contains Order Security');
  assert(settingsGroup?.children?.some((c) => c.href === '/dashboard/settings/payments') || false, 'Settings contains Payment Methods');
  assert(settingsGroup?.children?.some((c) => c.href === '/dashboard/settings/subscription') || false, 'Settings contains Billing & Plans');

  // --- 3. Business Owner Resolution ---
  console.log('\n--- 3. Business Owner Full Navigation Resolution ---');
  const ownerContext = {
    userId: 'user_owner_123',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: true,
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const ownerNav = resolveDashboardNavigation(ownerContext);
  const ownerItems = ownerNav.flatMap((s) => s.items);
  assert(ownerItems.length === 10, `Business Owner resolves all 10 primary groups (got ${ownerItems.length})`);

  const ownerTotalLeaves = ownerItems.reduce((acc, item) => acc + (item.children ? item.children.length : 1), 0);
  assert(ownerTotalLeaves >= 30, `Business Owner has direct discoverable access to >= 30 destinations (got ${ownerTotalLeaves})`);

  // --- 4. Role-Based RBAC Authorization & Group Collapsing ---
  console.log('\n--- 4. Role-Based RBAC Authorization & Group Collapsing ---');

  // Kitchen Staff Context
  const kitchenContext = {
    userId: 'user_kitchen_1',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: false,
    rolePermissions: ['kitchen.access', 'kitchen.orders.view', 'kitchen.update'],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const kitchenNav = resolveDashboardNavigation(kitchenContext);
  const kitchenGroups = kitchenNav.flatMap((s) => s.items);
  assert(kitchenGroups.length === 2, `Kitchen staff resolves exactly 2 authorized groups: Dashboard & Orders (got ${kitchenGroups.length})`);
  
  const kitchenOrders = kitchenGroups.find((g) => g.id === 'orders');
  assert(Boolean(kitchenOrders), 'Kitchen staff has Orders group');
  assert(kitchenOrders?.children?.length === 1, `Orders contains only 1 child for kitchen staff (got ${kitchenOrders?.children?.length})`);
  assert(kitchenOrders?.children?.[0].href === '/dashboard/kitchen', 'Kitchen staff only child under Orders is /dashboard/kitchen');

  // Verify unauthorized groups are collapsed for kitchen staff
  const unauthorizedForKitchen = ['menu', 'dining', 'reservations', 'customers', 'operations', 'team', 'reports', 'settings'];
  for (const unauthId of unauthorizedForKitchen) {
    assert(!kitchenGroups.some((g) => g.id === unauthId), `Unauthorized group "${unauthId}" collapses for kitchen staff`);
  }

  // Cashier Context
  const cashierContext = {
    userId: 'user_cashier_1',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: false,
    rolePermissions: ['cashier.access', 'payments.view', 'payments.record'],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const cashierNav = resolveDashboardNavigation(cashierContext);
  const cashierGroups = cashierNav.flatMap((s) => s.items);
  assert(cashierGroups.length === 2, `Cashier resolves exactly 2 authorized groups: Dashboard & Orders (got ${cashierGroups.length})`);
  
  const cashierOrders = cashierGroups.find((g) => g.id === 'orders');
  assert(Boolean(cashierOrders), 'Cashier has Orders group');
  assert(cashierOrders?.children?.length === 1, `Orders contains only 1 child for cashier (got ${cashierOrders?.children?.length})`);
  assert(cashierOrders?.children?.[0].href === '/dashboard/cashier', 'Cashier only child under Orders is /dashboard/cashier');

  // Inventory Specialist Context
  const inventoryContext = {
    userId: 'user_inventory_1',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: false,
    rolePermissions: ['inventory.view', 'inventory.items.manage', 'inventory.counts.manage'],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const invNav = resolveDashboardNavigation(inventoryContext);
  const invGroups = invNav.flatMap((s) => s.items);
  assert(invGroups.some((g) => g.id === 'operations'), 'Inventory specialist resolves Operations group');
  assert(!invGroups.some((g) => g.id === 'customers'), 'Customers group collapses for inventory specialist');
  assert(!invGroups.some((g) => g.id === 'team'), 'Team group collapses for inventory specialist');

  // --- 5. Navigation Search & Keyword Matching ---
  console.log('\n--- 5. Navigation Search & Keyword Matching ---');
  const ownerSearchable = resolveSearchableNavItems(ownerContext);
  assert(ownerSearchable.length >= 30, `Owner has >= 30 searchable items (got ${ownerSearchable.length})`);

  function searchNav(q: string) {
    const term = q.toLowerCase();
    return ownerSearchable.filter(
      (i) => i.label.toLowerCase().includes(term) ||
             i.groupTitle.toLowerCase().includes(term) ||
             i.href.toLowerCase().includes(term) ||
             (i.aliases && i.aliases.some((a) => a.toLowerCase().includes(term)))
    );
  }

  // 1. Tables -> Dining Tables
  const tablesMatches = searchNav('Tables');
  assert(tablesMatches.some((m) => m.label === 'Dining Tables' && m.href === '/dashboard/tables'), 'Searching "Tables" returns "Dining Tables"');

  // 2. QR -> QR Codes
  const qrMatches = searchNav('QR');
  assert(qrMatches.some((m) => m.label === 'QR Codes' && m.href === '/dashboard/tables/qr'), 'Searching "QR" returns "QR Codes"');

  // 3. supplier -> Suppliers
  const supplierMatches = searchNav('supplier');
  assert(supplierMatches.some((m) => m.label === 'Suppliers' && m.href === '/dashboard/inventory/suppliers'), 'Searching "supplier" returns "Suppliers"');

  // 4. role / rbac -> Roles & Permissions
  const roleMatches = searchNav('role');
  const rbacMatches = searchNav('rbac');
  assert(roleMatches.some((m) => m.label === 'Roles & Permissions' && m.href === '/dashboard/access/roles'), 'Searching "role" returns "Roles & Permissions"');
  assert(rbacMatches.some((m) => m.label === 'Roles & Permissions' && m.href === '/dashboard/access/roles'), 'Searching "rbac" returns "Roles & Permissions"');

  // 5. kitchen / kds -> Kitchen
  const kitchenWordMatches = searchNav('kitchen');
  const kdsMatches = searchNav('kds');
  assert(kitchenWordMatches.some((m) => m.label === 'Kitchen (KDS)' && m.href === '/dashboard/kitchen'), 'Searching "kitchen" returns "Kitchen (KDS)"');
  assert(kdsMatches.some((m) => m.label === 'Kitchen (KDS)' && m.href === '/dashboard/kitchen'), 'Searching "kds" returns "Kitchen (KDS)"');

  // 6. order security -> Order Security
  const orderSecMatches = searchNav('order security');
  assert(orderSecMatches.some((m) => m.label === 'Order Security' && m.href === '/dashboard/settings/order-security'), 'Searching "order security" returns "Order Security"');

  // 7. position -> Positions & Slots
  const positionMatches = searchNav('position');
  assert(positionMatches.some((m) => m.label === 'Positions & Slots' && m.href === '/dashboard/organization/positions'), 'Searching "position" returns "Positions & Slots"');

  // RBAC search isolation test
  const kitchenSearchable = resolveSearchableNavItems(kitchenContext);
  assert(kitchenSearchable.length === 2, `Kitchen staff search is strictly isolated to 2 items: Dashboard & Kitchen (got ${kitchenSearchable.length})`);
  assert(kitchenSearchable.some((i) => i.href === '/dashboard/kitchen'), 'Kitchen staff search contains /dashboard/kitchen');
  assert(!kitchenSearchable.some((i) => i.href === '/dashboard/settings'), 'Kitchen staff search does NOT leak settings');
  assert(!kitchenSearchable.some((i) => i.href === '/dashboard/team'), 'Kitchen staff search does NOT leak team/staff');

  // --- 6. Active Nested Route Resolution & Highlighting ---
  console.log('\n--- 6. Active Nested Route Resolution & Highlighting ---');
  assert(getParentNavPath('/dashboard/menu/items/item_123/modifiers') === '/dashboard/menu', 'Dynamic subroute /dashboard/menu/items/123/modifiers maps to /dashboard/menu');
  assert(getParentNavPath('/dashboard/inventory/purchasing/po_999') === '/dashboard/inventory', 'Dynamic subroute /dashboard/inventory/purchasing/po_999 maps to /dashboard/inventory');
  assert(getParentNavPath('/dashboard/access/roles/role_abc') === '/dashboard/team', 'Dynamic subroute /dashboard/access/roles/role_abc maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/people/member_456') === '/dashboard/team', 'Dynamic subroute /dashboard/people/member_456 maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/settings/subscription/checkout') === '/dashboard/settings', 'Checkout subroute /dashboard/settings/subscription/checkout maps to /dashboard/settings');
  assert(getParentNavPath('/dashboard/tables/bulk') === '/dashboard/dining', 'Subroute /dashboard/tables/bulk maps to /dashboard/dining');
  assert(getParentNavPath('/dashboard/tables/qr') === '/dashboard/dining', 'Subroute /dashboard/tables/qr maps to /dashboard/dining');

  const menuItem = { href: '/dashboard/menu' };
  assert(isNavItemActive(menuItem, '/dashboard/menu/items/item_123/modifiers'), 'isNavItemActive highlights Menu for /dashboard/menu/items/item_123/modifiers');

  const operationsItem = { href: '/dashboard/inventory' };
  assert(isNavItemActive(operationsItem, '/dashboard/inventory/purchasing/po_999'), 'isNavItemActive highlights Operations for /dashboard/inventory/purchasing/po_999');

  const teamItem = { href: '/dashboard/team' };
  assert(isNavItemActive(teamItem, '/dashboard/access/roles/role_abc'), 'isNavItemActive highlights Team for /dashboard/access/roles/role_abc');
  assert(isNavItemActive(teamItem, '/dashboard/people/member_456'), 'isNavItemActive highlights Team for /dashboard/people/member_456');

  const settingsItem = { href: '/dashboard/settings' };
  assert(isNavItemActive(settingsItem, '/dashboard/settings/subscription/checkout'), 'isNavItemActive highlights Settings for /dashboard/settings/subscription/checkout');

  // --- 7. Overview Reachability Under Grouped Parents ---
  console.log('\n--- 7. Overview Reachability Under Grouped Parents ---');
  const ordersChildren = allGroups.find((g) => g.id === 'orders')?.children || [];
  assert(ordersChildren.some((c) => c.href === '/dashboard/orders'), 'Orders contains "Orders Queue" (/dashboard/orders)');

  const menuChildren = allGroups.find((g) => g.id === 'menu')?.children || [];
  assert(menuChildren.some((c) => c.href === '/dashboard/menu'), 'Menu contains "Menu Overview" (/dashboard/menu)');

  const diningChildren = allGroups.find((g) => g.id === 'dining')?.children || [];
  assert(diningChildren.some((c) => c.href === '/dashboard/dining'), 'Dining & QR contains "Dining Overview" (/dashboard/dining)');

  const operationsChildren = allGroups.find((g) => g.id === 'operations')?.children || [];
  assert(operationsChildren.some((c) => c.href === '/dashboard/inventory'), 'Operations contains "Operations Hub" (/dashboard/inventory)');

  const settingsChildren = allGroups.find((g) => g.id === 'settings')?.children || [];
  assert(settingsChildren.some((c) => c.href === '/dashboard/settings'), 'Settings contains "Settings Hub" (/dashboard/settings)');

  const customersChildren = allGroups.find((g) => g.id === 'customers')?.children || [];
  assert(customersChildren.some((c) => c.href === '/dashboard/customers'), 'Customers contains "Customer Directory" (/dashboard/customers)');

  const teamChildren = allGroups.find((g) => g.id === 'team')?.children || [];
  assert(teamChildren.some((c) => c.href === '/dashboard/team'), 'Team contains "Staff Directory" (/dashboard/team)');

  // --- 7. Application Route Existence Validation (Zero Dead Links) ---
  console.log('\n--- 7. Application Route Existence Validation (Zero Dead Links) ---');
  const dashboardDir1 = path.join(process.cwd(), 'src/app/(dashboard)/dashboard');
  const dashboardDir2 = path.join(process.cwd(), 'src/app/dashboard');

  function doesRouteExist(href: string): boolean {
    const rel = href.replace('/dashboard', '');
    if (rel === '' || rel === '/') {
      return (
        fs.existsSync(path.join(dashboardDir1, 'page.tsx')) ||
        fs.existsSync(path.join(dashboardDir2, 'page.tsx'))
      );
    }
    const target1 = path.join(dashboardDir1, rel, 'page.tsx');
    const target2 = path.join(dashboardDir2, rel, 'page.tsx');
    return fs.existsSync(target1) || fs.existsSync(target2);
  }

  for (const item of ownerSearchable) {
    const exists = doesRouteExist(item.href);
    assert(exists, `Navigation destination "${item.label}" (${item.href}) exists as a valid route`);
  }

  // --- 8. No Super Admin Leakage ---
  console.log('\n--- 8. Super Admin Isolation ---');
  const hasAdmin = ownerSearchable.some((i) => i.href.startsWith('/admin'));
  assert(!hasAdmin, 'No Super Admin /admin routes present in business workspace navigation');

  console.log('\n================================================================');
  console.log(`  Navigation v2 Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNavigationTests().catch((err) => {
  console.error('Unexpected error running navigation tests:', err);
  process.exit(1);
});
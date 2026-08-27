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

async function runAssertions() {
  const {
    CANONICAL_DASHBOARD_NAV_SECTIONS,
    getParentNavPath,
    isNavItemActive,
  } = await import('../src/lib/navigation/dashboard-navigation');
  const {
    resolveDashboardNavigation,
  } = await import('../src/server/navigation/navigation-engine');
  const { resolveDefaultWorkspaceRoute } = await import('../src/server/tenant/guard');
  const { ROLE_PRESETS, getPermissionsForPreset } = await import('../src/lib/validation/permission-presets');
  type AuthorizationContext = import('../src/types/authorization.types').AuthorizationContext;

  console.log('================================================================');
  console.log('  WSNexa Phase 37 Step 2: Simplified Navigation & Roles UX Verification');
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

  // --- 1. Canonical Navigation Config Assertions ---
  console.log('--- 1. Canonical Navigation Config ---');
  const allItems = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  assert(allItems.length === 10, `Canonical nav sections contain exactly 10 primary items (got ${allItems.length})`);

  const expectedLabels = [
    'Dashboard',
    'Orders',
    'Menu',
    'Dining & QR',
    'Reservations',
    'Customers',
    'Operations',
    'Team',
    'Reports',
    'Settings',
  ];

  for (const label of expectedLabels) {
    const found = allItems.some((item) => item.label === label);
    assert(found, `Primary navigation contains label "${label}"`);
  }

  // --- 2. Owner Navigation Resolution Assertions ---
  console.log('\n--- 2. Business Owner Resolution ---');
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
  assert(ownerItems.length === 10, `Business Owner resolves all 10 primary items (got ${ownerItems.length})`);

  // --- 3. Role-Based Parent Hub Collapse Assertions ---
  console.log('\n--- 3. Role-Based Parent Hub Collapse ---');
  const restrictedContext = {
    userId: 'user_staff_456',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: false,
    rolePermissions: ['inventory.counts.manage'],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const restrictedNav = resolveDashboardNavigation(restrictedContext);
  const restrictedItems = restrictedNav.flatMap((s) => s.items);

  const hasOperations = restrictedItems.some((i) => i.id === 'operations');
  assert(hasOperations, 'Operations workspace is visible to user with inventory.counts.manage');

  const hasCustomers = restrictedItems.some((i) => i.id === 'customers');
  assert(!hasCustomers, 'Customers workspace collapses for user without customer permissions');

  const hasDining = restrictedItems.some((i) => i.id === 'dining');
  assert(!hasDining, 'Dining workspace collapses for user without dining permissions');

  // --- 4. Direct Operational Landing Routes ---
  console.log('\n--- 4. Direct Operational Staff Landing Routes ---');
  assert(resolveDefaultWorkspaceRoute('cashier') === '/dashboard/cashier', 'Cashier lands directly on /dashboard/cashier');
  assert(resolveDefaultWorkspaceRoute('kitchen_staff') === '/dashboard/kitchen', 'Kitchen Staff lands directly on /dashboard/kitchen');
  assert(resolveDefaultWorkspaceRoute('waiter') === '/dashboard/waiter', 'Waiter lands directly on /dashboard/waiter');
  assert(resolveDefaultWorkspaceRoute('business_owner') === '/dashboard', 'Business Owner lands on /dashboard');

  // --- 5. Detail Route Parent Mapping ---
  console.log('\n--- 5. Detail Route Parent Mapping & Active Highlights ---');
  assert(getParentNavPath('/dashboard/tables') === '/dashboard/dining', '/dashboard/tables maps to /dashboard/dining');
  assert(getParentNavPath('/dashboard/reviews') === '/dashboard/customers', '/dashboard/reviews maps to /dashboard/customers');
  assert(getParentNavPath('/dashboard/inventory/recipes') === '/dashboard/inventory', '/dashboard/inventory/recipes maps to /dashboard/inventory');
  assert(getParentNavPath('/dashboard/access/roles') === '/dashboard/team', '/dashboard/access/roles maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/team/roles') === '/dashboard/team', '/dashboard/team/roles maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/cashier') === '/dashboard/orders', '/dashboard/cashier maps to /dashboard/orders');

  const diningItem = { href: '/dashboard/dining' };
  assert(isNavItemActive(diningItem, '/dashboard/tables'), 'isNavItemActive correctly highlights Dining & QR for /dashboard/tables');

  const teamItem = { href: '/dashboard/team' };
  assert(isNavItemActive(teamItem, '/dashboard/access/roles'), 'isNavItemActive correctly highlights Team for /dashboard/access/roles');
  assert(isNavItemActive(teamItem, '/dashboard/team/roles'), 'isNavItemActive correctly highlights Team for legacy /dashboard/team/roles');

  // --- 6. Roles UX & Canonical Presets Verification ---
  console.log('\n--- 6. Canonical Presets & Role Governance ---');
  assert(ROLE_PRESETS.length >= 4, `At least 4 canonical presets exist (got ${ROLE_PRESETS.length})`);
  const cashierPreset = getPermissionsForPreset('cashier');
  assert(cashierPreset.includes('cashier.access'), 'Cashier preset includes cashier.access');
  assert(cashierPreset.includes('payments.record'), 'Cashier preset includes payments.record');

  const kitchenPreset = getPermissionsForPreset('kitchen_staff');
  assert(kitchenPreset.includes('kitchen.access'), 'Kitchen preset includes kitchen.access');
  assert(kitchenPreset.includes('kitchen.update'), 'Kitchen preset includes kitchen.update');

  const waiterPreset = getPermissionsForPreset('waiter');
  assert(waiterPreset.includes('waiter.access'), 'Waiter preset includes waiter.access');
  assert(waiterPreset.includes('waiter.orders.create'), 'Waiter preset includes waiter.orders.create');

  // --- 7. Super Admin & Public Route Isolation ---
  console.log('\n--- 7. Super Admin Isolation ---');
  const hasAdminRoutes = allItems.some((i) => i.href.startsWith('/admin'));
  assert(!hasAdminRoutes, 'No Super Admin /admin routes present in business workspace navigation');

  console.log('\n================================================================');
  console.log(`  Phase 37 Step 2 Navigation & Roles Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions().catch((err) => {
  console.error('Unexpected error running assertions:', err);
  process.exit(1);
});

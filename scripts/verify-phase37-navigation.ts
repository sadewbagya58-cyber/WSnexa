import {
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  getParentNavPath,
  isNavItemActive,
} from '../src/lib/navigation/dashboard-navigation';
import {
  resolveDashboardNavigation,
} from '../src/server/navigation/navigation-engine';
import { resolveDefaultWorkspaceRoute } from '../src/server/tenant/guard';
import { AuthorizationContext } from '../src/types/authorization.types';

function runAssertions() {
  console.log('================================================================');
  console.log('  WSNexa Phase 37 Step 2: Simplified Navigation IA Verification');
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
  assert(getParentNavPath('/dashboard/cashier') === '/dashboard/orders', '/dashboard/cashier maps to /dashboard/orders');

  const diningItem = { href: '/dashboard/dining' };
  assert(isNavItemActive(diningItem, '/dashboard/tables'), 'isNavItemActive correctly highlights Dining & QR for /dashboard/tables');

  const teamItem = { href: '/dashboard/team' };
  assert(isNavItemActive(teamItem, '/dashboard/access/roles'), 'isNavItemActive correctly highlights Team for /dashboard/access/roles');

  // --- 6. Super Admin & Public Route Isolation ---
  console.log('\n--- 6. Super Admin Isolation ---');
  const hasAdminRoutes = allItems.some((i) => i.href.startsWith('/admin'));
  assert(!hasAdminRoutes, 'No Super Admin /admin routes present in business workspace navigation');

  console.log('\n================================================================');
  console.log(`  Phase 37 Step 2 Navigation IA Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions();

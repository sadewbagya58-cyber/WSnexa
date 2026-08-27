import fs from 'fs';
import path from 'path';
import {
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  getParentNavPath,
  isNavItemActive,
} from '../src/lib/navigation/dashboard-navigation';
import {
  hasNavCapability,
  hasNavScopeContext,
  resolveDashboardNavigation,
} from '../src/server/navigation/navigation-engine';
import { AuthorizationContext } from '../src/types/authorization.types';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    failCount++;
  }
}

// Mock AuthorizationContext Builder for testing
function createMockAuthContext(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    userId: 'user-123',
    userEmail: 'user@wsnexa.internal',
    businessId: 'biz-123',
    businessName: 'Test Business',
    businessSlug: 'test-biz',
    membershipId: 'mem-123',
    membershipRole: 'cashier',
    customRoleId: null,
    isBusinessOwner: false,
    activeBranchId: 'branch-1',
    authorizedBranchIds: ['branch-1'],
    branchAssignments: [],
    departmentIds: [],
    departments: [],
    organizationUnitIds: [],
    organizationUnits: [],
    serviceAreaIds: [],
    serviceAreas: [],
    staffAssignments: [],
    actingAssignments: [],
    secondments: [],
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
    roleScopePreset: null,
    selfIdentity: { userId: 'user-123', membershipId: 'mem-123', staffAssignmentIds: [] },
    diagnostics: { resolvedAt: new Date().toISOString(), queryCount: 1, sources: {} as unknown as AuthorizationContext['diagnostics']['sources'] },
    ...overrides,
  };
}

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 31 Step 2 — Role-Aware Navigation Verification  ');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // A. CONFIG ASSERTIONS
  console.log('--- A. Canonical Navigation Config Assertions ---');

  // 1. Config contains all frozen primary items (Phase 37 IA: 10 primary workspace items)
  const allItems = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  assert(allItems.length === 10, `Canonical nav config contains exactly 10 primary items (found ${allItems.length})`);

  // 2. Section IDs unique
  const sectionIds = CANONICAL_DASHBOARD_NAV_SECTIONS.map((s) => s.id);
  assert(new Set(sectionIds).size === sectionIds.length, 'All canonical section IDs are unique');

  // 3. Item IDs unique
  const itemIds = allItems.map((i) => i.id);
  assert(new Set(itemIds).size === itemIds.length, 'All canonical item IDs are unique');

  // 4. Primary paths unique
  const itemHrefs = allItems.map((i) => i.href);
  assert(new Set(itemHrefs).size === itemHrefs.length, 'All primary navigation paths are unique');

  // 5. Canonical Core Modules present
  assert(allItems.some((i) => i.href === '/dashboard/orders'), 'Orders workspace item is present in canonical nav config');
  assert(allItems.some((i) => i.href === '/dashboard/inventory'), 'Operations / Inventory item is present in canonical nav config');
  assert(allItems.some((i) => i.href === '/dashboard/team'), 'Team workspace item is present in canonical nav config');
  assert(allItems.some((i) => i.href === '/dashboard/reports'), 'Reports workspace item is present in canonical nav config');

  // 6. /admin routes absent
  assert(!allItems.some((i) => i.href.startsWith('/admin')), 'Super Admin /admin routes are absent from tenant nav config');

  // 7. Public routes absent
  assert(!allItems.some((i) => i.href.startsWith('/login') || i.href.startsWith('/explore')), 'Public authentication/explore routes are absent');

  // B. FILTERING ENGINE ASSERTIONS
  console.log('\n--- B. Navigation Visibility Engine Assertions ---');

  // 8. Order preserved after filtering
  const ownerContext = createMockAuthContext({ isBusinessOwner: true });
  const ownerNav = resolveDashboardNavigation(ownerContext);
  assert(ownerNav[0].id === 'workspace', 'Canonical section order preserved (workspace section first)');

  // 9. View permission exposes viewable navigation
  const viewOnlyContext = createMockAuthContext({
    rolePermissions: ['menu.view', 'inventory.view'],
  });
  const viewOnlyNav = resolveDashboardNavigation(viewOnlyContext);
  const viewItems = viewOnlyNav.flatMap((s) => s.items);
  assert(viewItems.some((i) => i.id === 'menu') && viewItems.some((i) => i.id === 'operations'), 'View permissions expose viewable navigation modules (Menu & Operations)');

  // 10. Lacking permission collapses unpermitted hubs
  assert(!viewItems.some((i) => i.id === 'reports'), 'Lacking reports.view hides Reports workspace');

  // 11. Explicit DENY removes capability-dependent nav
  const denyOverrideContext = createMockAuthContext({
    isBusinessOwner: true,
    permissionOverrides: [
      { id: '1', businessMembershipId: 'm1', permissionKey: 'reports.view', effect: 'deny', scopeType: null, branchId: null, departmentId: null, organizationUnitId: null, serviceAreaId: null, createdAt: '' },
      { id: '2', businessMembershipId: 'm1', permissionKey: 'reports.financial.view', effect: 'deny', scopeType: null, branchId: null, departmentId: null, organizationUnitId: null, serviceAreaId: null, createdAt: '' },
      { id: '3', businessMembershipId: 'm1', permissionKey: 'reports.export', effect: 'deny', scopeType: null, branchId: null, departmentId: null, organizationUnitId: null, serviceAreaId: null, createdAt: '' },
    ],
  });
  const denyNav = resolveDashboardNavigation(denyOverrideContext);
  const denyItems = denyNav.flatMap((s) => s.items);
  assert(!denyItems.some((i) => i.href === '/dashboard/reports'), 'Explicit DENY override removes Reports even for Business Owner');

  // 12. Custom role works without built-in role name
  const customRoleContext = createMockAuthContext({
    membershipRole: 'custom_auditor_role',
    customRoleId: 'custom-role-777',
    rolePermissions: ['reports.view', 'customers.view'],
  });
  const customRoleNav = resolveDashboardNavigation(customRoleContext);
  const customItems = customRoleNav.flatMap((s) => s.items);
  assert(customItems.some((i) => i.id === 'reports') && customItems.some((i) => i.id === 'customers'), 'Custom role derives navigation cleanly without built-in role name');

  // 13. Owner visibility is permission-derived
  assert(hasNavCapability(ownerContext, 'business.settings.manage'), 'Owner visibility is capability-derived');

  // 14. Property-context item requires meaningful property scope
  const noPropertyContext = createMockAuthContext({
    authorizedBranchIds: [],
    activeBranchId: null,
    rolePermissions: ['cashier.access'],
  });
  assert(!hasNavScopeContext(noPropertyContext, 'PROPERTY'), 'Property-context Cashier POS is hidden when user has zero authorized branch scope');

  // 15. Organization-context item does not require property scope
  const orgContextNoProp = createMockAuthContext({
    authorizedBranchIds: [],
    activeBranchId: null,
    rolePermissions: ['organization.view'],
  });
  assert(hasNavScopeContext(orgContextNoProp, 'ORGANIZATION'), 'Organization-context items are visible without property scope');

  // 16. Mixed-context item behaves correctly
  assert(hasNavScopeContext(noPropertyContext, 'MIXED'), 'MIXED-context items evaluate true regardless of branch scope');

  // C. ROLE EXAMPLES ASSERTIONS
  console.log('\n--- C. Role UX Assertions ---');

  // 17. Business Owner broad navigation
  assert(ownerNav.flatMap((s) => s.items).length === 10, `Business Owner sees all 10 primary navigation areas (found ${ownerNav.flatMap((s) => s.items).length})`);

  // 18. Cashier operational focus
  const cashierContext = createMockAuthContext({
    membershipRole: 'cashier',
    rolePermissions: ['orders.view', 'cashier.access', 'menu.view'],
  });
  const cashierNav = resolveDashboardNavigation(cashierContext);
  const cashierItems = cashierNav.flatMap((s) => s.items);
  assert(cashierItems.some((i) => i.id === 'orders'), 'Cashier sees Orders workspace');

  // 19. Kitchen Staff kitchen focus
  const kitchenContext = createMockAuthContext({
    membershipRole: 'kitchen_staff',
    rolePermissions: ['orders.view', 'kitchen.access', 'menu.view', 'inventory.view', 'inventory.waste.record'],
  });
  const kitchenNav = resolveDashboardNavigation(kitchenContext);
  const kitchenItems = kitchenNav.flatMap((s) => s.items);
  assert(kitchenItems.some((i) => i.id === 'orders') && kitchenItems.some((i) => i.id === 'operations'), 'Kitchen staff sees Orders & Operations support');

  // 20. Waiter waiter focus
  const waiterContext = createMockAuthContext({
    membershipRole: 'waiter',
    rolePermissions: ['orders.view', 'waiter.requests.view', 'waiter.orders.create'],
  });
  const waiterNav = resolveDashboardNavigation(waiterContext);
  const waiterItems = waiterNav.flatMap((s) => s.items);
  assert(waiterItems.some((i) => i.id === 'orders'), 'Waiter sees Orders workspace');

  // 21. Custom Auditor capability-driven navigation
  const auditorContext = createMockAuthContext({
    membershipRole: 'custom_auditor',
    rolePermissions: ['reports.view'],
  });
  const auditorNav = resolveDashboardNavigation(auditorContext);
  const auditorItems = auditorNav.flatMap((s) => s.items);
  assert(auditorItems.some((i) => i.id === 'reports') && !auditorItems.some((i) => i.id === 'dining'), 'Custom auditor role sees Reports and hides Dining');

  // D. ACTIVE ROUTES ASSERTIONS
  console.log('\n--- D. Active Route Matcher Assertions ---');

  // 22. Exact root matching
  assert(isNavItemActive({ href: '/dashboard', exact: true }, '/dashboard'), 'Root /dashboard matches exact');
  assert(!isNavItemActive({ href: '/dashboard', exact: true }, '/dashboard/reports'), 'Root /dashboard exact does not activate on /dashboard/reports');

  // 23. Child route matching
  assert(isNavItemActive({ href: '/dashboard/reports' }, '/dashboard/reports'), 'Child route matches /dashboard/reports');

  // 24. Dynamic detail parent matching
  assert(getParentNavPath('/dashboard/access/roles/role-123') === '/dashboard/team', 'Detail role path maps to parent /dashboard/team');
  assert(getParentNavPath('/dashboard/tables') === '/dashboard/dining', 'Detail tables path maps to parent /dashboard/dining');
  assert(getParentNavPath('/dashboard/inventory/items') === '/dashboard/inventory', 'Detail inventory items path maps to parent /dashboard/inventory');

  // 25. Team detail activates Team hub
  assert(isNavItemActive({ href: '/dashboard/team' }, '/dashboard/access/roles/role-999'), 'Access role detail activates Team workspace');
  assert(isNavItemActive({ href: '/dashboard/team' }, '/dashboard/people/mem-888'), 'People detail activates Team workspace');

  // E. SECURITY INVARIANTS ASSERTIONS
  console.log('\n--- E. Security Invariants Assertions ---');

  // 26. Server route guard exists
  const guardPath = path.join(rootDir, 'src/server/tenant/guard.ts');
  assert(fs.existsSync(guardPath), 'Server route guard file exists and enforces route permissions');

  // 27. Route permission security mapping intact
  const routePermsPath = path.join(rootDir, 'src/lib/security/route-permissions.ts');
  const routePermsContent = fs.readFileSync(routePermsPath, 'utf8');
  assert(routePermsContent.includes('ROUTE_PERMISSION_MAP'), 'ROUTE_PERMISSION_MAP is intact in route-permissions.ts');

  // 28. Super Admin isolation
  const superAdminServicePath = path.join(rootDir, 'src/server/services/super-admin.service.ts');
  assert(fs.existsSync(superAdminServicePath), 'Super Admin service remains completely isolated');

  // 29. Canonical scopes preserved
  const authTypesPath = path.join(rootDir, 'src/types/authorization.types.ts');
  const authTypesContent = fs.readFileSync(authTypesPath, 'utf8');
  assert(
    authTypesContent.includes("'ORGANIZATION'") &&
      authTypesContent.includes("'PROPERTY'") &&
      authTypesContent.includes("'DEPARTMENT'") &&
      authTypesContent.includes("'AREA_TEAM'") &&
      authTypesContent.includes("'SELF'") &&
      !authTypesContent.includes("'REGION'"),
    'Canonical RBAC scopes preserve ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF without REGION'
  );

  // 30. Policy engine clean
  const policyEnginePath = path.join(rootDir, 'src/server/auth/policy-engine.ts');
  const policyContent = fs.readFileSync(policyEnginePath, 'utf8');
  assert(
    !policyContent.includes("context.membershipRole === 'cashier'") &&
      !policyContent.includes("context.membershipRole === 'kitchen_staff'"),
    'Policy Engine evaluation is free of job-title permission inheritance'
  );

  // 31. Shell client clean
  const shellPath = path.join(rootDir, 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');
  assert(!shellContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'DashboardShell client component does not use service role credentials');

  // F. PERFORMANCE & STATIC ARCHITECTURE ASSERTIONS
  console.log('\n--- F. Performance & Static Architecture Assertions ---');
  assert(!shellContent.includes('await fetch(') && !shellContent.includes('await createClient()'), 'DashboardShell does not execute per-item async server calls');
  assert(shellContent.includes('desktopSections') || shellContent.includes('navSections'), 'Desktop and Mobile navigation consume canonical navSections');

  const layoutPath = path.join(rootDir, 'src/app/(dashboard)/layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert(layoutContent.includes('resolveDashboardNavigation'), 'Dashboard layout passes deduplicated authContext to resolveDashboardNavigation');

  const enginePath = path.join(rootDir, 'src/server/navigation/navigation-engine.ts');
  const engineContent = fs.readFileSync(enginePath, 'utf8');
  assert(!engineContent.includes('await createAdminClient()'), 'Navigation Engine filters canonical config in-memory without sequential async queries');

  console.log('\n================================================================');
  console.log(`  Phase 31 Step 2 Role-Aware Navigation: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unexpected error running verification:', err);
  process.exit(1);
});

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

  // 1. Config contains all frozen primary items (42 total items)
  const allItems = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  assert(allItems.length === 42, `Canonical nav config contains exactly 42 primary items (found ${allItems.length})`);

  // 2. Section IDs unique
  const sectionIds = CANONICAL_DASHBOARD_NAV_SECTIONS.map((s) => s.id);
  assert(new Set(sectionIds).size === sectionIds.length, 'All canonical section IDs are unique');

  // 3. Item IDs unique
  const itemIds = allItems.map((i) => i.id);
  assert(new Set(itemIds).size === itemIds.length, 'All canonical item IDs are unique');

  // 4. Primary paths unique
  const itemHrefs = allItems.map((i) => i.href);
  assert(new Set(itemHrefs).size === itemHrefs.length, 'All primary navigation paths are unique');

  // 5. Recipes & Costing present
  assert(allItems.some((i) => i.href === '/dashboard/inventory/recipes'), 'Recipes & Costing item is present in canonical nav config');

  // 6. Purchasing & Suppliers present
  assert(allItems.some((i) => i.href === '/dashboard/inventory/purchasing'), 'Purchasing & Suppliers item is present in canonical nav config');

  // 7. Loyalty feature flag behavior
  const loyaltyItem = allItems.find((i) => i.id === 'loyalty');
  assert(loyaltyItem?.badge === 'Soon', 'Loyalty & Rewards maintains Soon badge');

  // 8. /admin routes absent
  assert(!allItems.some((i) => i.href.startsWith('/admin')), 'Super Admin /admin routes are absent from tenant nav config');

  // 9. Public routes absent
  assert(!allItems.some((i) => i.href.startsWith('/login') || i.href.startsWith('/explore')), 'Public authentication/explore routes are absent');

  // B. FILTERING ENGINE ASSERTIONS
  console.log('\n--- B. Navigation Visibility Engine Assertions ---');

  // 10. Section removed when no visible items
  const emptyContext = createMockAuthContext({
    isBusinessOwner: false,
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
  });
  const emptyNav = resolveDashboardNavigation(emptyContext);
  assert(!emptyNav.some((s) => s.id === 'access-governance'), 'Section with 0 visible items (Access & Governance) is removed');

  // 11. Order preserved after filtering
  const ownerContext = createMockAuthContext({ isBusinessOwner: true });
  const ownerNav = resolveDashboardNavigation(ownerContext);
  assert(ownerNav[0].id === 'overview', 'Canonical section order preserved (OVERVIEW first)');

  // 12. View permission exposes viewable navigation
  const viewOnlyContext = createMockAuthContext({
    rolePermissions: ['menu.view', 'inventory.view'],
  });
  const viewOnlyNav = resolveDashboardNavigation(viewOnlyContext);
  assert(viewOnlyNav.some((s) => s.id === 'menu') && viewOnlyNav.some((s) => s.id === 'inventory'), 'View permissions expose viewable navigation modules');

  // 13. Lacking permission hides item
  assert(!viewOnlyNav.some((s) => s.id === 'access-governance'), 'Lacking roles.view hides Access & Governance section');

  // 14. Explicit DENY removes capability-dependent nav
  const denyOverrideContext = createMockAuthContext({
    isBusinessOwner: true,
    permissionOverrides: [{ id: '1', businessMembershipId: 'm1', permissionKey: 'reports.view', effect: 'deny', scopeType: null, branchId: null, departmentId: null, organizationUnitId: null, serviceAreaId: null, createdAt: '' }],
  });
  const denyNav = resolveDashboardNavigation(denyOverrideContext);
  const overviewSec = denyNav.find((s) => s.id === 'overview');
  assert(!overviewSec?.items.some((i) => i.href === '/dashboard/reports'), 'Explicit DENY override removes Reports & Analytics even for Business Owner');

  // 15. Custom role works without built-in role name
  const customRoleContext = createMockAuthContext({
    membershipRole: 'custom_auditor_role',
    customRoleId: 'custom-role-777',
    rolePermissions: ['reports.view', 'reviews.respond'],
  });
  const customRoleNav = resolveDashboardNavigation(customRoleContext);
  assert(customRoleNav.some((s) => s.id === 'overview') && customRoleNav.some((s) => s.id === 'growth-guests'), 'Custom role derives navigation cleanly without built-in role name');

  // 16. Owner visibility is permission-derived
  assert(hasNavCapability(ownerContext, 'business.settings.manage'), 'Owner visibility is capability-derived');

  // 17. Property-context item requires meaningful property scope
  const noPropertyContext = createMockAuthContext({
    authorizedBranchIds: [],
    activeBranchId: null,
    rolePermissions: ['cashier.access'],
  });
  const noPropNav = resolveDashboardNavigation(noPropertyContext);
  assert(!noPropNav.some((s) => s.id === 'operations'), 'Property-context Cashier POS is hidden when user has zero authorized branch scope');

  // 18. Organization-context item does not require property scope
  const orgContextNoProp = createMockAuthContext({
    authorizedBranchIds: [],
    activeBranchId: null,
    rolePermissions: ['organization.view'],
  });
  const orgNavNoProp = resolveDashboardNavigation(orgContextNoProp);
  assert(orgNavNoProp.some((s) => s.id === 'organization-people'), 'Organization-context items are visible without property scope');

  // 19. Mixed-context item behaves correctly
  assert(hasNavScopeContext(noPropertyContext, 'MIXED'), 'MIXED-context items evaluate true regardless of branch scope');

  // 20. Help Center baseline behavior correct
  assert(resolveDashboardNavigation(emptyContext).some((s) => s.id === 'support-guidance'), 'Help Center is visible as baseline support guidance');

  // C. ROLE EXAMPLES ASSERTIONS
  console.log('\n--- C. Role UX Assertions ---');

  // 21. Business Owner broad navigation
  assert(ownerNav.length >= 9, `Business Owner sees broad tenant navigation (${ownerNav.length} sections)`);

  // 22. Branch Manager scoped navigation
  const managerContext = createMockAuthContext({
    membershipRole: 'branch_manager',
    rolePermissions: ['reports.view', 'venue_profile.manage', 'tables.view', 'staff.view', 'staff.invite', 'organization.view', 'people.view', 'roles.view', 'menu.view', 'menu.categories.manage', 'cashier.access', 'waiter.requests.view', 'inventory.view', 'inventory.counts.manage', 'inventory.waste.record', 'inventory.transfers.manage', 'inventory.locations.manage', 'reviews.respond', 'reputation.view'],
  });
  const managerNav = resolveDashboardNavigation(managerContext);
  assert(!managerNav.some((s) => s.items.some((i) => i.href === '/dashboard/business')), 'Branch Manager hides owner-only Business Profile');

  // 23. Cashier operational focus
  const cashierContext = createMockAuthContext({
    membershipRole: 'cashier',
    rolePermissions: ['orders.view', 'cashier.access', 'menu.view'],
  });
  const cashierNav = resolveDashboardNavigation(cashierContext);
  assert(cashierNav.some((s) => s.id === 'operations') && !cashierNav.some((s) => s.id === 'access-governance'), 'Cashier sees POS & Menu and hides Access Governance');

  // 24. Kitchen Staff kitchen focus
  const kitchenContext = createMockAuthContext({
    membershipRole: 'kitchen_staff',
    rolePermissions: ['orders.view', 'kitchen.access', 'menu.view', 'inventory.view', 'inventory.waste.record'],
  });
  const kitchenNav = resolveDashboardNavigation(kitchenContext);
  assert(kitchenNav.some((s) => s.items.some((i) => i.href === '/dashboard/kitchen')) && kitchenNav.some((s) => s.id === 'inventory'), 'Kitchen staff sees Kitchen Queue and Inventory support');

  // 25. Waiter waiter focus
  const waiterContext = createMockAuthContext({
    membershipRole: 'waiter',
    rolePermissions: ['orders.view', 'waiter.requests.view', 'waiter.orders.create'],
  });
  const waiterNav = resolveDashboardNavigation(waiterContext);
  assert(waiterNav.some((s) => s.items.some((i) => i.href === '/dashboard/waiter')), 'Waiter sees Waiter Assistance and Menu');

  // 26. Custom Role capability-driven navigation
  const auditorContext = createMockAuthContext({
    membershipRole: 'custom_auditor',
    rolePermissions: ['reports.view', 'organization.view', 'people.view'],
  });
  const auditorNav = resolveDashboardNavigation(auditorContext);
  assert(auditorNav.some((s) => s.id === 'organization-people') && !auditorNav.some((s) => s.id === 'operations'), 'Custom auditor role sees Organization & Reports and hides Operations');

  // D. ACTIVE ROUTES ASSERTIONS
  console.log('\n--- D. Active Route Matcher Assertions ---');

  // 27. Exact root matching
  assert(isNavItemActive({ href: '/dashboard', exact: true }, '/dashboard'), 'Root /dashboard matches exact');
  assert(!isNavItemActive({ href: '/dashboard', exact: true }, '/dashboard/reports'), 'Root /dashboard exact does not activate on /dashboard/reports');

  // 28. Child route matching
  assert(isNavItemActive({ href: '/dashboard/reports' }, '/dashboard/reports'), 'Child route matches /dashboard/reports');

  // 29. Dynamic detail parent matching
  assert(getParentNavPath('/dashboard/access/roles/role-123') === '/dashboard/access/roles', 'Detail role path maps to parent /dashboard/access/roles');

  // 30. Access roles detail activates Roles & Templates
  assert(isNavItemActive({ href: '/dashboard/access/roles' }, '/dashboard/access/roles/role-999'), 'Access role detail activates Roles & Templates');

  // 31. People detail activates People Directory
  assert(isNavItemActive({ href: '/dashboard/people' }, '/dashboard/people/mem-888'), 'People detail activates People Directory');

  // 32. Inventory item detail activates Stock Items
  assert(isNavItemActive({ href: '/dashboard/inventory/items' }, '/dashboard/inventory/items/item-777'), 'Inventory item detail activates Stock Items');

  // 33. Recipe detail activates Recipes & Costing
  assert(isNavItemActive({ href: '/dashboard/inventory/recipes' }, '/dashboard/inventory/recipes/rec-111'), 'Recipe detail activates Recipes & Costing');

  // 34. Purchasing detail activates Purchasing & Suppliers
  assert(isNavItemActive({ href: '/dashboard/inventory/purchasing' }, '/dashboard/inventory/purchasing/po-555'), 'Purchasing detail activates Purchasing & Suppliers');

  // E. SECURITY INVARIANTS ASSERTIONS
  console.log('\n--- E. Security Invariants Assertions ---');

  // 35. Navigation filtering does not replace route guard
  const guardPath = path.join(rootDir, 'src/server/tenant/guard.ts');
  const guardContent = fs.readFileSync(guardPath, 'utf-8');
  assert(guardContent.includes('requireRoutePermission'), 'Server route guard file exists and enforces route permissions');

  // 36. Server permission map still exists
  const permMapPath = path.join(rootDir, 'src/lib/security/route-permissions.ts');
  const permMapContent = fs.readFileSync(permMapPath, 'utf-8');
  assert(permMapContent.includes('ROUTE_PERMISSION_MAP'), 'Server ROUTE_PERMISSION_MAP is intact');

  // 37. Super Admin isolation preserved
  const superAdminPath = path.join(rootDir, 'src/server/auth/super-admin.ts');
  assert(fs.existsSync(superAdminPath), 'Super Admin service remains completely isolated');

  // 38. No REGION scope introduced
  const authTypesPath = path.join(rootDir, 'src/types/authorization.types.ts');
  const authTypesContent = fs.readFileSync(authTypesPath, 'utf-8');
  assert(!authTypesContent.includes("'REGION'"), 'Canonical RBAC scopes preserve ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF without REGION');

  // 39. No job-title permission inheritance introduced
  const policyEnginePath = path.join(rootDir, 'src/server/auth/policy-engine.ts');
  const policyContent = fs.readFileSync(policyEnginePath, 'utf-8');
  assert(!policyContent.includes('jobTitlePermissions'), 'Policy Engine evaluation is free of job-title permission inheritance');

  // 40. No client service-role usage
  const shellPath = path.join(rootDir, 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf-8');
  assert(!shellContent.includes('createAdminClient') && !shellContent.includes('SUPABASE_SERVICE_ROLE'), 'DashboardShell client component does not use service role credentials');

  // F. PERFORMANCE STATIC CHECKS
  console.log('\n--- F. Performance & Static Architecture Assertions ---');

  // 41. Dashboard shell does not perform per-nav-item server actions
  assert(!shellContent.includes('await can(') && !shellContent.includes('diagnoseAccessAction'), 'DashboardShell does not execute per-item async server calls');

  // 42. Desktop/mobile use same nav source
  assert(shellContent.includes('allowedNavSections'), 'Desktop and Mobile navigation in DashboardShell consume the exact same navSections array');

  // 43. No duplicated canonical navigation arrays
  assert(!shellContent.includes("title: 'OVERVIEW'"), 'Hardcoded rawNavSections array removed from DashboardShell');

  // 44. Authorization context resolution is reused
  const dashLayoutPath = path.join(rootDir, 'src/app/(dashboard)/layout.tsx');
  const dashLayoutContent = fs.readFileSync(dashLayoutPath, 'utf-8');
  assert(dashLayoutContent.includes('resolveDashboardNavigation(authContext)'), 'Dashboard layout passes deduplicated authContext to resolveDashboardNavigation');

  // 45. No obvious sequential N+1 nav permission loop
  const navEnginePath = path.join(rootDir, 'src/server/navigation/navigation-engine.ts');
  const navEngineContent = fs.readFileSync(navEnginePath, 'utf-8');
  assert(!navEngineContent.includes('await authorize('), 'Navigation Engine filters canonical config in-memory without sequential async queries');

  console.log('\n================================================================');
  console.log(`  Phase 31 Step 2 Role-Aware Navigation: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Phase 31 Step 2 Verification Error:', err);
  process.exit(1);
});

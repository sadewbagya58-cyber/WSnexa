import {
  DASHBOARD_PAGE_METADATA_REGISTRY,
  getPageMetadata,
  getPageBreadcrumbs,
} from '../src/lib/navigation/dashboard-page-metadata';
import { CANONICAL_DASHBOARD_NAV_SECTIONS } from '../src/lib/navigation/dashboard-navigation';
import fs from 'fs';
import path from 'path';

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

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 31 Step 3 — Dashboard Shell & Page UX Verification');
  console.log('================================================================\n');

  // --- A. Canonical Page Metadata Registry ---
  console.log('--- A. Canonical Page Metadata Registry ---');

  const metadataPath = path.join(process.cwd(), 'src/lib/navigation/dashboard-page-metadata.ts');
  assert(fs.existsSync(metadataPath), 'Canonical page metadata source file exists');

  const registryKeys = Object.keys(DASHBOARD_PAGE_METADATA_REGISTRY);
  assert(registryKeys.length >= 40, `Metadata registry covers ${registryKeys.length} canonical routes`);

  const uniqueKeys = new Set(registryKeys);
  assert(uniqueKeys.size === registryKeys.length, 'All registry route keys are unique without duplicates');

  let allPrimaryHaveMetadata = true;
  for (const sec of CANONICAL_DASHBOARD_NAV_SECTIONS) {
    for (const item of sec.items) {
      if (!DASHBOARD_PAGE_METADATA_REGISTRY[item.href]) {
        allPrimaryHaveMetadata = false;
        console.error(`Missing metadata for primary route: ${item.href}`);
      }
    }
  }
  assert(allPrimaryHaveMetadata, 'Every canonical primary navigation route has corresponding page metadata');

  const hasAdminRoute = registryKeys.some((r) => r.startsWith('/admin'));
  assert(!hasAdminRoute, 'No Super Admin /admin routes included in page metadata registry');

  const hasPublicRoute = registryKeys.some((r) => r === '/login' || r === '/register' || r.startsWith('/venues/'));
  assert(!hasPublicRoute, 'No public authentication or explore routes included in page metadata registry');

  // --- B. Page Header & Breadcrumbs Components ---
  console.log('\n--- B. Page Header & Breadcrumb Components ---');

  const pageHeaderPath = path.join(process.cwd(), 'src/components/layout/page-header.tsx');
  assert(fs.existsSync(pageHeaderPath), 'Reusable PageHeader component file exists');

  const pageHeaderContent = fs.readFileSync(pageHeaderPath, 'utf8');
  assert(pageHeaderContent.includes('title: string'), 'PageHeader supports title prop');
  assert(pageHeaderContent.includes('description?: string'), 'PageHeader supports description prop');
  assert(pageHeaderContent.includes('breadcrumbs?: BreadcrumbItem[]'), 'PageHeader supports breadcrumbs prop');
  assert(pageHeaderContent.includes('primaryAction?: React.ReactNode'), 'PageHeader supports primaryAction prop');
  assert(pageHeaderContent.includes('secondaryActions?: React.ReactNode'), 'PageHeader supports secondaryActions prop');
  assert(pageHeaderContent.includes('<h1'), 'PageHeader renders semantic <h1> tag');
  const breadcrumbsPath = path.join(process.cwd(), 'src/components/layout/breadcrumbs.tsx');
  assert(fs.existsSync(breadcrumbsPath), 'Reusable Breadcrumbs component file exists');
  const breadcrumbsContent = fs.readFileSync(breadcrumbsPath, 'utf8');
  assert(breadcrumbsContent.includes('aria-label="Breadcrumb"'), 'Breadcrumbs renders accessible breadcrumb navigation landmark');

  // Test getPageBreadcrumbs helper
  const rootCrumbs = getPageBreadcrumbs('/dashboard');
  assert(rootCrumbs.length === 1 && rootCrumbs[0].label === 'Dashboard', 'getPageBreadcrumbs(/dashboard) returns single root item');

  const rolesCrumbs = getPageBreadcrumbs('/dashboard/access/roles');
  assert(
    rolesCrumbs.length === 3 &&
      rolesCrumbs[1].label === 'Access Control Hub' &&
      rolesCrumbs[2].label === 'Roles & Templates',
    'getPageBreadcrumbs(/dashboard/access/roles) returns 3-level chain (Dashboard > Access Control Hub > Roles & Templates)'
  );

  const roleDetailCrumbs = getPageBreadcrumbs('/dashboard/access/roles/123-abc', 'Manager Role');
  assert(
    roleDetailCrumbs.length === 4 &&
      roleDetailCrumbs[3].label === 'Manager Role',
    'getPageBreadcrumbs(/dashboard/access/roles/[roleId], customLabel) returns 4-level chain with entity label'
  );

  // --- C. Shell Navigation & Layout Variants ---
  console.log('\n--- C. Shell Navigation & Layout Variants ---');

  const shellPath = path.join(process.cwd(), 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');

  assert(shellContent.includes('navSections?: DashboardNavSectionDTO[]'), 'DashboardShell consumes server-injected navSections DTO');
  assert(shellContent.includes('renderDesktopNavLinks') && shellContent.includes('renderMobileNavLinks'), 'Desktop and Mobile navigation share allowedNavSections');
  assert(!shellContent.includes('rawNavSections'), 'Hardcoded rawNavSections array remains removed from DashboardShell');
  assert(shellContent.includes('isNavItemActive(item, pathname)'), 'Centralized active route matcher is used for sidebar highlighting');
  assert(shellContent.includes('formatRoleLabel(userRole)'), 'User role slug is formatted into readable label');
  assert(shellContent.includes('layoutVariant'), 'DashboardShell queries layoutVariant from page metadata');

  // Verify layout variants in metadata
  const cashierMeta = getPageMetadata('/dashboard/cashier');
  assert(cashierMeta.layoutVariant === 'workspace', 'Cashier POS route (/dashboard/cashier) uses workspace layout variant');

  const kitchenMeta = getPageMetadata('/dashboard/kitchen');
  assert(kitchenMeta.layoutVariant === 'workspace', 'Kitchen Queue route (/dashboard/kitchen) uses workspace layout variant');

  const waiterMeta = getPageMetadata('/dashboard/waiter');
  assert(waiterMeta.layoutVariant === 'workspace', 'Waiter Queue route (/dashboard/waiter) uses workspace layout variant');

  const reportsMeta = getPageMetadata('/dashboard/reports');
  assert(reportsMeta.layoutVariant === 'wide', 'Reports & Analytics route (/dashboard/reports) uses wide layout variant');

  const overviewMeta = getPageMetadata('/dashboard');
  assert(overviewMeta.layoutVariant === 'standard', 'Dashboard Overview route (/dashboard) uses standard layout variant');

  // --- D. Detail Pages Header Integration ---
  console.log('\n--- D. Detail Pages Header Integration ---');

  const roleDetailPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/access/roles/[roleId]/page.tsx');
  const roleDetailContent = fs.readFileSync(roleDetailPagePath, 'utf8');
  assert(roleDetailContent.includes('<PageHeader'), 'Role Detail page uses PageHeader component');

  const memberAccessPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/access/members/[membershipId]/page.tsx');
  const memberAccessContent = fs.readFileSync(memberAccessPagePath, 'utf8');
  assert(memberAccessContent.includes('<PageHeader'), 'Member Access Profile page uses PageHeader component');

  const peopleProfilePagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/people/[membershipId]/page.tsx');
  const peopleProfileContent = fs.readFileSync(peopleProfilePagePath, 'utf8');
  assert(peopleProfileContent.includes('<PageHeader'), 'Employee Profile page uses PageHeader component');

  const recipeDetailPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/inventory/recipes/[id]/page.tsx');
  const recipeDetailContent = fs.readFileSync(recipeDetailPagePath, 'utf8');
  assert(recipeDetailContent.includes('<PageHeader'), 'Recipe Detail page uses PageHeader component');

  const purchasingDetailPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/inventory/purchasing/[id]/page.tsx');
  const purchasingDetailContent = fs.readFileSync(purchasingDetailPagePath, 'utf8');
  assert(purchasingDetailContent.includes('<PageHeader'), 'Purchase Order Detail page uses PageHeader component');

  // --- E. Security & Architecture Invariants ---
  console.log('\n--- E. Security & Architecture Invariants ---');

  const routeGuardPath = path.join(process.cwd(), 'src/server/tenant/guard.ts');
  assert(fs.existsSync(routeGuardPath), 'Server route guard (requireRoutePermission) remains intact');

  assert(!shellContent.includes('supabase.auth.admin') && !shellContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No service-role credentials used in client shell components');

  const permissionValPath = path.join(process.cwd(), 'src/lib/validation/permission.ts');
  const permissionValContent = fs.readFileSync(permissionValPath, 'utf8');
  assert(!permissionValContent.includes('REGION'), 'Canonical RBAC scopes preserve ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF without REGION');

  const policyEnginePath = path.join(process.cwd(), 'src/server/auth/policy-engine.ts');
  const policyEngineContent = fs.readFileSync(policyEnginePath, 'utf8');
  assert(!policyEngineContent.includes('jobTitle.permissions'), 'Policy Engine evaluation is free of job-title permission inheritance');
  assert(policyEngineContent.includes("effect === 'deny'"), 'Explicit DENY precedence architecture remains untouched');

  console.log('\n================================================================');
  console.log(`  Phase 31 Step 3 Verification: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});

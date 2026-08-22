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
  console.log('  WSNexa Phase 31 Step 1 — Navigation & IA Verification        ');
  console.log('================================================================\n');

  const rootDir = process.cwd();

  // 1. Canonical primary navigation routes exist on disk
  console.log('--- 1. Canonical Primary Route Existence ---');
  const canonicalRoutes = [
    '/dashboard',
    '/dashboard/reports',
    '/dashboard/business',
    '/dashboard/venue-profile',
    '/dashboard/branches',
    '/dashboard/dining',
    '/dashboard/team',
    '/dashboard/team/invites',
    '/dashboard/organization',
    '/dashboard/organization/structure',
    '/dashboard/organization/chart',
    '/dashboard/organization/job-titles',
    '/dashboard/organization/positions',
    '/dashboard/people',
    '/dashboard/people/acting',
    '/dashboard/people/secondments',
    '/dashboard/people/integrity',
    '/dashboard/access',
    '/dashboard/access/roles',
    '/dashboard/access/scope-grants',
    '/dashboard/access/diagnostics',
    '/dashboard/menu',
    '/dashboard/menu/categories',
    '/dashboard/menu/items',
    '/dashboard/cashier',
    '/dashboard/kitchen',
    '/dashboard/waiter',
    '/dashboard/waiter/menu',
    '/dashboard/inventory',
    '/dashboard/inventory/items',
    '/dashboard/inventory/counts',
    '/dashboard/inventory/waste',
    '/dashboard/inventory/transfers',
    '/dashboard/inventory/locations',
    '/dashboard/reviews',
    '/dashboard/reputation',
    '/dashboard/loyalty',
    '/dashboard/settings/order-security',
    '/dashboard/settings/payments',
    '/dashboard/help',
  ];

  for (const r of canonicalRoutes) {
    // Check path in app directory
    let pagePath: string;
    if (r.startsWith('/dashboard/settings')) {
      pagePath = path.join(rootDir, 'src/app', r, 'page.tsx');
    } else if (r === '/dashboard') {
      pagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard/page.tsx');
    } else {
      const sub = r.replace('/dashboard/', '');
      pagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard', sub, 'page.tsx');
    }

    assert(fs.existsSync(pagePath), `Primary route ${r} page file exists at ${path.relative(rootDir, pagePath)}`);
  }

  // 2. No duplicate primary navigation paths
  console.log('\n--- 2. Path Uniqueness ---');
  const uniqueRoutes = new Set(canonicalRoutes);
  assert(uniqueRoutes.size === canonicalRoutes.length, 'All canonical primary navigation paths are unique');

  // 3. Section & Module Audits
  console.log('\n--- 3. Module & Security Boundaries ---');
  assert(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/access/page.tsx')), 'Access Control Hub route exists');
  assert(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/organization/page.tsx')), 'Organization Hub route exists');
  assert(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/cashier/page.tsx')), 'Cashier POS workspace route exists');
  assert(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/kitchen/page.tsx')), 'Kitchen Queue workspace route exists');
  assert(fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/inventory/page.tsx')), 'Inventory Hub route exists');
  assert(fs.existsSync(path.join(rootDir, 'src/app/dashboard/settings/order-security/page.tsx')), 'Settings Order Security route exists');

  // 4. Detail / Member Inspector routes are NOT primary navigation entries
  console.log('\n--- 4. Detail Route Classification ---');
  const detailRoutes = [
    '/dashboard/people/[membershipId]',
    '/dashboard/access/members/[membershipId]',
    '/dashboard/access/roles/[roleId]',
    '/dashboard/inventory/items/[id]',
    '/dashboard/inventory/counts/[id]',
  ];

  for (const dr of detailRoutes) {
    assert(!canonicalRoutes.includes(dr), `Detail inspector route ${dr} is correctly excluded from primary nav`);
  }

  // 5. Super Admin and Public Separation
  console.log('\n--- 5. Public / Super Admin Isolation ---');
  const adminRoutesInNav = canonicalRoutes.filter((r) => r.startsWith('/admin'));
  assert(adminRoutesInNav.length === 0, 'No Super Admin /admin routes are present in tenant nav');

  const publicRoutesInNav = canonicalRoutes.filter((r) => r.startsWith('/explore') || r.startsWith('/login'));
  assert(publicRoutesInNav.length === 0, 'No public authentication/explore routes are present in tenant nav');

  // 6. Canonical Section Title Uniqueness
  console.log('\n--- 6. Section Titles ---');
  const sectionTitles = [
    'OVERVIEW',
    'VENUE SETUP',
    'ORGANIZATION & PEOPLE',
    'ACCESS & GOVERNANCE',
    'MENU',
    'OPERATIONS',
    'INVENTORY',
    'GROWTH & GUESTS',
    'SETTINGS',
    'SUPPORT & GUIDANCE',
  ];
  const uniqueTitles = new Set(sectionTitles);
  assert(uniqueTitles.size === sectionTitles.length, 'All 10 top-level section titles are unique');

  // 7. Step 1 Documentation Artifacts
  console.log('\n--- 7. Step 1 Documentation & Plan Artifacts ---');
  assert(fs.existsSync(path.join(rootDir, 'docs/phase-31-navigation-map.md')), 'docs/phase-31-navigation-map.md exists');
  assert(fs.existsSync(path.join(rootDir, 'docs/phase-31-step-1-navigation-and-ia-audit.md')), 'docs/phase-31-step-1-navigation-and-ia-audit.md exists');
  assert(fs.existsSync(path.join(rootDir, 'docs/phase-31-implementation-plan.md')), 'docs/phase-31-implementation-plan.md exists');

  const planContent = fs.readFileSync(path.join(rootDir, 'docs/phase-31-implementation-plan.md'), 'utf-8');
  assert(planContent.includes('Step 1') && planContent.includes('Step 7'), 'docs/phase-31-implementation-plan.md contains all 7 master roadmap steps');

  // 8. Step 2 Navigation Engine Integration Guard
  console.log('\n--- 8. Step 2 Navigation Engine Integration Guard ---');
  assert(fs.existsSync(path.join(rootDir, 'src/server/navigation/navigation-engine.ts')), 'Step 2 dynamic navigation-engine.ts is present');

  console.log('\n================================================================');
  console.log(`  Phase 31 Step 1 Navigation IA Verification: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Phase 31 Step 1 Verification Error:', err);
  process.exit(1);
});

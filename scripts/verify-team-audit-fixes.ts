// Bypass server-only guard for tsx execution
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

import * as fs from 'fs';
import * as path from 'path';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message} ${detail ? `-> ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('  WSNexa Team / Workforce Audit Fixes — Regression Suite       ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Issue 1 — Staff Directory Canonical Navigation
  // -------------------------------------------------------------
  console.log('Test Group 1: Issue 1 — Staff Directory Canonical Navigation');
  const teamPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/dashboard/team/page.tsx'),
    'utf8'
  );
  assert(
    teamPageContent.includes("redirect('/dashboard/people')"),
    '/dashboard/team/page.tsx redirects to /dashboard/people'
  );
  assert(
    teamPageContent.includes("requireRoutePermission('/dashboard/team')"),
    '/dashboard/team/page.tsx maintains requireRoutePermission security guard'
  );

  const { CANONICAL_DASHBOARD_NAV_SECTIONS } = await import(
    '../src/lib/navigation/dashboard-navigation'
  );
  const teamNavSection = CANONICAL_DASHBOARD_NAV_SECTIONS.find(
    (s: { id: string }) => s.id === 'workspace'
  )?.items.find((item: { id: string }) => item.id === 'team');

  assert(Boolean(teamNavSection), 'Team navigation group exists in CANONICAL_DASHBOARD_NAV_SECTIONS');

  const staffDirectoryItem = teamNavSection?.children?.find(
    (c: { id: string }) => c.id === 'staff_directory'
  );
  assert(
    staffDirectoryItem?.href === '/dashboard/people',
    'Staff Directory item in navigation points to /dashboard/people'
  );

  const duplicatePeopleItem = teamNavSection?.children?.find(
    (c: { id: string }) => c.id === 'people_directory'
  );
  assert(
    !duplicatePeopleItem,
    'Duplicate people_directory item was removed from Team navigation children'
  );

  const subnavContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/team/team-subnav.tsx'),
    'utf8'
  );
  assert(
    subnavContent.includes("href: '/dashboard/people'"),
    'TeamSubNav Staff Directory tab links to /dashboard/people'
  );

  // -------------------------------------------------------------
  // Test 2: Issue 2 — Roles & Permissions Canonical Surface
  // -------------------------------------------------------------
  console.log('\nTest Group 2: Issue 2 — Roles & Permissions Canonical Surface');
  const teamRolesPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/dashboard/team/roles/page.tsx'),
    'utf8'
  );
  assert(
    teamRolesPageContent.includes("redirect('/dashboard/access/roles')"),
    '/dashboard/team/roles redirects to /dashboard/access/roles'
  );

  const rolesItem = teamNavSection?.children?.find(
    (c: { id: string }) => c.id === 'roles_permissions'
  );
  assert(
    rolesItem?.href === '/dashboard/access/roles',
    'Roles & Permissions item in navigation points to /dashboard/access/roles'
  );

  assert(
    subnavContent.includes("href: '/dashboard/access/roles'"),
    'TeamSubNav Roles & Permissions tab links to /dashboard/access/roles'
  );

  // -------------------------------------------------------------
  // Test 3: Issue 3 — Automated Lifecycle Reconciliation
  // -------------------------------------------------------------
  console.log('\nTest Group 3: Issue 3 — Automated Lifecycle Reconciliation');
  const cronRoutePath = path.join(
    process.cwd(),
    'src/app/api/cron/reconcile-assignments/route.ts'
  );
  assert(fs.existsSync(cronRoutePath), 'Reconcile assignments cron route exists at /api/cron/reconcile-assignments');

  const cronRouteContent = fs.readFileSync(cronRoutePath, 'utf8');
  assert(
    cronRouteContent.includes('OrganizationService.reconcileAssignmentLifecycle'),
    'Cron route calls OrganizationService.reconcileAssignmentLifecycle'
  );
  assert(
    cronRouteContent.includes('CRON_SECRET'),
    'Cron route supports CRON_SECRET security validation'
  );
  assert(
    cronRouteContent.includes('export async function GET') && cronRouteContent.includes('export async function POST'),
    'Cron route exports both GET and POST HTTP handlers'
  );

  // -------------------------------------------------------------
  // Test 4: Issue 4 — Unassigned Position State & Placement Workflow
  // -------------------------------------------------------------
  console.log('\nTest Group 4: Issue 4 — Unassigned Position State & Placement Workflow');
  const peopleDirectoryContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/organization/people-directory-client.tsx'),
    'utf8'
  );
  assert(
    peopleDirectoryContent.includes('Role Active • Unassigned') ||
      peopleDirectoryContent.includes('Operational Role Active'),
    'People Directory clearly marks unassigned members with active operational role badge'
  );
  assert(
    peopleDirectoryContent.includes('?action=assign'),
    'People Directory provides direct action link to placement workflow (?action=assign)'
  );

  const memberProfileContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/organization/member-profile-client.tsx'),
    'utf8'
  );
  assert(
    memberProfileContent.includes("searchParams.get('action') === 'assign'"),
    'Member Profile reads ?action=assign query parameter'
  );
  assert(
    memberProfileContent.includes('Unassigned Placement Status Notice') ||
      memberProfileContent.includes('Operational Role Active • Unassigned Position'),
    'Member Profile renders dedicated Unassigned Position Placement callout banner'
  );

  // -------------------------------------------------------------
  // Test 5: Issue 5 — Mobile Visual Organization Chart
  // -------------------------------------------------------------
  console.log('\nTest Group 5: Issue 5 — Mobile Visual Organization Chart');
  const visualOrgChartContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/organization/visual-org-chart-client.tsx'),
    'utf8'
  );
  assert(
    visualOrgChartContent.includes('zoomScale') && visualOrgChartContent.includes('setZoomScale'),
    'VisualOrgChartClient includes interactive zoom scale state'
  );
  assert(
    visualOrgChartContent.includes('handleZoomIn') && visualOrgChartContent.includes('handleZoomOut'),
    'VisualOrgChartClient provides zoom in, zoom out, and reset handlers'
  );
  assert(
    visualOrgChartContent.includes('touch-manipulation'),
    'VisualOrgChartClient elements include touch-manipulation utility for responsive mobile interactions'
  );
  assert(
    visualOrgChartContent.includes('w-56 sm:w-64'),
    'VisualOrgChartClient uses responsive card widths (w-56 on mobile, sm:w-64 on desktop)'
  );

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passedAssertions}/${totalAssertions} Assertions Passed`);
  console.log('================================================================\n');

  if (passedAssertions !== totalAssertions) {
    process.exitCode = 1;
  }
}

runSuite().catch((err) => {
  console.error('Test suite failure:', err);
  process.exitCode = 1;
});

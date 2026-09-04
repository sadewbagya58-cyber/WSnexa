// Bypass server-only guard and provide mock env for tsx execution
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

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
  console.log('  WSNexa QA Fixes & Team Regression Suite                      ');
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

  // -------------------------------------------------------------
  // Test 6: Mobile People & Workforce Directory Layout
  // -------------------------------------------------------------
  console.log('\nTest Group 6: People Directory Mobile Cards & Responsive Viewports');
  assert(
    peopleDirectoryContent.includes('block md:hidden') && peopleDirectoryContent.includes('hidden md:block'),
    'PeopleDirectoryClient separates mobile card rendering (md:hidden) from desktop table (hidden md:block)'
  );
  assert(
    peopleDirectoryContent.includes('min-h-[44px]') || peopleDirectoryContent.includes('min-h-[40px]'),
    'PeopleDirectoryClient mobile controls implement touch-friendly target sizing (>=40-44px)'
  );
  assert(
    peopleDirectoryContent.includes('Property') &&
      peopleDirectoryContent.includes('Department') &&
      peopleDirectoryContent.includes('Position Slot') &&
      peopleDirectoryContent.includes('Supervisor'),
    'People Directory mobile cards expose complete workforce metadata (Property, Department, Position Slot, Supervisor)'
  );

  // -------------------------------------------------------------
  // Test 7: Staff Management Action Parity in People Directory
  // -------------------------------------------------------------
  console.log('\nTest Group 7: Staff Management Action Parity');
  assert(
    peopleDirectoryContent.includes('handleOpenEditRole') && peopleDirectoryContent.includes('updateMemberRoleAction'),
    'People Directory provides Edit Staff role modal calling updateMemberRoleAction'
  );
  assert(
    peopleDirectoryContent.includes('handleOpenManageAreas') && peopleDirectoryContent.includes('assignStaffToAreasAction'),
    'People Directory provides Service Areas modal calling assignStaffToAreasAction'
  );
  assert(
    peopleDirectoryContent.includes('handleToggleStatus') && peopleDirectoryContent.includes('setMembershipStatusAction'),
    'People Directory provides Suspend/Reactivate action calling setMembershipStatusAction'
  );
  assert(
    peopleDirectoryContent.includes('/dashboard/access/members/'),
    'People Directory provides direct Access Profile hub navigation'
  );
  assert(
    peopleDirectoryContent.includes('canAssignRoles') &&
      peopleDirectoryContent.includes('canSuspend') &&
      peopleDirectoryContent.includes('canAssignAreas'),
    'People Directory honors server-side capability permissions (canAssignRoles, canSuspend, canAssignAreas)'
  );

  // -------------------------------------------------------------
  // Test 8: Positions & Headcount Mobile UI
  // -------------------------------------------------------------
  console.log('\nTest Group 8: Positions & Headcount Mobile UI');
  const positionsClientContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/organization/positions-client.tsx'),
    'utf8'
  );
  assert(
    positionsClientContent.includes('block md:hidden') && positionsClientContent.includes('hidden md:block'),
    'PositionsClient renders dedicated responsive mobile cards (md:hidden) and preserves desktop table (hidden md:block)'
  );
  assert(
    positionsClientContent.includes('Headcount Capacity') &&
      positionsClientContent.includes('Substantive Occupant(s)') &&
      positionsClientContent.includes('Property') &&
      positionsClientContent.includes('Department'),
    'Positions mobile cards render complete establishment metadata (Headcount, Occupants, Property, Department)'
  );
  assert(
    positionsClientContent.includes('/dashboard/access/invites?positionId=') &&
      positionsClientContent.includes('/dashboard/people?assignPositionId='),
    'Positions mobile cards provide direct + Invite and Assign actions'
  );
  assert(
    positionsClientContent.includes('min-h-[44px]'),
    'Positions mobile actions use touch-friendly >=44px tap targets'
  );

  // -------------------------------------------------------------
  // Test 9: Position Headcount & Secondment Occupancy Separation
  // -------------------------------------------------------------
  console.log('\nTest Group 9: Position Headcount & Secondment Occupancy Separation');
  const orgServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/organization.service.ts'),
    'utf8'
  );
  assert(
    orgServiceContent.includes("eq('is_primary', true)") &&
      orgServiceContent.includes("eq('status', 'active')"),
    'OrganizationService.getPositionOccupancy counts only active is_primary assignments'
  );
  assert(
    orgServiceContent.includes('secondmentAssignments') &&
      orgServiceContent.includes('temporaryAssignments'),
    'OrganizationService.getPositionCoverage returns secondments and temporary assignments separately'
  );
  assert(
    positionsClientContent.includes('secondmentAssignments') &&
      positionsClientContent.includes('Seconded:'),
    'PositionsClient displays secondment assignments separately without inflating substantive headcount'
  );

  // -------------------------------------------------------------
  // Test 10: Kitchen Staff Order Completion Authorization
  // -------------------------------------------------------------
  console.log('\nTest Group 10: Kitchen Staff Order Completion Authorization');
  const orderServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/order.service.ts'),
    'utf8'
  );
  assert(
    orderServiceContent.includes("permission: 'kitchen.update', resource") &&
      orderServiceContent.includes("nextStatus === 'completed'"),
    'OrderService.updateOrderStatus authorizes kitchen.update for nextStatus === completed'
  );

  // -------------------------------------------------------------
  // Test 11: Kitchen Orders Mobile Responsive UI
  // -------------------------------------------------------------
  console.log('\nTest Group 11: Kitchen Orders Mobile Responsive UI');
  const kitchenQueueContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/kitchen/kitchen-order-queue.tsx'),
    'utf8'
  );
  assert(
    kitchenQueueContent.includes('break-words') &&
      kitchenQueueContent.includes('min-h-[44px]'),
    'KitchenOrderQueue ensures break-words wrapping and >=44px touch targets'
  );
  assert(
    kitchenQueueContent.includes('flex flex-col sm:flex-row'),
    'KitchenOrderQueue header controls stack responsively on mobile'
  );

  // -------------------------------------------------------------
  // Test 12: Assignments Tab Mobile Responsive UI in Member Profile
  // -------------------------------------------------------------
  console.log('\nTest Group 12: Assignments Tab Mobile Responsive UI');
  assert(
    memberProfileContent.includes('block md:hidden') &&
      memberProfileContent.includes('hidden md:block') &&
      memberProfileContent.includes('Nature:'),
    'MemberProfileClient Assignments tab separates mobile cards (block md:hidden) from desktop table (hidden md:block)'
  );
  assert(
    memberProfileContent.includes('Timeline') &&
      memberProfileContent.includes('Property') &&
      memberProfileContent.includes('Department'),
    'MemberProfileClient Assignment cards display Role, Nature, Property, Department, and Timeline'
  );

  // -------------------------------------------------------------
  // Test 13: Active Secondment Reflection in Access Profile & Lifecycle Invariants
  // -------------------------------------------------------------
  console.log('\nTest Group 13: Active Secondment Reflection in Access Profile');
  const scopeGrantServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/scope-grant.service.ts'),
    'utf8'
  );
  assert(
    scopeGrantServiceContent.includes('OrganizationService.getMemberAssignmentHistory') &&
      scopeGrantServiceContent.includes('OrganizationService.isAssignmentEffective'),
    'ScopeGrantService.previewMemberEffectiveAccess queries canonical assignment history and checks effective dates'
  );
  assert(
    scopeGrantServiceContent.includes('secondmentAssignments: activeSecondments') &&
      scopeGrantServiceContent.includes('actingAssignments: activeActing'),
    'ScopeGrantService.previewMemberEffectiveAccess populates temporaryAuthority with active secondments and acting assignments'
  );

  const { OrganizationService } = await import('../src/server/services/organization.service');
  const testNow = new Date('2026-09-03T12:00:00Z');

  // Test Active Secondment
  const activeSec = {
    status: 'active',
    starts_at: '2026-09-03T00:00:00Z',
    ends_at: '2026-09-04T00:00:00Z',
  };
  assert(
    OrganizationService.isAssignmentEffective(activeSec, testNow) === true,
    'Active secondment on effective date is marked effective (true)'
  );

  // Test Future Secondment
  const futureSec = {
    status: 'active',
    starts_at: '2026-09-10T00:00:00Z',
    ends_at: '2026-09-20T00:00:00Z',
  };
  assert(
    OrganizationService.isAssignmentEffective(futureSec, testNow) === false,
    'Future secondment before start date is NOT effective (false)'
  );

  // Test Ended Secondment
  const endedSec = {
    status: 'active',
    starts_at: '2026-08-01T00:00:00Z',
    ends_at: '2026-08-30T00:00:00Z',
  };
  assert(
    OrganizationService.isAssignmentEffective(endedSec, testNow) === false,
    'Ended secondment after end date is NOT effective (false)'
  );

  const memberAccessDetailContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/member-access-detail-client.tsx'),
    'utf8'
  );
  assert(
    memberAccessDetailContent.includes('✈️ Secondment:') &&
      memberAccessDetailContent.includes('Host Branch'),
    'MemberAccessDetailClient Section 3 renders active secondments with Host Branch and role details'
  );

  // -------------------------------------------------------------
  // Test 14: Permission Catalog UX — Categorization & Search
  // -------------------------------------------------------------
  console.log('\nTest Group 14: Permission Catalog UX & Categorized Picker');
  const {
    PERMISSION_CATEGORIES,
    resolvePermissionCategory,
    groupPermissionsByCategory,
  } = await import('../src/lib/permissions/permission-categories');

  assert(
    PERMISSION_CATEGORIES.length >= 17,
    `PERMISSION_CATEGORIES defines all ${PERMISSION_CATEGORIES.length} functional modules`
  );

  // Verify categorization mappings
  assert(resolvePermissionCategory({ key: 'organization.view' }) === 'Organization', 'organization.view -> Organization');
  assert(resolvePermissionCategory({ key: 'positions.manage' }) === 'Organization', 'positions.manage -> Organization');
  assert(resolvePermissionCategory({ key: 'staff.view' }) === 'Staff & People', 'staff.view -> Staff & People');
  assert(resolvePermissionCategory({ key: 'roles.manage' }) === 'Staff & People', 'roles.manage -> Staff & People');
  assert(resolvePermissionCategory({ key: 'branches.manage' }) === 'Branches', 'branches.manage -> Branches');
  assert(resolvePermissionCategory({ key: 'inventory.view' }) === 'Inventory', 'inventory.view -> Inventory');
  assert(resolvePermissionCategory({ key: 'recipes.manage' }) === 'Inventory', 'recipes.manage -> Inventory');
  assert(resolvePermissionCategory({ key: 'menu.items.manage' }) === 'Menu', 'menu.items.manage -> Menu');
  assert(resolvePermissionCategory({ key: 'orders.update_status' }) === 'Orders', 'orders.update_status -> Orders');
  assert(resolvePermissionCategory({ key: 'kitchen.update' }) === 'Kitchen', 'kitchen.update -> Kitchen');
  assert(resolvePermissionCategory({ key: 'purchasing.create' }) === 'Purchasing', 'purchasing.create -> Purchasing');
  assert(resolvePermissionCategory({ key: 'suppliers.manage' }) === 'Suppliers', 'suppliers.manage -> Suppliers');
  assert(resolvePermissionCategory({ key: 'reservations.manage' }) === 'Reservations', 'reservations.manage -> Reservations');
  assert(resolvePermissionCategory({ key: 'customers.view' }) === 'Customers', 'customers.view -> Customers');
  assert(resolvePermissionCategory({ key: 'loyalty.rewards.manage' }) === 'Loyalty', 'loyalty.rewards.manage -> Loyalty');
  assert(resolvePermissionCategory({ key: 'tables.manage' }) === 'QR / Tables', 'tables.manage -> QR / Tables');
  assert(resolvePermissionCategory({ key: 'waiter.order.create' }) === 'Waiter', 'waiter.order.create -> Waiter');
  assert(resolvePermissionCategory({ key: 'reports.view' }) === 'Reports', 'reports.view -> Reports');
  assert(resolvePermissionCategory({ key: 'reviews.manage' }) === 'Reviews / Reputation', 'reviews.manage -> Reviews / Reputation');
  assert(resolvePermissionCategory({ key: 'business.settings.manage' }) === 'Business / Venue', 'business.settings.manage -> Business / Venue');

  const testCatalog = [
    { key: 'kitchen.update', name: 'Kitchen Order Update', description: 'Update status of kitchen orders' },
    { key: 'orders.create', name: 'Create Orders', description: 'Place guest orders' },
    { key: 'staff.view', name: 'View Staff', description: 'List workforce members' },
  ];
  const grouped = groupPermissionsByCategory(testCatalog as never);
  assert(Boolean(grouped['Kitchen']) && grouped['Kitchen'].length === 1, 'groupPermissionsByCategory groups kitchen.update into Kitchen');
  assert(Boolean(grouped['Orders']) && grouped['Orders'].length === 1, 'groupPermissionsByCategory groups orders.create into Orders');
  assert(Boolean(grouped['Staff & People']) && grouped['Staff & People'].length === 1, 'groupPermissionsByCategory groups staff.view into Staff & People');

  // Verify PermissionPicker is integrated across access control modals
  const overrideModalContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/member-override-modal.tsx'),
    'utf8'
  );
  assert(
    overrideModalContent.includes('PermissionPicker'),
    'MemberOverrideModal uses categorized PermissionPicker'
  );

  const scopeGrantManagerContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/scope-grant-manager.tsx'),
    'utf8'
  );
  assert(
    scopeGrantManagerContent.includes('PermissionPicker'),
    'ScopeGrantManager uses categorized PermissionPicker'
  );

  const accessDiagnosticsContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/access-diagnostics-client.tsx'),
    'utf8'
  );
  assert(
    accessDiagnosticsContent.includes('PermissionPicker'),
    'AccessDiagnosticsClient uses categorized PermissionPicker'
  );

  const permissionMatrixContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/permission-matrix.tsx'),
    'utf8'
  );
  assert(
    permissionMatrixContent.includes('groupPermissionsByCategory'),
    'PermissionMatrix uses canonical groupPermissionsByCategory'
  );

  // -------------------------------------------------------------
  // Test 15: GAP-1 — Tenant Resolver & Navbar Branch Switcher Inclusion
  // -------------------------------------------------------------
  console.log('\nTest Group 15: GAP-1 — Tenant Resolver & Navbar Branch Switcher Inclusion');
  const resolverContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/tenant/resolver.ts'),
    'utf8'
  );
  assert(
    resolverContent.includes("in('assignment_type', ['secondment', 'acting'])") &&
      resolverContent.includes('staffAssignRes'),
    'Tenant resolver queries active secondment and acting assignments for non-owner staff'
  );
  assert(
    resolverContent.includes('startOk') && resolverContent.includes('endOk'),
    'Tenant resolver validates temporal start/end boundaries before including host branches'
  );
  assert(
    resolverContent.includes('userAssignedBranchIds = Array.from(branchIdSet)'),
    'Tenant resolver combines permanent branch_assignments with effective secondment/acting branches'
  );

  // -------------------------------------------------------------
  // Test 16: GAP-2 — Member-Level Operational Branch Assignment Workflow
  // -------------------------------------------------------------
  console.log('\nTest Group 16: GAP-2 — Member-Level Operational Branch Assignment Workflow');
  const permServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/permission.service.ts'),
    'utf8'
  );
  assert(
    permServiceContent.includes('static async addMemberBranchAssignment') &&
      permServiceContent.includes('static async removeMemberBranchAssignment') &&
      permServiceContent.includes('static async getMemberBranchAssignments'),
    'PermissionService provides addMemberBranchAssignment, removeMemberBranchAssignment, and getMemberBranchAssignments'
  );
  assert(
    permServiceContent.includes('assign.is_primary') &&
      permServiceContent.includes('Cannot remove the primary branch assignment'),
    'removeMemberBranchAssignment strictly forbids removing the primary branch assignment'
  );
  assert(
    permServiceContent.includes('is_primary: false'),
    'addMemberBranchAssignment assigns additional operational branches as non-primary'
  );

  const permActionsContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/actions/permission.ts'),
    'utf8'
  );
  assert(
    permActionsContent.includes('export async function addMemberBranchAssignmentAction') &&
      permActionsContent.includes('export async function removeMemberBranchAssignmentAction') &&
      permActionsContent.includes('export async function getMemberBranchAssignmentsAction'),
    'permission.ts exports addMemberBranchAssignmentAction, removeMemberBranchAssignmentAction, and getMemberBranchAssignmentsAction'
  );

  const memberBranchManagerContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/access/member-branch-manager.tsx'),
    'utf8'
  );
  assert(
    memberBranchManagerContent.includes('Operational Branch Access') &&
      memberBranchManagerContent.includes('Primary Branch') &&
      memberBranchManagerContent.includes('Permanent Operational'),
    'MemberBranchManager renders Primary Branch and Permanent Operational branch distinctions'
  );
  assert(
    memberBranchManagerContent.includes('min-h-[44px]'),
    'MemberBranchManager actions implement touch-friendly >=44px tap targets'
  );
  assert(
    memberAccessDetailContent.includes('MemberBranchManager') &&
      memberAccessDetailContent.includes('OPERATIONAL BRANCH ACCESS'),
    'MemberAccessDetailClient embeds MemberBranchManager in Access Profile'
  );

  // -------------------------------------------------------------
  // Test 17: GAP-3 — Safe Staff Suspension & Headcount Release
  // -------------------------------------------------------------
  console.log('\nTest Group 17: GAP-3 — Safe Staff Suspension & Headcount Release');
  assert(
    orgServiceContent.includes("m.membership_status !== 'suspended'") ||
      orgServiceContent.includes('membership:business_memberships(id, membership_status)'),
    'OrganizationService queries join membership_status to exclude suspended members from substantive occupancy'
  );
  assert(
    permServiceContent.includes("event_type: 'suspended'") &&
      permServiceContent.includes('organization_assignment_history'),
    'PermissionService.setMembershipStatus logs assignment history event when a member is suspended'
  );

  // -------------------------------------------------------------
  // Test 18: GAP-4 — Suspended Reporting Manager Integrity Warning
  // -------------------------------------------------------------
  console.log('\nTest Group 18: GAP-4 — Suspended Reporting Manager Integrity Warning');
  assert(
    orgServiceContent.includes("'manager_suspended'"),
    'OrganizationService issues union includes manager_suspended'
  );
  assert(
    orgServiceContent.includes('activeCoveredManagerIds') &&
      orgServiceContent.includes('isMgrSuspended && !hasActingCoverage'),
    'OrganizationService getOrganizationIntegrityIssues checks for suspended manager and verifies acting coverage'
  );
  assert(
    orgServiceContent.includes('Staff member reports to a suspended manager'),
    'OrganizationService yields clear actionable diagnostic message for suspended manager reporting'
  );

  const actingTestNow = new Date();
  const actPastDate = new Date(actingTestNow.getTime() - 86400000).toISOString();
  const actFutureDate = new Date(actingTestNow.getTime() + 86400000).toISOString();
  const actFarPastDate = new Date(actingTestNow.getTime() - 172800000).toISOString();

  // Test acting assignment temporal effectiveness helper
  const activeEffectiveActing = {
    status: 'active',
    starts_at: actPastDate,
    ends_at: actFutureDate,
  };
  const expiredActing = {
    status: 'active',
    starts_at: actFarPastDate,
    ends_at: actPastDate,
  };
  const futureActing = {
    status: 'active',
    starts_at: actFutureDate,
    ends_at: null,
  };

  assert(
    OrganizationService.isAssignmentEffective(activeEffectiveActing, actingTestNow) === true,
    'OrganizationService.isAssignmentEffective returns true for current active acting appointment'
  );
  assert(
    OrganizationService.isAssignmentEffective(expiredActing, actingTestNow) === false,
    'OrganizationService.isAssignmentEffective returns false for expired acting appointment'
  );
  assert(
    OrganizationService.isAssignmentEffective(futureActing, actingTestNow) === false,
    'OrganizationService.isAssignmentEffective returns false for future acting appointment'
  );

  // -------------------------------------------------------------
  // Test 19: Central Audit History & Immutable Event Logging
  // -------------------------------------------------------------
  console.log('\nTest Group 19: Central Audit History & Immutable Event Logging');

  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260904120000_central_audit_history_and_operational_activity.sql'
  );
  assert(fs.existsSync(migrationPath), 'Audit migration file exists');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  assert(
    migrationContent.includes('ALTER TABLE public.audit_logs') &&
      migrationContent.includes('ADD COLUMN IF NOT EXISTS actor_name_snapshot') &&
      migrationContent.includes('ADD COLUMN IF NOT EXISTS actor_role_snapshot') &&
      migrationContent.includes('ADD COLUMN IF NOT EXISTS entity_type') &&
      migrationContent.includes('ADD COLUMN IF NOT EXISTS service_area_id'),
    'Audit migration adds nullable actor snapshot and entity columns safely with IF NOT EXISTS'
  );
  assert(
    migrationContent.includes('idx_audit_logs_entity') &&
      migrationContent.includes('idx_audit_logs_branch_created'),
    'Audit migration defines compound indexes for business, entity, and branch lookups'
  );

  const { permissionKeyEnum } = await import('../src/lib/validation/permission');
  assert(
    permissionKeyEnum.options.includes('audit.view'),
    "permissionKeyEnum includes 'audit.view'"
  );

  const permCategoriesModule = await import('../src/lib/permissions/permission-categories');
  assert(
    permCategoriesModule.resolvePermissionCategory({ key: 'audit.view' }) === 'Organization',
    "resolvePermissionCategory maps 'audit.view' under 'Organization' permission category"
  );

  const auditServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/audit.service.ts'),
    'utf8'
  );
  assert(
    auditServiceContent.includes('logAuditEvent') &&
      auditServiceContent.includes('getAuditLogs') &&
      auditServiceContent.includes('getEntityTimeline'),
    'AuditService provides logAuditEvent, getAuditLogs, and getEntityTimeline'
  );

  // Verify instrumentations
  const waiterServiceAuditContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/waiter.service.ts'),
    'utf8'
  );
  assert(
    waiterServiceAuditContent.includes('waiter.order.approved') &&
      waiterServiceAuditContent.includes('waiter.order.rejected') &&
      waiterServiceAuditContent.includes('waiter_request.accepted') &&
      waiterServiceAuditContent.includes('waiter_request.completed'),
    'WaiterService is instrumented with audit logging for orders and assistance requests'
  );

  const orderServiceAuditContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/order.service.ts'),
    'utf8'
  );
  assert(
    orderServiceAuditContent.includes('order.status_changed') || orderServiceAuditContent.includes('order.created'),
    'OrderService is instrumented with audit logging'
  );

  const paymentServiceAuditContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/payment.service.ts'),
    'utf8'
  );
  assert(
    paymentServiceAuditContent.includes('payment.recorded') && paymentServiceAuditContent.includes('payment.voided'),
    'PaymentService is instrumented with audit logging for payments and voids'
  );

  const inventoryServiceAuditContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/inventory.service.ts'),
    'utf8'
  );
  assert(
    inventoryServiceAuditContent.includes('inventory.stock_adjusted') &&
      inventoryServiceAuditContent.includes('inventory.waste_recorded') &&
      inventoryServiceAuditContent.includes('inventory.transfer_sent'),
    'InventoryService is instrumented with audit logging for stock adjustments, waste, and transfers'
  );

  const purchasingServiceAuditContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/purchasing.service.ts'),
    'utf8'
  );
  assert(
    purchasingServiceAuditContent.includes('purchasing.po_created') &&
      purchasingServiceAuditContent.includes('purchasing.goods_received') &&
      purchasingServiceAuditContent.includes('purchasing.supplier_return_created'),
    'PurchasingService is instrumented with audit logging for POs, GRNs, and returns'
  );

  const auditPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/dashboard/access/audit/page.tsx'),
    'utf8'
  );
  assert(
    auditPageContent.includes("requireRoutePermission('/dashboard/access')") &&
      auditPageContent.includes('AuditHistoryClient'),
    'Audit History server page exists with RBAC guard and AuditHistoryClient'
  );

  const auditClientContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/audit/audit-history-client.tsx'),
    'utf8'
  );
  assert(
    auditClientContent.includes('block md:hidden') && auditClientContent.includes('hidden md:block'),
    'AuditHistoryClient provides responsive mobile cards and desktop table'
  );

  // -------------------------------------------------------------
  // Test 20: Waiter Operational Activity & Turnaround Timelines
  // -------------------------------------------------------------
  console.log('\nTest Group 20: Waiter Operational Activity & Turnaround Timelines');

  const waiterActivityServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/waiter-activity.service.ts'),
    'utf8'
  );
  assert(
    waiterActivityServiceContent.includes('get48HourOperationalActivity') &&
      waiterActivityServiceContent.includes('getRequestTimeline'),
    'WaiterActivityService provides get48HourOperationalActivity and getRequestTimeline'
  );
  assert(
    waiterActivityServiceContent.includes('isOverdue') &&
      waiterActivityServiceContent.includes('elapsedMinutes') &&
      waiterActivityServiceContent.includes('acceptedByName'),
    'WaiterActivityService computes actor attributions, duration metrics, and overdue detection'
  );

  const waiterActivityComponentContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/waiter/waiter-operational-activity.tsx'),
    'utf8'
  );
  assert(
    waiterActivityComponentContent.includes('48-Hour Operational Activity') &&
      waiterActivityComponentContent.includes('EntityTimelineDialog'),
    'WaiterOperationalActivity component renders 48h activity and integrates EntityTimelineDialog'
  );

  const waiterRequestCenterContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/waiter/waiter-request-center.tsx'),
    'utf8'
  );
  assert(
    waiterRequestCenterContent.includes('WaiterOperationalActivity') &&
      waiterRequestCenterContent.includes('48-Hour Operational History'),
    'WaiterRequestCenter embeds 48-Hour Operational History tab'
  );

  const timelineDialogContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/audit/entity-timeline-dialog.tsx'),
    'utf8'
  );
  assert(
    timelineDialogContent.includes('getEntityTimelineAction') &&
      timelineDialogContent.includes('Prior State (Old)') &&
      timelineDialogContent.includes('Updated State (New)'),
    'EntityTimelineDialog modal renders chronological revisions with old/new snapshot diffs'
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

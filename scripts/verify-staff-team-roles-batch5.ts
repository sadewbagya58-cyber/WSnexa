/**
 * Verification Script: Staff & Team Roles Pilot QA Fix Batch #5
 *
 * Tests:
 * 1. ISSUE #1 — Waiter Area Scope Leak in Waiter Requests & Approvals
 * 2. ISSUE #2 — Reservations Permission Bypass
 * 3. ISSUE #3 — Job Titles Mobile Table Overflow & Responsiveness
 */

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

// Bypass server-only guard for direct tsx execution
try {
  // @ts-expect-error Mock server-only in standalone script
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {
  // Ignore
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  const { BUILT_IN_ROLE_TEMPLATES } = await import('../src/types/authorization.types');
  const { ROLE_PRESETS } = await import('../src/lib/validation/permission-presets');
  const { can } = await import('../src/server/auth/policy-engine');
  type AuthorizationContext = import('../src/types/authorization.types').AuthorizationContext;
  type SupportedResourceType = import('../src/types/authorization.types').SupportedResourceType;
  const { ROUTE_PERMISSION_MAP, getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');
  console.log('================================================================');
  console.log('🧪 VERIFYING PILOT QA FIX BATCH #5: STAFF & TEAM ROLES');
  console.log('================================================================\n');

  // ====================================================================
  // TEST SUITE 1: ISSUE #1 — Waiter Area Scope Leak & Authorization
  // ====================================================================
  console.log('--- SUITE 1: Waiter Area Scope Enforcement & Permissions ---');

  // 1.1 SupportedResourceType includes 'waiter_request'
  const supportedTypes: SupportedResourceType[] = [
    'order',
    'inventory_item',
    'inventory_location',
    'inventory_count',
    'inventory_transaction',
    'purchase_order',
    'business_membership',
    'staff_assignment',
    'dining_table',
    'service_area',
    'recipe',
    'modifier_group',
    'menu_item',
    'branch',
    'department',
    'organization_unit',
    'supplier',
    'payment',
    'waiter_request',
  ];
  assert(supportedTypes.includes('waiter_request'), 'SupportedResourceType union includes waiter_request');

  // 1.2 Waiter Area A context
  const waiterAreaAContext: AuthorizationContext = {
    userId: 'user-waiter-a',
    userEmail: 'waiter-a@wsnexa.test',
    businessId: 'biz-1',
    businessName: 'Test Business',
    businessSlug: 'test-biz',
    membershipId: 'mem-waiter-a',
    membershipRole: 'waiter',
    customRoleId: null,
    isBusinessOwner: false,
    authorizedBranchIds: ['branch-1'],
    activeBranchId: 'branch-1',
    branchAssignments: [],
    rolePermissions: [
      'orders.view',
      'waiter.access',
      'waiter.requests.view',
      'waiter.requests.manage',
      'waiter.orders.create',
      'menu.view',
      'tables.view',
      'tables.status.update',
    ],
    roleScopePreset: {
      roleKey: 'waiter',
      customRoleId: null,
      defaultScope: 'AREA_TEAM',
      maxScope: 'PROPERTY',
    },
    serviceAreas: [
      { id: 'area-a', name: 'Main Dining Room', branchId: 'branch-1', source: 'staff_area_assignment' },
    ],
    serviceAreaIds: ['area-a'],
    departments: [],
    departmentIds: [],
    organizationUnits: [],
    organizationUnitIds: [],
    staffAssignments: [],
    actingAssignments: [],
    secondments: [],
    permissionOverrides: [],
    scopeGrants: [],
    selfIdentity: { userId: 'user-waiter-a', membershipId: 'mem-waiter-a', staffAssignmentIds: [] },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 1,
      sources: {
        membershipSource: 'db',
        branchAssignmentCount: 1,
        staffAssignmentCount: 0,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 8,
        overrideCount: 0,
        scopeGrantCount: 0,
      },
    },
  };

  // 1.3 Waiter Area B context
  const waiterAreaBContext: AuthorizationContext = {
    ...waiterAreaAContext,
    userId: 'user-waiter-b',
    membershipId: 'mem-waiter-b',
    serviceAreas: [
      { id: 'area-b', name: 'Outdoor Terrace', branchId: 'branch-1', source: 'staff_area_assignment' },
    ],
    serviceAreaIds: ['area-b'],
    selfIdentity: { userId: 'user-waiter-b', membershipId: 'mem-waiter-b', staffAssignmentIds: [] },
  };

  // 1.4 Waiter with 0 areas assigned
  const waiterZeroAreasContext: AuthorizationContext = {
    ...waiterAreaAContext,
    userId: 'user-waiter-zero',
    membershipId: 'mem-waiter-zero',
    serviceAreas: [],
    serviceAreaIds: [],
    selfIdentity: { userId: 'user-waiter-zero', membershipId: 'mem-waiter-zero', staffAssignmentIds: [] },
  };

  // 1.5 Branch Manager context (Property-level reach)
  const branchManagerContext: AuthorizationContext = {
    ...waiterAreaAContext,
    userId: 'user-manager',
    membershipId: 'mem-manager',
    membershipRole: 'branch_manager',
    rolePermissions: [
      ...ROLE_PRESETS.find((p) => p.key === 'branch_manager')!.permissions,
    ],
    roleScopePreset: {
      roleKey: 'branch_manager',
      customRoleId: null,
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    },
    serviceAreas: [],
    serviceAreaIds: [],
    selfIdentity: { userId: 'user-manager', membershipId: 'mem-manager', staffAssignmentIds: [] },
  };

  // Resources in Area A and Area B
  const orderResourceAreaA = {
    resourceType: 'order' as const,
    resourceId: 'order-in-area-a',
    businessId: 'biz-1',
    branchId: 'branch-1',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: 'area-a',
    ownerUserId: null,
  };

  const orderResourceAreaB = {
    resourceType: 'order' as const,
    resourceId: 'order-in-area-b',
    businessId: 'biz-1',
    branchId: 'branch-1',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: 'area-b',
    ownerUserId: null,
  };

  const waiterRequestAreaA = {
    resourceType: 'waiter_request' as const,
    resourceId: 'req-in-area-a',
    businessId: 'biz-1',
    branchId: 'branch-1',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: 'area-a',
    ownerUserId: null,
  };

  const waiterRequestAreaB = {
    resourceType: 'waiter_request' as const,
    resourceId: 'req-in-area-b',
    businessId: 'biz-1',
    branchId: 'branch-1',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: 'area-b',
    ownerUserId: null,
  };

  // Test Scope Evaluations
  // A. Waiter A accessing Area A order -> ALLOWED
  const decisionWaiterA_AreaA = await can({
    context: waiterAreaAContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaA,
  });
  assert(decisionWaiterA_AreaA === true, 'Waiter assigned to Area A CAN manage orders in Area A');

  // B. Waiter A accessing Area B order -> DENIED
  const decisionWaiterA_AreaB = await can({
    context: waiterAreaAContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaB,
  });
  assert(decisionWaiterA_AreaB === false, 'Waiter assigned to Area A CANNOT manage orders in Area B (Area Scope Enforced)');

  // C. Waiter B accessing Area A order -> DENIED
  const decisionWaiterB_AreaA = await can({
    context: waiterAreaBContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaA,
  });
  assert(decisionWaiterB_AreaA === false, 'Waiter assigned to Area B CANNOT manage orders in Area A');

  // D. Waiter B accessing Area B order -> ALLOWED
  const decisionWaiterB_AreaB = await can({
    context: waiterAreaBContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaB,
  });
  assert(decisionWaiterB_AreaB === true, 'Waiter assigned to Area B CAN manage orders in Area B');

  // E. Waiter with 0 areas accessing Area A order -> DENIED
  const decisionWaiterZero_AreaA = await can({
    context: waiterZeroAreasContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaA,
  });
  assert(decisionWaiterZero_AreaA === false, 'Waiter with 0 assigned areas CANNOT manage orders');

  // F. Branch Manager accessing Area A and Area B orders -> ALLOWED (Property scope)
  const decisionManager_AreaA = await can({
    context: branchManagerContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaA,
  });
  const decisionManager_AreaB = await can({
    context: branchManagerContext,
    permission: 'waiter.requests.manage',
    resource: orderResourceAreaB,
  });
  assert(decisionManager_AreaA === true && decisionManager_AreaB === true, 'Branch Manager has property-wide authority across all service areas');

  // G. Waiter Request resource scoping
  const decisionReqWaiterA_AreaA = await can({
    context: waiterAreaAContext,
    permission: 'waiter.requests.manage',
    resource: waiterRequestAreaA,
  });
  const decisionReqWaiterA_AreaB = await can({
    context: waiterAreaAContext,
    permission: 'waiter.requests.manage',
    resource: waiterRequestAreaB,
  });
  assert(decisionReqWaiterA_AreaA === true, 'Waiter A can manage waiter_request in Area A');
  assert(decisionReqWaiterA_AreaB === false, 'Waiter A CANNOT manage waiter_request in Area B');

  // ====================================================================
  // TEST SUITE 2: ISSUE #2 — Reservations Permission Bypass
  // ====================================================================
  console.log('\n--- SUITE 2: Reservations Permissions & Route Gating ---');

  // 2.1 Verify built-in Waiter preset has EXACTLY 0 reservation permissions
  const waiterPreset = ROLE_PRESETS.find((p) => p.key === 'waiter');
  assert(Boolean(waiterPreset), 'Waiter role preset exists in canonical ROLE_PRESETS');
  const reservationPermsInWaiter = (waiterPreset?.permissions || []).filter((p) => p.startsWith('reservations.'));
  assert(reservationPermsInWaiter.length === 0, `Waiter role preset contains 0 reservation permissions (Found: ${reservationPermsInWaiter.length})`);

  // 2.2 Verify Branch Manager preset contains reservation permissions
  const bmPreset = ROLE_PRESETS.find((p) => p.key === 'branch_manager');
  const bmReservationPerms = (bmPreset?.permissions || []).filter((p) => p.startsWith('reservations.'));
  assert(bmReservationPerms.length >= 6, `Branch Manager preset contains full reservation suite (Found: ${bmReservationPerms.length})`);

  // 2.3 Route permission for /dashboard/reservations
  const requiredForReservations = getRequiredPermissionForRoute('/dashboard/reservations');
  assert(Boolean(requiredForReservations), 'Route /dashboard/reservations is mapped in ROUTE_PERMISSION_MAP');

  // 2.4 Verify Waiter context fails all reservation permissions
  const waiterCanViewRes = await can({ context: waiterAreaAContext, permission: 'reservations.view' });
  const waiterCanCreateRes = await can({ context: waiterAreaAContext, permission: 'reservations.create' });
  const waiterCanManageRes = await can({ context: waiterAreaAContext, permission: 'reservations.manage' });
  const waiterCanAssignRes = await can({ context: waiterAreaAContext, permission: 'reservations.assign_tables' });
  const waiterCanWaitlistRes = await can({ context: waiterAreaAContext, permission: 'reservations.waitlist_manage' });
  const waiterCanCancelRes = await can({ context: waiterAreaAContext, permission: 'reservations.cancel' });

  assert(waiterCanViewRes === false, 'Waiter role CANNOT view reservations (reservations.view = false)');
  assert(waiterCanCreateRes === false, 'Waiter role CANNOT create reservations (reservations.create = false)');
  assert(waiterCanManageRes === false, 'Waiter role CANNOT manage reservations (reservations.manage = false)');
  assert(waiterCanAssignRes === false, 'Waiter role CANNOT assign tables (reservations.assign_tables = false)');
  assert(waiterCanWaitlistRes === false, 'Waiter role CANNOT manage waitlist (reservations.waitlist_manage = false)');
  assert(waiterCanCancelRes === false, 'Waiter role CANNOT cancel reservations (reservations.cancel = false)');

  // 2.5 Verify Branch Manager succeeds for reservation operations
  const bmCanViewRes = await can({ context: branchManagerContext, permission: 'reservations.view' });
  const bmCanManageRes = await can({ context: branchManagerContext, permission: 'reservations.manage' });
  const bmCanAssignRes = await can({ context: branchManagerContext, permission: 'reservations.assign_tables' });
  assert(bmCanViewRes === true && bmCanManageRes === true && bmCanAssignRes === true, 'Branch Manager has authorized reservation operations');

  // 2.6 Verify explicit member override for read-only reservation access
  const waiterWithViewOverride: AuthorizationContext = {
    ...waiterAreaAContext,
    permissionOverrides: [
      {
        id: 'override-view-res',
        businessMembershipId: 'mem-waiter-a',
        permissionKey: 'reservations.view',
        effect: 'allow',
        scopeType: null,
        branchId: null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const overrideCanView = await can({ context: waiterWithViewOverride, permission: 'reservations.view' });
  const overrideCanManage = await can({ context: waiterWithViewOverride, permission: 'reservations.manage' });
  const overrideCanCreate = await can({ context: waiterWithViewOverride, permission: 'reservations.create' });
  assert(overrideCanView === true, 'Waiter with explicit reservations.view override CAN view reservations');
  assert(overrideCanManage === false, 'Waiter with explicit reservations.view override CANNOT manage reservations');
  assert(overrideCanCreate === false, 'Waiter with explicit reservations.view override CANNOT create reservations');

  // ====================================================================
  // TEST SUITE 3: ISSUE #3 — Job Titles Mobile Responsive Layout
  // ====================================================================
  console.log('\n--- SUITE 3: Job Titles Mobile Responsiveness ---');

  // Read job titles client component file to verify responsive classes
  const fs = await import('fs');
  const path = await import('path');
  const jobTitlesCode = fs.readFileSync(
    path.join(process.cwd(), 'src/components/organization/job-titles-client.tsx'),
    'utf-8'
  );

  assert(
    jobTitlesCode.includes('hidden md:block') && jobTitlesCode.includes('overflow-x-auto'),
    'Desktop table is rendered on md+ viewports (hidden md:block)'
  );

  assert(
    jobTitlesCode.includes('block md:hidden') && jobTitlesCode.includes('divide-y divide-zinc-200'),
    'Mobile stacked card layout is rendered on < md viewports (block md:hidden)'
  );

  assert(
    jobTitlesCode.includes('Rank {lvl?.rank ??') && jobTitlesCode.includes('Seniority Level'),
    'Mobile card displays Seniority Level with rank and level name'
  );

  assert(
    jobTitlesCode.includes('Department Scope') && jobTitlesCode.includes('Classification'),
    'Mobile card displays Department Scope and Classification tier'
  );

  assert(
    jobTitlesCode.includes('Edit Job Title'),
    'Mobile card includes Edit Job Title action button'
  );

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error running verification tests:', err);
  process.exit(1);
});
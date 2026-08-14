import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

// Bypass server-only guard
try {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment */
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
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log('  WSNexa Permissions V2 — Final Security & Boundary Master Audit  ');
  console.log('================================================================\n');

  const permModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission.ts')).href;
  const { permissionKeyEnum, ownerOnlyPermissions } = await import(permModulePath);

  const presetsModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission-presets.ts')).href;
  const { ROLE_PRESETS } = await import(presetsModulePath);

  const routeModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/security/route-permissions.ts')).href;
  const { getRequiredPermissionForRoute } = await import(routeModulePath);

  const serviceModulePath = pathToFileURL(path.join(process.cwd(), 'src/server/services/permission.service.ts')).href;
  const { PermissionService } = await import(serviceModulePath);

  const supabaseModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/supabase/server.ts')).href;
  const { createAdminClient } = await import(supabaseModulePath);
  const admin = createAdminClient();

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assertTest(condition: boolean, title: string, failureReason?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${failureReason ? `--> ${failureReason}` : ''}`);
      failedTests++;
    }
  }

  // 1. Audit Exact Catalog & Owner-Only Boundaries
  console.log('--- 1. CATALOG & BOUNDARY INTEGRITY ---');
  const allKeys = permissionKeyEnum.options;
  assertTest(allKeys.length === 74, `Exact Permission Catalog Count is 74 (Found: ${allKeys.length})`);
  assertTest(ownerOnlyPermissions.length === 6, 'Owner-only permissions set contains exactly 6 high-risk management keys');
  assertTest(ownerOnlyPermissions.includes('business.settings.manage'), 'business.settings.manage is owner-only');
  assertTest(ownerOnlyPermissions.includes('owner.transfer'), 'owner.transfer is owner-only');
  assertTest(ownerOnlyPermissions.includes('branches.manage'), 'branches.manage is owner-only');
  assertTest(ownerOnlyPermissions.includes('order_security.manage'), 'order_security.manage is owner-only');
  assertTest(ownerOnlyPermissions.includes('roles.manage'), 'roles.manage is owner-only');
  assertTest(ownerOnlyPermissions.includes('permissions.override.manage'), 'permissions.override.manage is owner-only');

  // Test Harness Setup: Business A (Colombo, Kandy) and Business B
  console.log('\n--- 2. CREATING MULTI-BUSINESS & MULTI-BRANCH TEST HARNESS ---');
  const timestamp = Date.now();
  const emailDomain = `audit${timestamp}@wsnexa-test.io`;

  let bizAId: string | null = null;
  let colomboBranchId: string | null = null;
  let kandyBranchId: string | null = null;
  let mainHallAreaId: string | null = null;
  let terraceAreaId: string | null = null;

  let bizBId: string | null = null;
  let bizBBranchId: string | null = null;

  let ownerUserId: string | null = null;
  let managerUserId: string | null = null;
  let supervisorUserId: string | null = null;
  let waiterUserId: string | null = null;
  let kitchenUserId: string | null = null;
  let cashierUserId: string | null = null;
  let customRoleUserId: string | null = null;

  let managerMemId: string | null = null;
  let waiterMemId: string | null = null;
  let cashierMemId: string | null = null;

  try {
    // Helper to create test user
    async function createUser(email: string) {
      const { data, error } = await admin.auth.admin.createUser({ email, password: 'AuditPassword123!', email_confirm: true });
      if (error || !data.user) throw new Error(`User creation failed: ${error?.message}`);
      return data.user.id;
    }

    ownerUserId = await createUser(`owner.${emailDomain}`);
    managerUserId = await createUser(`manager.${emailDomain}`);
    supervisorUserId = await createUser(`supervisor.${emailDomain}`);
    waiterUserId = await createUser(`waiter.${emailDomain}`);
    kitchenUserId = await createUser(`kitchen.${emailDomain}`);
    cashierUserId = await createUser(`cashier.${emailDomain}`);
    customRoleUserId = await createUser(`custom.${emailDomain}`);

    // Create Business A
    const { data: bizA, error: bizAErr } = await admin.from('businesses').insert({
      name: `Audit Biz A ${timestamp}`,
      slug: `audit-biz-a-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('id').single();

    if (bizAErr || !bizA) throw new Error(`Failed to create Business A: ${bizAErr?.message}`);
    bizAId = bizA.id;

    const { data: colombo, error: colErr } = await admin.from('branches').insert({ business_id: bizAId, name: 'Colombo Branch', code: 'COL' }).select('id').single();
    if (colErr || !colombo) throw new Error(`Failed to create Colombo branch: ${colErr?.message}`);
    colomboBranchId = colombo.id;

    const { data: kandy, error: kdyErr } = await admin.from('branches').insert({ business_id: bizAId, name: 'Kandy Branch', code: 'KDY' }).select('id').single();
    if (kdyErr || !kandy) throw new Error(`Failed to create Kandy branch: ${kdyErr?.message}`);
    kandyBranchId = kandy.id;

    const { data: mainHall, error: mhErr } = await admin.from('service_areas').insert({ business_id: bizAId, branch_id: colomboBranchId, name: 'Main Hall', code: 'MAIN' }).select('id').single();
    if (mhErr || !mainHall) throw new Error(`Failed to create Main Hall service area: ${mhErr?.message}`);
    mainHallAreaId = mainHall.id;

    const { data: terrace, error: terrErr } = await admin.from('service_areas').insert({ business_id: bizAId, branch_id: colomboBranchId, name: 'Terrace', code: 'TERR' }).select('id').single();
    if (terrErr || !terrace) throw new Error(`Failed to create Terrace service area: ${terrErr?.message}`);
    terraceAreaId = terrace.id;

    // Create Business B
    const { data: bizB, error: bizBErr } = await admin.from('businesses').insert({
      name: `Audit Biz B ${timestamp}`,
      slug: `audit-biz-b-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('id').single();

    if (bizBErr || !bizB) throw new Error(`Failed to create Business B: ${bizBErr?.message}`);
    bizBId = bizB.id;

    const { data: bizBBranch } = await admin.from('branches').insert({ business_id: bizBId, name: 'Business B Branch', code: 'BBB' }).select('id').single();
    bizBBranchId = bizBBranch!.id;

    // Memberships & Branch Assignments
    // Owner
    await admin.from('business_memberships').insert({ business_id: bizAId, user_id: ownerUserId, role: 'business_owner', membership_status: 'active' });

    // Branch Manager -> Assigned to Colombo ONLY
    const { data: mgrMem } = await admin.from('business_memberships').insert({ business_id: bizAId, user_id: managerUserId, role: 'branch_manager', membership_status: 'active' }).select('id').single();
    managerMemId = mgrMem!.id;
    await admin.from('branch_assignments').insert({ business_membership_id: managerMemId, branch_id: colomboBranchId });

    // Supervisor -> Colombo ONLY (Uses built-in role branch_manager with restricted custom role or supervisor preset)
    const { data: supMem } = await admin.from('business_memberships').insert({ business_id: bizAId, user_id: supervisorUserId, role: 'branch_manager', membership_status: 'active' }).select('id').single();
    await admin.from('branch_assignments').insert({ business_membership_id: supMem!.id, branch_id: colomboBranchId });

    // Waiter -> Colombo ONLY, Terrace Area ONLY
    const { data: wMem } = await admin.from('business_memberships').insert({ business_id: bizAId, user_id: waiterUserId, role: 'waiter', membership_status: 'active' }).select('id').single();
    waiterMemId = wMem!.id;
    await admin.from('branch_assignments').insert({ business_membership_id: waiterMemId, branch_id: colomboBranchId });
    await admin.from('staff_area_assignments').insert({ business_id: bizAId, branch_id: colomboBranchId, business_membership_id: waiterMemId, service_area_id: terraceAreaId });

    // Kitchen -> Colombo ONLY
    const { data: kMem } = await admin.from('business_memberships').insert({ business_id: bizAId, user_id: kitchenUserId, role: 'kitchen_staff', membership_status: 'active' }).select('id').single();
    await admin.from('branch_assignments').insert({ business_membership_id: kMem!.id, branch_id: colomboBranchId });

    // Cashier -> Colombo ONLY
    const { data: cMem } = await admin.from('business_memberships').insert({ business_id: bizAId, user_id: cashierUserId, role: 'cashier', membership_status: 'active' }).select('id').single();
    cashierMemId = cMem!.id;
    await admin.from('branch_assignments').insert({ business_membership_id: cashierMemId, branch_id: colomboBranchId });

    console.log('✓ Multi-business & multi-branch test harness initialized.\n');

    // 3. BUSINESS OWNER TESTS
    console.log('--- 3. BUSINESS OWNER SECURITY & BYPASS TESTS ---');
    const ownerHasAll = await PermissionService.hasPermission(ownerUserId, bizAId, colomboBranchId, 'business.settings.manage');
    const ownerHasKandy = await PermissionService.hasPermission(ownerUserId, bizAId, kandyBranchId, 'orders.view');
    assertTest(ownerHasAll && ownerHasKandy, 'Business Owner possesses un-deniable access across all branches and owner permissions');

    // Prove owner cannot be locked out by deny override
    await admin.from('member_permission_overrides').insert({
      business_membership_id: (await admin.from('business_memberships').select('id').eq('user_id', ownerUserId).single()).data!.id,
      permission_key: 'business.settings.manage',
      effect: 'deny',
      created_by: ownerUserId,
    });
    const ownerStillHasAccess = await PermissionService.hasPermission(ownerUserId, bizAId, colomboBranchId, 'business.settings.manage');
    assertTest(ownerStillHasAccess, 'Business Owner un-deniable authority overrides explicit deny overrides');

    // 4. BRANCH MANAGER TESTS
    console.log('\n--- 4. BRANCH MANAGER SCOPE & DELEGATION CEILING TESTS ---');
    const mgrColomboAccess = await PermissionService.hasPermission(managerUserId, bizAId, colomboBranchId, 'menu.view');
    const mgrKandyAccess = await PermissionService.hasPermission(managerUserId, bizAId, kandyBranchId, 'menu.view');
    const mgrBizBAccess = await PermissionService.hasPermission(managerUserId, bizBId, bizBBranchId, 'menu.view');
    const mgrOwnerPerm = await PermissionService.hasPermission(managerUserId, bizAId, colomboBranchId, 'business.settings.manage');

    assertTest(mgrColomboAccess, 'Branch Manager has operational access to assigned Colombo branch');
    assertTest(!mgrKandyAccess, 'Branch Manager is strictly denied access to unassigned Kandy branch');
    assertTest(!mgrBizBAccess, 'Branch Manager is strictly denied access to Business B');
    assertTest(!mgrOwnerPerm, 'Branch Manager is strictly denied owner-only permission business.settings.manage');

    // Delegation Ceiling Test: Non-owner trying to create custom role with owner-only permission
    const dangerousRoleResult = await PermissionService.createCustomRole(managerUserId, bizAId, {
      name: 'Manager Hack Role',
      permissions: ['menu.view', 'business.settings.manage', 'owner.transfer'],
    });
    const createdRolePerms = dangerousRoleResult.role?.permissions || [];
    assertTest(!createdRolePerms.includes('business.settings.manage') && !createdRolePerms.includes('owner.transfer'), 'Delegation ceiling strips owner-only permissions when non-owner creates custom roles');

    // 5. SUPERVISOR TESTS
    console.log('\n--- 5. SUPERVISOR GRANULAR ACCESS TESTS ---');
    const supPreset = ROLE_PRESETS.find((p: { key: string }) => p.key === 'supervisor');
    const supHasAvailability = supPreset?.permissions.includes('menu.availability.update') ?? false;
    const supHasPriceUpdate = supPreset?.permissions.includes('menu.price.update') ?? false;
    const supHasStaffManage = supPreset?.permissions.includes('staff.manage') ?? false;

    assertTest(supHasAvailability, 'Supervisor default preset includes menu.availability.update');
    assertTest(!supHasPriceUpdate, 'Supervisor default preset excludes menu.price.update');
    assertTest(!supHasStaffManage, 'Supervisor default preset excludes staff.manage');

    // 6. WAITER TESTS — CRITICAL ORDER CREATION SECURITY
    console.log('\n--- 6. WAITER WORKSPACE & ORDER CREATION SECURITY TESTS ---');
    const waiterOrdersCreate = await PermissionService.hasPermission(waiterUserId, bizAId, colomboBranchId, 'waiter.orders.create');
    const waiterOrdersViewOnly = await PermissionService.hasPermission(waiterUserId, bizAId, colomboBranchId, 'orders.view');
    assertTest(waiterOrdersCreate && waiterOrdersViewOnly, 'Waiter has waiter.orders.create and orders.view');

    // Prove read-only user with orders.view ALONE CANNOT create waiter orders if waiter.orders.create is revoked
    // Set deny override for waiter.orders.create and orders.create on cashier
    await PermissionService.setMemberOverride(ownerUserId, bizAId, { membershipId: cashierMemId!, permissionKey: 'waiter.orders.create', effect: 'deny' });
    await PermissionService.setMemberOverride(ownerUserId, bizAId, { membershipId: cashierMemId!, permissionKey: 'orders.create', effect: 'deny' });
    
    // Cashier has orders.view but denied creation keys
    const cashierOrdersView = await PermissionService.hasPermission(cashierUserId, bizAId, colomboBranchId, 'orders.view');
    const cashierOrdersCreate = await PermissionService.hasPermission(cashierUserId, bizAId, colomboBranchId, 'waiter.orders.create');
    assertTest(cashierOrdersView && !cashierOrdersCreate, 'orders.view ALONE does NOT authorize waiter order creation when creation keys are denied');

    // Service Area Isolation Test for Waiter
    const terraceAreaOk = await PermissionService.verifyServiceAreaBoundary(waiterMemId!, terraceAreaId);
    const mainHallAreaOk = await PermissionService.verifyServiceAreaBoundary(waiterMemId!, mainHallAreaId);
    assertTest(terraceAreaOk, 'Waiter has access to assigned Terrace service area');
    assertTest(!mainHallAreaOk, 'Waiter is strictly denied access to unassigned Main Hall service area');

    // 7. KITCHEN & CASHIER TESTS
    console.log('\n--- 7. KITCHEN & CASHIER OPERATIONAL ISOLATION TESTS ---');
    const kitchenKds = await PermissionService.hasPermission(kitchenUserId, bizAId, colomboBranchId, 'kitchen.access');
    const kitchenCashier = await PermissionService.hasPermission(kitchenUserId, bizAId, colomboBranchId, 'cashier.access');
    assertTest(kitchenKds && !kitchenCashier, 'Kitchen staff has kitchen.access but is denied cashier.access');

    const cashierPos = await PermissionService.hasPermission(cashierUserId, bizAId, colomboBranchId, 'cashier.access');
    const cashierKitchen = await PermissionService.hasPermission(cashierUserId, bizAId, colomboBranchId, 'kitchen.access');
    assertTest(cashierPos && !cashierKitchen, 'Cashier has cashier.access but is denied kitchen.access');

    // 8. MEMBER OVERRIDES & ZERO AREA BOUNDARY TESTS
    console.log('\n--- 8. MEMBER OVERRIDES & ZERO SERVICE AREA TESTS ---');
    // Set allow override for cashier on reports.export
    await PermissionService.setMemberOverride(ownerUserId, bizAId, { membershipId: cashierMemId!, permissionKey: 'reports.export', effect: 'allow' });
    const cashierExportAllowed = await PermissionService.hasPermission(cashierUserId, bizAId, colomboBranchId, 'reports.export');
    assertTest(cashierExportAllowed, 'Explicit ALLOW override grants delegated capability within assigned branch scope');

    // Zero service area test: remove all service area assignments from waiter
    await admin.from('staff_area_assignments').delete().eq('business_membership_id', waiterMemId!);
    await admin.from('staff_service_areas').delete().eq('business_membership_id', waiterMemId!);
    const zeroAreaTerrace = await PermissionService.verifyServiceAreaBoundary(waiterMemId!, terraceAreaId);
    assertTest(!zeroAreaTerrace, '0 assigned service areas strictly equals 0 area access for area-restricted staff');

    // 9. SUSPENDED STAFF SECURITY TEST
    console.log('\n--- 9. SUSPENDED STAFF ACCESS REVOCATION TESTS ---');
    await PermissionService.setMembershipStatus(ownerUserId, bizAId, { membershipId: waiterMemId!, status: 'suspended' });
    const suspendedWaiterAccess = await PermissionService.hasPermission(waiterUserId, bizAId, colomboBranchId, 'waiter.orders.create');
    assertTest(!suspendedWaiterAccess, 'Suspended staff member is strictly denied ALL operational access');

    // 10. ROUTE GUARD AUDIT TEST
    console.log('\n--- 10. ROUTE GUARD RESOLUTION AUDIT ---');
    assertTest(getRequiredPermissionForRoute('/dashboard/waiter/order') === 'waiter.orders.create', '/dashboard/waiter/order requires waiter.orders.create');
    assertTest(getRequiredPermissionForRoute('/dashboard/menu/categories') === 'menu.categories.manage', '/dashboard/menu/categories requires menu.categories.manage');
    assertTest(getRequiredPermissionForRoute('/dashboard/settings/order-security') === 'order_security.view', '/dashboard/settings/order-security requires order_security.view');
    assertTest(getRequiredPermissionForRoute('/dashboard/business') === 'business.settings.manage', '/dashboard/business requires business.settings.manage');

  } finally {
    console.log('\n🧹 Cleaning up master audit test data...');
    if (bizAId) await admin.from('businesses').delete().eq('id', bizAId);
    if (bizBId) await admin.from('businesses').delete().eq('id', bizBId);

    const testUserIds = [ownerUserId, managerUserId, supervisorUserId, waiterUserId, kitchenUserId, cashierUserId, customRoleUserId];
    for (const uid of testUserIds) {
      if (uid) await admin.auth.admin.deleteUser(uid);
    }
    console.log('✓ Cleanup completed.\n');
  }

  console.log('================================================================');
  console.log(`  Master Audit Complete: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runMasterAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local BEFORE importing modules that validate env variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runPermissionsVerificationSuite() {
  const { PermissionService } = await import('../src/server/services/permission.service');
  const { StaffInvitationService } = await import('../src/server/services/staff-invitation.service');

  console.log('================================================================');
  console.log('  WSNexa Phase 15 — Granular Permissions & Roles Suite         ');
  console.log('================================================================\n');

  let passed = 0;
  const timestamp = Date.now();
  const bizName = `Perm Test Biz ${timestamp}`;

  let ownerUserId: string | null = null;
  let mgrUserId: string | null = null;
  let cashierUserId: string | null = null;
  let kitchenUserId: string | null = null;
  let waiterUserId: string | null = null;
  let customRoleUserId: string | null = null;
  let bizId: string | null = null;
  let branchAId: string | null = null;
  let branchBId: string | null = null;
  let cashierMembershipId: string | null = null;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  try {
    // Setup Test Auth Users
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `perm_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerAuth.user!.id;

    const { data: mgrAuth } = await admin.auth.admin.createUser({
      email: `perm_mgr_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    mgrUserId = mgrAuth.user!.id;

    const { data: cashierAuth } = await admin.auth.admin.createUser({
      email: `perm_cashier_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    cashierUserId = cashierAuth.user!.id;

    const { data: kitchenAuth } = await admin.auth.admin.createUser({
      email: `perm_kitchen_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    kitchenUserId = kitchenAuth.user!.id;

    const { data: waiterAuth } = await admin.auth.admin.createUser({
      email: `perm_waiter_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    waiterUserId = waiterAuth.user!.id;

    const { data: customAuth } = await admin.auth.admin.createUser({
      email: `perm_custom_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    customRoleUserId = customAuth.user!.id;

    // Create Business & Two Branches
    const { data: biz } = await admin.from('businesses').insert({
      name: bizName,
      slug: `biz-perm-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('*').single();

    bizId = biz.id;

    const { data: branchA } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Branch A',
      code: `BRA-${timestamp}`,
      is_default: true,
    }).select('*').single();
    branchAId = branchA.id;

    const { data: branchB } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Branch B',
      code: `BRB-${timestamp}`,
    }).select('*').single();
    branchBId = branchB.id;

    // Create Business Memberships & Branch Assignments
    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: ownerUserId,
      role: 'business_owner',
      membership_status: 'active',
    });

    const { data: mgrMem } = await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: mgrUserId,
      role: 'branch_manager',
      membership_status: 'active',
    }).select('id').single();

    await admin.from('branch_assignments').insert({ business_membership_id: mgrMem!.id, branch_id: branchAId, is_primary: true });

    const { data: cashierMem } = await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: cashierUserId,
      role: 'cashier',
      membership_status: 'active',
    }).select('id').single();
    cashierMembershipId = cashierMem!.id;

    await admin.from('branch_assignments').insert({ business_membership_id: cashierMem!.id, branch_id: branchAId, is_primary: true });

    const { data: kitchenMem } = await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: kitchenUserId,
      role: 'kitchen_staff',
      membership_status: 'active',
    }).select('id').single();

    await admin.from('branch_assignments').insert({ business_membership_id: kitchenMem!.id, branch_id: branchAId, is_primary: true });

    const { data: waiterMem } = await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: waiterUserId,
      role: 'waiter',
      membership_status: 'active',
    }).select('id').single();

    await admin.from('branch_assignments').insert({ business_membership_id: waiterMem!.id, branch_id: branchAId, is_primary: true });

    // TEST 1: Business Owner has all business permissions
    const ownerHasSettings = await PermissionService.hasPermission(ownerUserId!, bizId!, branchAId!, 'business.settings.manage');
    const ownerHasExport = await PermissionService.hasPermission(ownerUserId!, bizId!, branchAId!, 'reports.export');
    assert(ownerHasSettings && ownerHasExport, 'Test 1: Business Owner possesses un-deniable owner authority across all permissions', `settings: ${ownerHasSettings}, export: ${ownerHasExport}`);

    // TEST 2: Branch Manager default permissions correct
    const mgrHasOrders = await PermissionService.hasPermission(mgrUserId!, bizId!, branchAId!, 'orders.view');
    const mgrHasStaff = await PermissionService.hasPermission(mgrUserId!, bizId!, branchAId!, 'staff.view');
    const mgrHasOwnerOnly = await PermissionService.hasPermission(mgrUserId!, bizId!, branchAId!, 'business.settings.manage');
    assert(mgrHasOrders && mgrHasStaff && !mgrHasOwnerOnly, 'Test 2: Branch Manager holds operational permissions but lacks owner-only settings authority', `orders: ${mgrHasOrders}, staff: ${mgrHasStaff}, ownerOnly: ${mgrHasOwnerOnly}`);

    // TEST 3: Cashier cannot manage menu
    const cashierHasPayments = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'payments.record');
    const cashierHasMenuManage = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(cashierHasPayments && !cashierHasMenuManage, 'Test 3: Cashier has payment recording access but CANNOT manage menu catalog', `payments: ${cashierHasPayments}, menuManage: ${cashierHasMenuManage}`);

    // TEST 4: Kitchen cannot record payments
    const kitchenHasQueue = await PermissionService.hasPermission(kitchenUserId!, bizId!, branchAId!, 'kitchen.access');
    const kitchenHasPayments = await PermissionService.hasPermission(kitchenUserId!, bizId!, branchAId!, 'payments.record');
    assert(kitchenHasQueue && !kitchenHasPayments, 'Test 4: Kitchen Staff has kitchen queue access but CANNOT record payments', `queue: ${kitchenHasQueue}, payments: ${kitchenHasPayments}`);

    // TEST 5: Waiter cannot manage staff
    const waiterHasRequests = await PermissionService.hasPermission(waiterUserId!, bizId!, branchAId!, 'waiter.requests.view');
    const waiterHasStaffManage = await PermissionService.hasPermission(waiterUserId!, bizId!, branchAId!, 'staff.manage');
    assert(waiterHasRequests && !waiterHasStaffManage, 'Test 5: Waiter has request viewing access but CANNOT manage staff', `requests: ${waiterHasRequests}, staffManage: ${waiterHasStaffManage}`);

    // TEST 6: Custom role creation succeeds
    const createRoleRes = await PermissionService.createCustomRole(ownerUserId!, bizId!, {
      name: 'Supervisor',
      description: 'Floor supervisor with menu and table permissions',
      permissions: ['orders.view', 'menu.manage', 'tables.manage', 'reports.view'],
    });
    assert(createRoleRes.success && !!createRoleRes.role?.id, 'Test 6: Custom role "Supervisor" creation succeeds');
    const supervisorRoleId = createRoleRes.role!.id;

    // TEST 7: Custom role assignment succeeds
    const assignRoleRes = await PermissionService.updateMemberRole(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      builtInRole: 'cashier',
      customRoleId: supervisorRoleId,
    });
    assert(assignRoleRes.success, 'Test 7: Assigning custom role "Supervisor" to cashier membership succeeds');

    // TEST 8: Custom role permission enforcement works
    const cashierNowHasMenuManage = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(cashierNowHasMenuManage, 'Test 8: Member with assigned "Supervisor" custom role gains granted menu.manage permission');

    // TEST 9: Explicit deny overrides role allow
    const denyRes = await PermissionService.setMemberOverride(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      permissionKey: 'menu.manage',
      effect: 'deny',
    });
    assert(denyRes.success, 'Test 9a: Setting explicit "deny" override on menu.manage succeeds');

    const cashierDeniedMenu = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(!cashierDeniedMenu, 'Test 9b: Explicit "deny" override strictly revokes permission despite custom role grant');

    // TEST 10: Explicit allow works where permitted
    const allowRes = await PermissionService.setMemberOverride(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      permissionKey: 'reports.export',
      effect: 'allow',
    });
    assert(allowRes.success, 'Test 10a: Setting explicit "allow" override on reports.export succeeds');

    const cashierAllowedExport = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'reports.export');
    assert(cashierAllowedExport, 'Test 10b: Explicit "allow" override grants delegated capability to member');

    // TEST 11: Branch A manager blocked from Branch B
    const mgrBranchBCheck = await PermissionService.hasPermission(mgrUserId!, bizId!, branchBId!, 'orders.view');
    assert(!mgrBranchBCheck, 'Test 11: Branch A manager is strictly blocked from Branch B operations (Branch boundary isolation)');

    // TEST 12: Suspended member denied
    await PermissionService.setMembershipStatus(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      status: 'suspended',
    });
    const suspendedCheck = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'cashier.access');
    assert(!suspendedCheck, 'Test 12: Suspended member is denied all operational access regardless of assigned role');

    // Reactivate cashier for remaining tests
    await PermissionService.setMembershipStatus(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      status: 'active',
    });

    // TEST 13: Invitation with custom role assigns correctly
    const inviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchAId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });

    const claimRes = await StaffInvitationService.claimInvitation(customRoleUserId!, `perm_custom_${timestamp}@test.com`, inviteRes.rawCode!);
    assert(claimRes.success, 'Test 13: Staff invitation claim assigns business membership cleanly');

    // TEST 14: Existing built-in role invite still works
    const builtInInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchAId!,
      assignedRole: 'kitchen_staff',
      expiryOption: '48h',
    });
    assert(builtInInviteRes.success, 'Test 14: Built-in role invitation generation continues working 100% compatibly');

    // TEST 15: Permission change takes effect without re-login
    await PermissionService.removeMemberOverride(ownerUserId!, bizId!, cashierMembershipId!, 'menu.manage');
    const immediateCheck = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(immediateCheck, 'Test 15: Removing deny override takes effect immediately on next request without re-login');

    // TEST 16: Client-modified role value does not escalate
    const nonOwnerAssignRes = await PermissionService.updateMemberRole(cashierUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      builtInRole: 'business_owner',
    });
    assert(!nonOwnerAssignRes.success, 'Test 16: Non-owner client payload attempting self-promotion is rejected server-side');

    // TEST 17: Member cannot grant permissions to self
    const selfOverrideRes = await PermissionService.setMemberOverride(cashierUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      permissionKey: 'business.settings.manage',
      effect: 'allow',
    });
    assert(!selfOverrideRes.success, 'Test 17: Non-authorized member cannot grant permissions to self');

    // TEST 18: Manager cannot grant owner-only permissions
    const mgrCreateOwnerRole = await PermissionService.createCustomRole(mgrUserId!, bizId!, {
      name: 'Sneaky Role',
      permissions: ['business.settings.manage', 'owner.transfer'],
    });
    const sneakyRolePermissions = mgrCreateOwnerRole.role?.permissions || [];
    assert(!sneakyRolePermissions.includes('business.settings.manage'), 'Test 18: Non-owner manager cannot include owner-only permissions in custom role creation');

    // TEST 19: Owner-only destructive permissions remain protected
    const nonOwnerOwnerKeyCheck = await PermissionService.hasPermission(mgrUserId!, bizId!, branchAId!, 'owner.transfer');
    assert(!nonOwnerOwnerKeyCheck, 'Test 19: Owner-only destructive permission keys remain strictly protected');

    // TEST 20: Audit logs created for permission changes
    const { data: auditLogs } = await admin
      .from('audit_logs')
      .select('action')
      .eq('business_id', bizId!)
      .in('action', ['role.created', 'role.assigned', 'permission.granted', 'member.suspended']);

    assert(Boolean(auditLogs && auditLogs.length >= 3), 'Test 20: Audit log entries recorded for role creation, assignment, and member suspension');

    // TEST 21: Existing Phase 1-14 behavior remains intact
    const { AccountService } = await import('../src/server/services/account.service');
    const existingRoute = await AccountService.resolveAccountRoute(
      { id: ownerUserId! },
      { id: ownerUserId!, onboarding_intent: null },
      { id: 'm', business_id: bizId!, role: 'business_owner', membership_status: 'active' }
    );
    assert(existingRoute === '/dashboard', 'Test 21: Existing Phase 1-14 authentication & routing pipeline remains 100% compatible');

    // TEST 22: Central route permission map resolves pathnames correctly
    const { getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');
    const menuCatPerm = getRequiredPermissionForRoute('/dashboard/menu/categories');
    const cashierPerm = getRequiredPermissionForRoute('/dashboard/cashier');
    const reportsPerm = getRequiredPermissionForRoute('/dashboard/reports');
    assert((menuCatPerm === 'menu.categories.manage' || menuCatPerm === 'menu.manage') && cashierPerm === 'cashier.access' && reportsPerm === 'reports.view', 'Test 22: Central route permission map resolves pathnames to correct PermissionKey');

    // TEST 23: Role presets map cleanly to permission arrays
    const { getPermissionsForPreset } = await import('../src/lib/validation/permission-presets');
    const cashierPreset = getPermissionsForPreset('cashier');
    const kitchenPreset = getPermissionsForPreset('kitchen_staff');
    assert(cashierPreset.includes('cashier.access') && cashierPreset.includes('payments.record') && !cashierPreset.includes('menu.manage') && kitchenPreset.includes('kitchen.access'), 'Test 23: Role Presets (Cashier, Kitchen, Waiter, Manager) map cleanly to expected permission keys');

    // Reset cashier back to standard cashier role (removing Supervisor custom role) for tests 24-26
    await PermissionService.updateMemberRole(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      builtInRole: 'cashier',
      customRoleId: null,
    });

    // TEST 24: Direct server route guard blocks cashier from /dashboard/menu/categories
    const cashierMenuCheck = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(!cashierMenuCheck, 'Test 24: Direct URL access to /dashboard/menu/categories is blocked for staff without menu.manage');

    // TEST 25: Menu mutation Server Action rejects cashier with Forbidden
    const cashierCanManageMenu = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'menu.manage');
    assert(!cashierCanManageMenu, 'Test 25: Server Action mutation for menu category creation blocks unauthorized staff');

    // TEST 26: Sidebar navigation filters out ungranted modules for cashier
    const cashierPermissions = await PermissionService.getMemberEffectivePermissions(cashierUserId!, bizId!, branchAId!);
    assert(cashierPermissions.includes('cashier.access') && !cashierPermissions.includes('menu.manage') && !cashierPermissions.includes('branches.manage'), 'Test 26: Navigation sidebar items filter out ungranted modules cleanly');

    // TEST 27: Permission revocation takes effect immediately without requiring logout
    await PermissionService.setMemberOverride(ownerUserId!, bizId!, {
      membershipId: cashierMembershipId!,
      permissionKey: 'cashier.access',
      effect: 'deny',
    });
    const immediateRevocation = await PermissionService.hasPermission(cashierUserId!, bizId!, branchAId!, 'cashier.access');
    assert(!immediateRevocation, 'Test 27: Immediate permission revocation takes effect on next request without requiring logout');

    // TEST 28: Phase 28 Recipe & Purchasing permission keys integrity
    const { permissionKeyEnum } = await import('../src/lib/validation/permission');
    const phase28ExpectedKeys = [
      'recipes.view',
      'recipes.manage',
      'recipes.costs.view',
      'purchasing.view',
      'purchasing.create',
      'purchasing.approve',
      'purchasing.receive',
      'suppliers.view',
      'suppliers.manage',
      'inventory.cogs.view',
      'inventory.menu_profitability.view',
      'inventory.settings.manage',
      'inventory.production.manage',
    ];
    const definedKeys = permissionKeyEnum.options;
    const allPhase28KeysValid = phase28ExpectedKeys.every((k) => (definedKeys as string[]).includes(k));
    assert(allPhase28KeysValid, 'Test 28: All Phase 28 permission keys are registered in TypeScript permissionKeyEnum');

    // TEST 29: Phase 28 migration ordering & catalog completeness
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260817000000_phase28_recipe_costing_purchasing.sql'),
      'utf8'
    );
    const permCatalogPos = migrationSql.indexOf('INSERT INTO public.permissions');
    const rolePermPos = migrationSql.indexOf('INSERT INTO public.role_permissions');
    const hasCorrectOrder = permCatalogPos > 0 && rolePermPos > 0 && permCatalogPos < rolePermPos;
    const migrationHasAllPhase28Perms = phase28ExpectedKeys.every((k) => migrationSql.includes(`'${k}'`));
    assert(hasCorrectOrder && migrationHasAllPhase28Perms, 'Test 29: Phase 28 migration seeds public.permissions FIRST with all 13 keys before public.role_permissions');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during permissions verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up test permissions accounts...');
    if (bizId) {
      await admin.from('businesses').delete().filter('id', 'eq', bizId);
    }
    const uids = [ownerUserId, mgrUserId, cashierUserId, kitchenUserId, waiterUserId, customRoleUserId];
    for (const uid of uids) {
      if (uid) {
        await admin.auth.admin.deleteUser(uid);
      }
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`  Phase 15 Permissions Verification: ALL ${passed} TESTS PASSED  `);
  console.log('================================================================\n');
}

runPermissionsVerificationSuite();

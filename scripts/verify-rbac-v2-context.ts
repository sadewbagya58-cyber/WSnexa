import * as path from 'path';
import * as fs from 'fs';

// Bypass server-only guard for direct tsx execution
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

import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'url';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string, details?: unknown) {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    if (details) console.error('     Details:', details);
    failed++;
  }
}

async function verifyRbacV2Context() {
  console.log('================================================================');
  console.log('  WSNexa Phase 30 Step 3 — Authorization Context & Scope Test   ');
  console.log('================================================================\n');

  const { resolveAuthorizationContext } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/authorization-context.ts')).href
  );
  const { resolveResourceScope } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/resource-scope-resolver.ts')).href
  );

  const testId = `test_ctx_${Date.now()}`;
  const userAEmail = `${testId}_owner@example.com`;
  const userBEmail = `${testId}_staff@example.com`;
  const userInactiveEmail = `${testId}_inactive@example.com`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let userInactiveId: string | null = null;

  let biz1Id: string | null = null;
  let biz2Id: string | null = null;
  let branch1AId: string | null = null;
  let branch1BId: string | null = null;
  let branch2AId: string | null = null;

  let memberA1Id: string | null = null;
  let memberA2Id: string | null = null;
  let memberB1Id: string | null = null;
  let memberInactiveId: string | null = null;

  let customRoleId: string | null = null;
  let deptId: string | null = null;
  let unitId: string | null = null;
  let serviceAreaId: string | null = null;
  let posId: string | null = null;

  let assignPrimaryId: string | null = null;
  let assignActingActiveId: string | null = null;
  let assignActingExpiredId: string | null = null;
  let assignSecActiveId: string | null = null;
  let assignSecExpiredId: string | null = null;

  let orderId: string | null = null;
  let inventoryItemId: string | null = null;
  let diningTableId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------
    console.log('--- Setting up test fixtures in Supabase ---');

    // 1. Create Users
    const { data: userA, error: userAErr } = await admin.auth.admin.createUser({
      email: userAEmail,
      password: 'Password123!',
      email_confirm: true,
    });
    if (userAErr || !userA?.user) throw new Error(`Failed to create userA: ${userAErr?.message}`);
    userAId = userA.user.id;
    await admin.from('user_profiles').upsert({ id: userAId, first_name: 'Alice', last_name: 'Owner', account_status: 'active' });

    const { data: userB, error: userBErr } = await admin.auth.admin.createUser({
      email: userBEmail,
      password: 'Password123!',
      email_confirm: true,
    });
    if (userBErr || !userB?.user) throw new Error(`Failed to create userB: ${userBErr?.message}`);
    userBId = userB.user.id;
    await admin.from('user_profiles').upsert({ id: userBId, first_name: 'Bob', last_name: 'Staff', account_status: 'active' });

    const { data: userInactive, error: userInErr } = await admin.auth.admin.createUser({
      email: userInactiveEmail,
      password: 'Password123!',
      email_confirm: true,
    });
    if (userInErr || !userInactive?.user) throw new Error(`Failed to create userInactive: ${userInErr?.message}`);
    userInactiveId = userInactive.user.id;
    await admin.from('user_profiles').upsert({ id: userInactiveId, first_name: 'Ian', last_name: 'Inactive', account_status: 'suspended' });

    // 2. Create Businesses
    const { data: biz1, error: biz1Err } = await admin
      .from('businesses')
      .insert({ name: `Test Biz 1 ${testId}`, slug: `biz-1-${testId}`, business_type: 'restaurant', status: 'active', default_currency: 'USD', created_by: userAId })
      .select()
      .single();
    if (biz1Err || !biz1) throw new Error(`Failed to create biz1: ${biz1Err?.message}`);
    biz1Id = biz1.id;

    const { data: biz2, error: biz2Err } = await admin
      .from('businesses')
      .insert({ name: `Test Biz 2 ${testId}`, slug: `biz-2-${testId}`, business_type: 'cafe', status: 'active', default_currency: 'USD', created_by: userAId })
      .select()
      .single();
    if (biz2Err || !biz2) throw new Error(`Failed to create biz2: ${biz2Err?.message}`);
    biz2Id = biz2.id;

    // 3. Create Branches
    const { data: br1A } = await admin
      .from('branches')
      .insert({ business_id: biz1Id, name: 'Branch 1A (Default)', code: 'B1A', is_default: true, status: 'active', timezone: 'UTC' })
      .select()
      .single();
    branch1AId = br1A.id;

    const { data: br1B } = await admin
      .from('branches')
      .insert({ business_id: biz1Id, name: 'Branch 1B', code: 'B1B', is_default: false, status: 'active', timezone: 'UTC' })
      .select()
      .single();
    branch1BId = br1B.id;

    const { data: br2A } = await admin
      .from('branches')
      .insert({ business_id: biz2Id, name: 'Branch 2A', code: 'B2A', is_default: true, status: 'active', timezone: 'UTC' })
      .select()
      .single();
    branch2AId = br2A.id;

    // 4. Custom Role in Biz 1
    const { data: cr, error: crErr } = await admin
      .from('custom_roles')
      .insert({
        business_id: biz1Id,
        name: 'Head Bartender',
        description: 'Custom bar supervisor',
        role_key: `custom_head_bartender_${Date.now().toString().slice(-4)}`,
        created_by: userAId,
        is_active: true,
      })
      .select()
      .single();
    if (crErr || !cr) throw new Error(`Failed to create custom role: ${crErr?.message}`);
    customRoleId = cr.id;

    await admin.from('role_permissions').insert([
      { custom_role_id: customRoleId, permission_key: 'menu.items.create', business_id: biz1Id },
      { custom_role_id: customRoleId, permission_key: 'orders.view', business_id: biz1Id },
    ]);

    // 5. Memberships
    // Alice is Owner in Biz 1 and Waiter in Biz 2 (Multi-business user)
    const { data: mbA1 } = await admin
      .from('business_memberships')
      .insert({ business_id: biz1Id, user_id: userAId, role: 'business_owner', membership_status: 'active' })
      .select()
      .single();
    memberA1Id = mbA1.id;

    const { data: mbA2 } = await admin
      .from('business_memberships')
      .insert({ business_id: biz2Id, user_id: userAId, role: 'waiter', membership_status: 'active' })
      .select()
      .single();
    memberA2Id = mbA2.id;

    // Bob is Custom Role (Head Bartender) in Biz 1, assigned to Branch 1A
    const { data: mbB1 } = await admin
      .from('business_memberships')
      .insert({ business_id: biz1Id, user_id: userBId, role: 'branch_manager', custom_role_id: customRoleId, membership_status: 'active' })
      .select()
      .single();
    memberB1Id = mbB1.id;

    // Inactive member
    const { data: mbIn } = await admin
      .from('business_memberships')
      .insert({ business_id: biz1Id, user_id: userInactiveId, role: 'waiter', membership_status: 'suspended' })
      .select()
      .single();
    memberInactiveId = mbIn.id;

    // 6. Branch Assignments
    await admin.from('branch_assignments').insert([
      { business_membership_id: memberB1Id, branch_id: branch1AId, is_primary: true },
      { business_membership_id: memberA2Id, branch_id: branch2AId, is_primary: true },
    ]);

    // 7. Departments, Units, Positions, Service Areas
    const { data: dept } = await admin
      .from('organization_departments')
      .insert({ business_id: biz1Id, name: 'Food & Beverage', code: 'FB', branch_id: branch1AId, is_active: true })
      .select()
      .single();
    deptId = dept.id;

    const { data: unit } = await admin
      .from('organization_units')
      .insert({ business_id: biz1Id, name: 'Main Bar Team', unit_type: 'team', department_id: deptId, branch_id: branch1AId, is_active: true })
      .select()
      .single();
    unitId = unit.id;

    const { data: sa } = await admin
      .from('service_areas')
      .insert({ business_id: biz1Id, branch_id: branch1AId, name: 'Lounge Area', code: 'LNG', is_active: true })
      .select()
      .single();
    serviceAreaId = sa.id;

    const { OrganizationService } = await import(
      pathToFileURL(path.join(process.cwd(), 'src/server/services/organization.service.ts')).href
    );

    const levels = await OrganizationService.seedDefaultHierarchyLevels(biz1Id);
    const opLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];
    const title = await OrganizationService.createJobTitle({
      businessId: biz1Id,
      name: 'Lead Bartender',
      code: `BAR-LEAD-${testId.slice(-6)}`,
      hierarchyLevelId: opLevel.id,
      departmentType: 'food_and_beverage',
      isManagement: false,
    });

    const pos = await OrganizationService.createPosition({
      businessId: biz1Id,
      branchId: branch1AId,
      departmentId: deptId,
      unitId: unitId,
      jobTitleId: title.id,
      positionCode: `POS-BAR-${testId.slice(-6)}`,
      headcountLimit: 2,
      status: 'active',
    });
    posId = pos.id;

    // 8. Staff Area Assignment for Bob
    await admin.from('staff_area_assignments').insert({
      business_id: biz1Id,
      branch_id: branch1AId,
      business_membership_id: memberB1Id,
      service_area_id: serviceAreaId,
    });

    // 9. Staff Assignments for Alice and Bob:
    // 9.0 Alice Primary Assignment
    const saAlice = await OrganizationService.createStaffAssignment({
      businessId: biz1Id,
      businessMembershipId: memberA1Id,
      positionId: pos.id,
      jobTitleId: title.id,
      branchId: branch1AId,
      departmentId: deptId,
      unitId: unitId,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });

    // 9.1 Active Primary assignment for Bob
    const saPrimary = await OrganizationService.createStaffAssignment({
      businessId: biz1Id,
      businessMembershipId: memberB1Id,
      positionId: pos.id,
      jobTitleId: title.id,
      branchId: branch1AId,
      departmentId: deptId,
      unitId: unitId,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });
    assignPrimaryId = saPrimary.id;

    // 9.2 Active Acting assignment (valid for next 7 days)
    const saActingAct = await OrganizationService.createActingAssignment({
      businessId: biz1Id,
      businessMembershipId: memberB1Id,
      actingForAssignmentId: saAlice.id,
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      reason: 'Covering Bar Manager',
    });
    assignActingActiveId = saActingAct.id;

    // 9.3 Expired Acting assignment (insert directly into DB to simulate past expired record with status active)
    const { data: saActingExp } = await admin
      .from('staff_assignments')
      .insert({
        business_id: biz1Id,
        business_membership_id: memberB1Id,
        job_title_id: title.id,
        position_id: pos.id,
        branch_id: branch1AId,
        department_id: deptId,
        unit_id: unitId,
        assignment_type: 'acting',
        acting_for_assignment_id: saAlice.id,
        is_primary: false,
        status: 'active',
        starts_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        ends_at: new Date(Date.now() - 86400000).toISOString(),
      })
      .select()
      .single();
    assignActingExpiredId = saActingExp?.id || null;

    // 9.4 Active Secondment to Branch 1B (valid for next 14 days)
    const saSecAct = await OrganizationService.createSecondment({
      businessId: biz1Id,
      businessMembershipId: memberB1Id,
      sourceAssignmentId: saPrimary.id,
      jobTitleId: title.id,
      branchId: branch1BId,
      departmentId: deptId,
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 14).toISOString(),
      reason: 'Assist Branch 1B',
    });
    assignSecActiveId = saSecAct.id;

    // 9.5 Expired Secondment (insert directly into DB to simulate past expired record with status active)
    const { data: saSecExp } = await admin
      .from('staff_assignments')
      .insert({
        business_id: biz1Id,
        business_membership_id: memberB1Id,
        job_title_id: title.id,
        source_assignment_id: saPrimary.id,
        position_id: pos.id,
        branch_id: branch1BId,
        department_id: deptId,
        assignment_type: 'secondment',
        is_primary: false,
        status: 'active',
        starts_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        ends_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      })
      .select()
      .single();
    assignSecExpiredId = saSecExp?.id || null;

    // 10. Overrides & Scope Grants
    // Legacy unscoped override for Bob (allow receipts.print)
    const { error: insErr } = await admin.from('member_permission_overrides').insert([
      {
        business_membership_id: memberB1Id,
        permission_key: 'receipts.print',
        effect: 'allow',
        scope_type: null,
        created_by: userAId,
      },
      {
        business_membership_id: memberB1Id,
        permission_key: 'inventory.waste.record',
        effect: 'allow',
        scope_type: 'PROPERTY',
        branch_id: branch1AId,
        created_by: userAId,
      },
    ]);
    if (insErr) throw new Error(`Failed to insert member permission overrides: ${insErr.message}`);

    // Concrete scope grant for Bob
    await admin.from('permission_scope_grants').insert({
      business_id: biz1Id,
      business_membership_id: memberB1Id,
      permission_key: 'waiter.orders.create',
      effect: 'allow',
      scope_type: 'AREA_TEAM',
      service_area_id: serviceAreaId,
      grant_source: 'staff_assignment',
    });

    // 11. Domain Resources for Scope Resolver Test
    const orderNum = Math.floor(10000 + Math.random() * 90000);
    const { data: ord, error: ordErr } = await admin
      .from('orders')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        customer_user_id: userAId,
        order_number: orderNum,
        order_number_formatted: `#${orderNum}`,
        idempotency_key: `idemp_${testId}_${orderNum}`,
        access_token: `token_${testId}_${orderNum}`,
        status: 'pending',
        payment_status: 'unpaid',
        subtotal_cents: 1000,
        tax_cents: 100,
        total_cents: 1100,
        currency: 'USD',
      })
      .select()
      .single();
    if (ordErr || !ord) throw new Error(`Failed to create test order: ${ordErr?.message}`);
    orderId = ord.id;

    const { data: invItem, error: invErr } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz1Id,
        name: `Gin ${testId}`,
        sku: `GIN-${testId.slice(-6)}`,
        base_unit: 'bottle',
        cost_per_unit_cents: 2500,
        currency: 'USD',
      })
      .select()
      .single();
    if (invErr || !invItem) throw new Error(`Failed to create inventory item: ${invErr?.message}`);
    inventoryItemId = invItem.id;

    const { data: dt, error: dtErr } = await admin
      .from('dining_tables')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        service_area_id: serviceAreaId,
        name: 'Table 101',
        code: 'T101',
        capacity: 4,
      })
      .select()
      .single();
    if (dtErr || !dt) throw new Error(`Failed to create dining table: ${dtErr?.message}`);
    diningTableId = dt.id;

    // -------------------------------------------------------------
    // TEST SUITES
    // -------------------------------------------------------------

    console.log('\n--- 1. Authentication & Membership Resolution ---');

    // 1.1 Unauthenticated context rejected
    let unauthCaught = false;
    try {
      await resolveAuthorizationContext({});
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'UNAUTHENTICATED') {
        unauthCaught = true;
      }
    }
    assert(unauthCaught, 'Unauthenticated call without session or override throws UNAUTHENTICATED');

    // 1.2 Inactive membership rejected
    let inactiveCaught = false;
    try {
      await resolveAuthorizationContext({ overrideUserId: userInactiveId! });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'MEMBERSHIP_INACTIVE') {
        inactiveCaught = true;
      }
    }
    assert(inactiveCaught, 'User with only suspended/inactive membership throws MEMBERSHIP_INACTIVE');

    // 1.3 Active business membership resolved for Alice
    const ctxA1 = await resolveAuthorizationContext({
      overrideUserId: userAId!,
      requestedBusinessId: biz1Id!,
    });
    assert(ctxA1.userId === userAId, 'Alice user ID resolved accurately');
    assert(ctxA1.businessId === biz1Id, 'Alice active business ID matches requested Biz 1');
    assert(ctxA1.isBusinessOwner === true, 'Alice is identified as business owner');
    assert(ctxA1.membershipRole === 'business_owner', 'Alice membershipRole = business_owner');

    // 1.4 Multi-business user resolves requested Biz 2 accurately
    const ctxA2 = await resolveAuthorizationContext({
      overrideUserId: userAId!,
      requestedBusinessId: biz2Id!,
    });
    assert(ctxA2.businessId === biz2Id, 'Alice resolves Biz 2 when requested');
    assert(ctxA2.isBusinessOwner === false, 'Alice is NOT business owner in Biz 2');
    assert(ctxA2.membershipRole === 'waiter', 'Alice membershipRole = waiter in Biz 2');

    // 1.5 Tenant mismatch error on unauthorized business request
    let mismatchCaught = false;
    try {
      await resolveAuthorizationContext({
        overrideUserId: userBId!,
        requestedBusinessId: biz2Id!, // Bob only belongs to Biz 1
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'TENANT_MISMATCH') {
        mismatchCaught = true;
      }
    }
    assert(mismatchCaught, 'Requesting business user does not belong to throws TENANT_MISMATCH');

    console.log('\n--- 2. Active & Authorized Branch Resolution ---');

    // 2.1 Owner has all business branches in authorizedBranchIds
    assert(
      ctxA1.authorizedBranchIds.includes(branch1AId!) && ctxA1.authorizedBranchIds.includes(branch1BId!),
      'Business Owner has access to all active business branches'
    );
    assert(ctxA1.activeBranchId === branch1AId, 'Owner defaults to business default branch (Branch 1A)');

    // 2.2 Non-owner (Bob) has assigned branch + secondment branch
    const ctxB = await resolveAuthorizationContext({
      overrideUserId: userBId!,
      requestedBusinessId: biz1Id!,
    });
    assert(ctxB.authorizedBranchIds.includes(branch1AId!), 'Bob has assigned Branch 1A in authorizedBranchIds');
    assert(ctxB.authorizedBranchIds.includes(branch1BId!), 'Bob has active secondment Branch 1B in authorizedBranchIds');
    assert(!ctxB.authorizedBranchIds.includes(branch2AId!), 'Bob does NOT have other business branch 2A in authorizedBranchIds');

    // 2.3 Tampered / unauthorized requested branch deterministically falls back
    const ctxBTampered = await resolveAuthorizationContext({
      overrideUserId: userBId!,
      requestedBusinessId: biz1Id!,
      requestedBranchId: branch2AId!, // Tampered cross-business branch
    });
    assert(
      ctxBTampered.activeBranchId === branch1AId,
      'Tampered branch request safely falls back to authorized branch 1A without throwing or expanding scope'
    );

    console.log('\n--- 3. Role Permissions, Overrides & Scope Grants ---');

    // 3.1 Custom role permissions loaded for Bob
    assert(ctxB.rolePermissions.includes('menu.items.create'), 'Custom role permission menu.items.create loaded');
    assert(ctxB.rolePermissions.includes('orders.view'), 'Custom role permission orders.view loaded');
    assert(ctxB.customRoleId === customRoleId, 'Bob customRoleId resolved accurately');

    // 3.2 Legacy unscoped overrides loaded
    const legacyOverride = ctxB.permissionOverrides.find((o: { permissionKey: string; scopeType: string | null }) => o.permissionKey === 'receipts.print');
    assert(Boolean(legacyOverride && legacyOverride.scopeType === null), 'Legacy unscoped override has scopeType = null');

    // 3.3 Scoped overrides loaded
    const scopedOverride = ctxB.permissionOverrides.find((o: { permissionKey: string; scopeType: string | null; branchId?: string | null }) => o.permissionKey === 'inventory.waste.record');
    assert(
      Boolean(scopedOverride && scopedOverride.scopeType === 'PROPERTY' && scopedOverride.branchId === branch1AId),
      'Scoped override has scopeType = PROPERTY and branchId = Branch 1A'
    );

    // 3.4 Permission scope grants loaded
    const waiterGrant = ctxB.scopeGrants.find((g: { permissionKey: string; scopeType: string; serviceAreaId?: string | null }) => g.permissionKey === 'waiter.orders.create');
    assert(
      Boolean(waiterGrant && waiterGrant.scopeType === 'AREA_TEAM' && waiterGrant.serviceAreaId === serviceAreaId),
      'Permission scope grant has scopeType = AREA_TEAM and serviceAreaId'
    );

    // 3.5 Role scope preset loaded
    assert(Boolean(ctxB.roleScopePreset), 'Role scope preset is loaded');

    console.log('\n--- 4. Phase 29 Staff Assignments, Acting & Secondments ---');

    // 4.1 Valid staff assignments resolved
    assert(ctxB.staffAssignments.some((a: { id: string }) => a.id === assignPrimaryId), 'Active primary staff assignment resolved');

    // 4.2 Active acting assignment included
    assert(ctxB.actingAssignments.some((a: { id: string }) => a.id === assignActingActiveId), 'Active acting assignment included');

    // 4.3 Expired acting assignment excluded
    assert(
      !ctxB.actingAssignments.some((a: { id: string }) => a.id === assignActingExpiredId) &&
        !ctxB.staffAssignments.some((a: { id: string }) => a.id === assignActingExpiredId),
      'Expired acting assignment is strictly excluded by temporal validity check'
    );

    // 4.4 Active secondment included
    assert(ctxB.secondments.some((a: { id: string }) => a.id === assignSecActiveId), 'Active secondment included');

    // 4.5 Expired secondment excluded
    assert(
      !ctxB.secondments.some((a: { id: string }) => a.id === assignSecExpiredId) &&
        !ctxB.staffAssignments.some((a: { id: string }) => a.id === assignSecExpiredId),
      'Expired secondment is strictly excluded by temporal validity check'
    );

    // 4.6 Departments, Units, and Service Areas
    assert(ctxB.departmentIds.includes(deptId!), 'Bob authorized departmentIds includes Food & Beverage');
    assert(ctxB.organizationUnitIds.includes(unitId!), 'Bob authorized organizationUnitIds includes Main Bar Team');
    assert(ctxB.serviceAreaIds.includes(serviceAreaId!), 'Bob authorized serviceAreaIds includes Lounge Area');

    // 4.7 SELF Identity
    assert(ctxB.selfIdentity.userId === userBId, 'SELF identity userId matches Bob');
    assert(ctxB.selfIdentity.membershipId === memberB1Id, 'SELF identity membershipId matches Bob');
    assert(ctxB.selfIdentity.staffAssignmentIds.includes(assignPrimaryId!), 'SELF identity includes primary assignment ID');

    // 4.8 Diagnostics
    assert(ctxB.diagnostics.queryCount <= 12, `Query count is bounded (${ctxB.diagnostics.queryCount} queries used)`);
    assert(Boolean(ctxB.diagnostics.resolvedAt), 'Diagnostics resolvedAt timestamp recorded');

    console.log('\n--- 5. Trusted Resource Scope Resolver ---');

    // 5.1 Order scope resolution
    const orderScope = await resolveResourceScope({ resourceType: 'order', resourceId: orderId! });
    assert(orderScope.businessId === biz1Id, 'Order businessId derived from DB');
    assert(orderScope.branchId === branch1AId, 'Order branchId derived from DB');
    assert(orderScope.ownerUserId === userAId, 'Order ownerUserId matches customer user ID');

    // 5.2 Inventory item scope resolution
    const invScope = await resolveResourceScope({ resourceType: 'inventory_item', resourceId: inventoryItemId! });
    assert(invScope.businessId === biz1Id, 'Inventory item businessId derived from DB');
    assert(invScope.branchId === null, 'Inventory item is organization-scoped (branchId is null)');

    // 5.3 Dining table scope resolution
    const tableScope = await resolveResourceScope({ resourceType: 'dining_table', resourceId: diningTableId! });
    assert(tableScope.businessId === biz1Id, 'Dining table businessId derived from DB');
    assert(tableScope.serviceAreaId === serviceAreaId, 'Dining table serviceAreaId derived from DB');

    // 5.4 Cross-tenant resource resolution rejected
    let crossTenantCaught = false;
    try {
      await resolveResourceScope({
        resourceType: 'order',
        resourceId: orderId!,
        expectedBusinessId: biz2Id!, // Order belongs to Biz 1, not Biz 2
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'TENANT_MISMATCH') {
        crossTenantCaught = true;
      }
    }
    assert(crossTenantCaught, 'Cross-tenant resource scope assertion throws TENANT_MISMATCH');

    // 5.5 Non-existent resource throws RESOURCE_NOT_FOUND
    let notFoundCaught = false;
    try {
      await resolveResourceScope({
        resourceType: 'order',
        resourceId: '00000000-0000-0000-0000-000000000000',
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'RESOURCE_NOT_FOUND') {
        notFoundCaught = true;
      }
    }
    assert(notFoundCaught, 'Non-existent resource ID throws RESOURCE_NOT_FOUND');

  } catch (err: unknown) {
    console.error('Execution failure during verification:', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    if (orderId) await admin.from('orders').delete().eq('id', orderId);
    if (inventoryItemId) await admin.from('inventory_items').delete().eq('id', inventoryItemId);
    if (diningTableId) await admin.from('dining_tables').delete().eq('id', diningTableId);
    if (memberB1Id) {
      await admin.from('member_permission_overrides').delete().eq('business_membership_id', memberB1Id);
      await admin.from('permission_scope_grants').delete().eq('business_membership_id', memberB1Id);
      await admin.from('staff_area_assignments').delete().eq('business_membership_id', memberB1Id);
      await admin.from('staff_assignments').delete().eq('business_membership_id', memberB1Id);
    }
    if (posId) await admin.from('organization_positions').delete().eq('id', posId);
    if (unitId) await admin.from('organization_units').delete().eq('id', unitId);
    if (deptId) await admin.from('organization_departments').delete().eq('id', deptId);
    if (serviceAreaId) await admin.from('service_areas').delete().eq('id', serviceAreaId);
    if (customRoleId) {
      await admin.from('role_permissions').delete().eq('custom_role_id', customRoleId);
      await admin.from('custom_roles').delete().eq('id', customRoleId);
    }
    if (memberA1Id) await admin.from('business_memberships').delete().eq('id', memberA1Id);
    if (memberA2Id) await admin.from('business_memberships').delete().eq('id', memberA2Id);
    if (memberB1Id) await admin.from('business_memberships').delete().eq('id', memberB1Id);
    if (memberInactiveId) await admin.from('business_memberships').delete().eq('id', memberInactiveId);
    if (branch1AId) await admin.from('branches').delete().eq('id', branch1AId);
    if (branch1BId) await admin.from('branches').delete().eq('id', branch1BId);
    if (branch2AId) await admin.from('branches').delete().eq('id', branch2AId);
    if (biz1Id) await admin.from('businesses').delete().eq('id', biz1Id);
    if (biz2Id) await admin.from('businesses').delete().eq('id', biz2Id);
    if (userAId) {
      await admin.from('user_profiles').delete().eq('id', userAId);
      await admin.auth.admin.deleteUser(userAId);
    }
    if (userBId) {
      await admin.from('user_profiles').delete().eq('id', userBId);
      await admin.auth.admin.deleteUser(userBId);
    }
    if (userInactiveId) {
      await admin.from('user_profiles').delete().eq('id', userInactiveId);
      await admin.auth.admin.deleteUser(userInactiveId);
    }
    console.log('✅ Cleanup completed.');
  }

  console.log(`\n================================================================`);
  console.log(`  Phase 30 Step 3 Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyRbacV2Context();

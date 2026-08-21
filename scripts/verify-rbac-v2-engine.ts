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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedAssertions++;
  }
}

async function verifyRbacV2Engine() {
  console.log('================================================================');
  console.log('    WSNexa Phase 30 Step 4 — RBAC & Scope V2 Engine Test        ');
  console.log('================================================================\n');

  const { resolveAuthorizationContext } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/authorization-context.ts')).href
  );
  const { can, authorize, requirePermission } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/policy-engine.ts')).href
  );

  const testId = `test_eng_${Date.now()}`;
  const userAEmail = `${testId}_owner@example.com`;
  const userBEmail = `${testId}_staff@example.com`;
  const userCEmail = `${testId}_manager@example.com`;
  const userInactiveEmail = `${testId}_inactive@example.com`;

  let userAId: string | null = null;
  let userBId: string | null = null;
  let userCId: string | null = null;
  let userInactiveId: string | null = null;

  let biz1Id: string | null = null;
  let biz2Id: string | null = null;

  let branch1AId: string | null = null;
  let branch1BId: string | null = null;
  let branch2AId: string | null = null;

  let memberA1Id: string | null = null;
  let memberB1Id: string | null = null;
  let memberC1Id: string | null = null;

  let customRoleId: string | null = null;
  let deptId: string | null = null;
  let unitId: string | null = null;
  let otherDeptId: string | null = null;
  let serviceAreaId: string | null = null;
  let otherServiceAreaId: string | null = null;

  let orderId: string | null = null;
  let order2Id: string | null = null;
  let inventoryItemId: string | null = null;
  let diningTable1Id: string | null = null;
  let diningTable2Id: string | null = null;

  try {
    console.log('--- Setting up test fixtures in Supabase ---');

    // 1. Create Test Users
    const { data: uA, error: uAErr } = await admin.auth.admin.createUser({
      email: userAEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (uAErr || !uA.user) throw new Error(`Failed to create User A: ${uAErr?.message}`);
    userAId = uA.user.id;

    const { data: uB, error: uBErr } = await admin.auth.admin.createUser({
      email: userBEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (uBErr || !uB.user) throw new Error(`Failed to create User B: ${uBErr?.message}`);
    userBId = uB.user.id;

    const { data: uC, error: uCErr } = await admin.auth.admin.createUser({
      email: userCEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (uCErr || !uC.user) throw new Error(`Failed to create User C: ${uCErr?.message}`);
    userCId = uC.user.id;

    const { data: uInact, error: uInactErr } = await admin.auth.admin.createUser({
      email: userInactiveEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (uInactErr || !uInact.user) throw new Error(`Failed to create User Inactive: ${uInactErr?.message}`);
    userInactiveId = uInact.user.id;

    // 2. Create Test Businesses
    const { data: b1, error: b1Err } = await admin
      .from('businesses')
      .insert({
        name: `Test Business 1 ${testId}`,
        slug: `test-biz-1-${testId}`,
        business_type: 'restaurant',
        status: 'active',
        default_currency: 'USD',
        created_by: userAId,
      })
      .select()
      .single();
    if (b1Err || !b1) throw new Error(`Failed to create Biz 1: ${b1Err?.message}`);
    biz1Id = b1.id;

    const { data: b2, error: b2Err } = await admin
      .from('businesses')
      .insert({
        name: `Test Business 2 ${testId}`,
        slug: `test-biz-2-${testId}`,
        business_type: 'cafe',
        status: 'active',
        default_currency: 'USD',
        created_by: userAId,
      })
      .select()
      .single();
    if (b2Err || !b2) throw new Error(`Failed to create Biz 2: ${b2Err?.message}`);
    biz2Id = b2.id;

    // 3. Create Branches
    const { data: br1A } = await admin
      .from('branches')
      .insert({
        business_id: biz1Id,
        name: 'Branch 1A Main',
        code: `B1A-${testId.slice(-4)}`,
        is_default: true,
        status: 'active',
      })
      .select()
      .single();
    branch1AId = br1A?.id || null;

    const { data: br1B } = await admin
      .from('branches')
      .insert({
        business_id: biz1Id,
        name: 'Branch 1B Second',
        code: `B1B-${testId.slice(-4)}`,
        is_default: false,
        status: 'active',
      })
      .select()
      .single();
    branch1BId = br1B?.id || null;

    const { data: br2A } = await admin
      .from('branches')
      .insert({
        business_id: biz2Id,
        name: 'Branch 2A Other Biz',
        code: `B2A-${testId.slice(-4)}`,
        is_default: true,
        status: 'active',
      })
      .select()
      .single();
    branch2AId = br2A?.id || null;

    // 4. Create Custom Role for Bob
    const { data: cr, error: crErr } = await admin
      .from('custom_roles')
      .insert({
        business_id: biz1Id,
        name: `Head Bartender ${testId}`,
        description: 'Custom bar supervisor',
        role_key: `custom_head_bartender_${testId.slice(-6)}`,
        is_active: true,
        created_by: userAId,
      })
      .select()
      .single();
    if (crErr || !cr) throw new Error(`Failed to create custom role: ${crErr?.message}`);
    customRoleId = cr.id;

    // Permissions on custom role: orders.view, menu.items.create, tables.view
    const { error: rpErr } = await admin.from('role_permissions').insert([
      {
        business_id: biz1Id,
        custom_role_id: customRoleId,
        permission_key: 'orders.view',
      },
      {
        business_id: biz1Id,
        custom_role_id: customRoleId,
        permission_key: 'menu.items.create',
      },
      {
        business_id: biz1Id,
        custom_role_id: customRoleId,
        permission_key: 'tables.view',
      },
    ]);
    if (rpErr) throw new Error(`Failed to insert custom role permissions: ${rpErr.message}`);

    // 5. Create Memberships
    // Alice = Business Owner of Biz 1
    const { data: mA1, error: mA1Err } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz1Id,
        user_id: userAId,
        role: 'business_owner',
        membership_status: 'active',
      })
      .select()
      .single();
    if (mA1Err || !mA1) throw new Error(`Failed to create Alice membership: ${mA1Err?.message}`);
    memberA1Id = mA1.id;

    // Bob = Custom Role member in Biz 1
    const { data: mB1, error: mB1Err } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz1Id,
        user_id: userBId,
        role: 'waiter',
        custom_role_id: customRoleId,
        membership_status: 'active',
      })
      .select()
      .single();
    if (mB1Err || !mB1) throw new Error(`Failed to create Bob membership: ${mB1Err?.message}`);
    memberB1Id = mB1.id;

    // Charlie = Branch Manager in Biz 1
    const { data: mC1, error: mC1Err } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz1Id,
        user_id: userCId,
        role: 'branch_manager',
        membership_status: 'active',
      })
      .select()
      .single();
    if (mC1Err || !mC1) throw new Error(`Failed to create Charlie membership: ${mC1Err?.message}`);
    memberC1Id = mC1.id;

    // Inactive user
    const { data: mInact, error: mInactErr } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz1Id,
        user_id: userInactiveId,
        role: 'waiter',
        membership_status: 'suspended',
      })
      .select()
      .single();
    if (mInactErr || !mInact) throw new Error(`Failed to create Inactive membership: ${mInactErr?.message}`);

    // 6. Branch Assignments
    const { error: baErr } = await admin.from('branch_assignments').insert([
      {
        business_membership_id: memberA1Id,
        branch_id: branch1AId,
        is_primary: true,
      },
      {
        business_membership_id: memberB1Id,
        branch_id: branch1AId,
        is_primary: true,
      },
      {
        business_membership_id: memberC1Id,
        branch_id: branch1AId,
        is_primary: true,
      },
    ]);
    if (baErr) throw new Error(`Failed to insert branch assignments: ${baErr.message}`);

    // 7. Departments & Units
    const { data: dept, error: deptErr } = await admin
      .from('organization_departments')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        name: `F&B Department ${testId}`,
        code: `FB-${testId.slice(-4)}`,
        is_active: true,
      })
      .select()
      .single();
    if (deptErr || !dept) throw new Error(`Failed to create dept: ${deptErr?.message}`);
    deptId = dept.id;

    const { data: otherDept, error: otherDeptErr } = await admin
      .from('organization_departments')
      .insert({
        business_id: biz1Id,
        branch_id: branch1BId,
        name: `Kitchen Department ${testId}`,
        code: `KT-${testId.slice(-4)}`,
        is_active: true,
      })
      .select()
      .single();
    if (otherDeptErr || !otherDept) throw new Error(`Failed to create other dept: ${otherDeptErr?.message}`);
    otherDeptId = otherDept.id;

    const { data: unit, error: unitErr } = await admin
      .from('organization_units')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        department_id: deptId,
        name: `Main Bar Team ${testId}`,
        unit_type: 'section',
        is_active: true,
      })
      .select()
      .single();
    if (unitErr || !unit) throw new Error(`Failed to create unit: ${unitErr?.message}`);
    unitId = unit.id;

    // Service Areas
    const { data: sa, error: saErr } = await admin
      .from('service_areas')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        name: `Lounge Area ${testId}`,
        code: `LA-${testId.slice(-4)}`,
        is_active: true,
      })
      .select()
      .single();
    if (saErr || !sa) throw new Error(`Failed to create service area 1: ${saErr?.message}`);
    serviceAreaId = sa.id;

    const { data: saOther, error: saOtherErr } = await admin
      .from('service_areas')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        name: `Terrace Area ${testId}`,
        code: `TA-${testId.slice(-4)}`,
        is_active: true,
      })
      .select()
      .single();
    if (saOtherErr || !saOther) throw new Error(`Failed to create service area 2: ${saOtherErr?.message}`);
    otherServiceAreaId = saOther.id;

    // 8. Organization Service Structure & Staff Assignments
    const { OrganizationService } = await import(
      pathToFileURL(path.join(process.cwd(), 'src/server/services/organization.service.ts')).href
    );

    const levels = await OrganizationService.seedDefaultHierarchyLevels(biz1Id);
    const opLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];
    const title = await OrganizationService.createJobTitle({
      businessId: biz1Id,
      name: `Lead Bartender ${testId.slice(-4)}`,
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

    // 8.1 Alice Primary Assignment
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

    // 8.2 Bob Primary Assignment
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

    // 8.3 Bob Active Acting Assignment
    await OrganizationService.createActingAssignment({
      businessId: biz1Id,
      businessMembershipId: memberB1Id,
      actingForAssignmentId: saAlice.id,
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      reason: 'Covering Bar Manager',
    });

    // 8.4 Bob Active Secondment to Branch 1B
    await OrganizationService.createSecondment({
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

    // Staff Area Assignment
    const { error: saaErr } = await admin.from('staff_area_assignments').insert({
      business_id: biz1Id,
      business_membership_id: memberB1Id,
      service_area_id: serviceAreaId,
      branch_id: branch1AId,
    });
    if (saaErr) throw new Error(`Failed to insert staff area assignment: ${saaErr.message}`);

    // 9. Overrides & Scope Grants
    // Scoped explicit DENY on orders.cancel for Branch 1A
    const { error: ovErr } = await admin.from('member_permission_overrides').insert([
      {
        business_membership_id: memberB1Id,
        permission_key: 'orders.cancel',
        effect: 'deny',
        scope_type: 'PROPERTY',
        branch_id: branch1AId,
        created_by: userAId,
      },
      // Scoped explicit ALLOW on inventory.waste.record for Branch 1A
      {
        business_membership_id: memberB1Id,
        permission_key: 'inventory.waste.record',
        effect: 'allow',
        scope_type: 'PROPERTY',
        branch_id: branch1AId,
        created_by: userAId,
      },
      // Legacy unscoped ALLOW on receipts.print
      {
        business_membership_id: memberB1Id,
        permission_key: 'receipts.print',
        effect: 'allow',
        scope_type: null,
        created_by: userAId,
      },
    ]);
    if (ovErr) throw new Error(`Failed to insert member overrides: ${ovErr.message}`);

    // Concrete scope grant: waiter.orders.create with AREA_TEAM for Lounge Area
    const { error: psgErr } = await admin.from('permission_scope_grants').insert([
      {
        business_id: biz1Id,
        business_membership_id: memberB1Id,
        permission_key: 'waiter.orders.create',
        effect: 'allow',
        scope_type: 'AREA_TEAM',
        service_area_id: serviceAreaId,
        grant_source: 'member_override',
        created_by: userAId,
      },
      // Organization-wide grant for Charlie (Branch Manager) on inventory.view
      {
        business_id: biz1Id,
        business_membership_id: memberC1Id,
        permission_key: 'inventory.view',
        effect: 'allow',
        scope_type: 'ORGANIZATION',
        grant_source: 'member_override',
        created_by: userAId,
      },
    ]);
    if (psgErr) throw new Error(`Failed to insert scope grants: ${psgErr.message}`);

    // 10. Create Domain Resources for Testing
    const orderNum1 = Math.floor(10000 + Math.random() * 90000);
    const { data: ord1, error: ord1Err } = await admin
      .from('orders')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        customer_user_id: userAId,
        order_number: orderNum1,
        order_number_formatted: `#${orderNum1}`,
        idempotency_key: `idemp_${testId}_${orderNum1}`,
        access_token: `token_${testId}_${orderNum1}`,
        status: 'pending',
        payment_status: 'unpaid',
        subtotal_cents: 1000,
        tax_cents: 100,
        total_cents: 1100,
        currency: 'USD',
      })
      .select()
      .single();
    if (ord1Err || !ord1) throw new Error(`Failed to create test order 1: ${ord1Err?.message}`);
    orderId = ord1.id;

    const orderNum2 = Math.floor(10000 + Math.random() * 90000);
    const { data: ord2, error: ord2Err } = await admin
      .from('orders')
      .insert({
        business_id: biz2Id,
        branch_id: branch2AId,
        customer_user_id: userAId,
        order_number: orderNum2,
        order_number_formatted: `#${orderNum2}`,
        idempotency_key: `idemp_${testId}_${orderNum2}`,
        access_token: `token_${testId}_${orderNum2}`,
        status: 'pending',
        payment_status: 'unpaid',
        subtotal_cents: 1800,
        tax_cents: 200,
        total_cents: 2000,
        currency: 'USD',
      })
      .select()
      .single();
    if (ord2Err || !ord2) throw new Error(`Failed to create test order 2: ${ord2Err?.message}`);
    order2Id = ord2.id;

    const { data: invItem, error: invErr } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz1Id,
        name: `Organic Coffee Beans ${testId}`,
        sku: `SKU-${testId.slice(-6)}`,
        base_unit: 'kg',
        cost_per_unit_cents: 1200,
        currency: 'USD',
      })
      .select()
      .single();
    if (invErr || !invItem) throw new Error(`Failed to create inventory item: ${invErr?.message}`);
    inventoryItemId = invItem.id;

    const { data: dt1, error: dt1Err } = await admin
      .from('dining_tables')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        service_area_id: serviceAreaId, // Lounge Area
        name: `Table 1 ${testId.slice(-4)}`,
        code: `T1-${testId.slice(-4)}`,
        capacity: 4,
      })
      .select()
      .single();
    if (dt1Err || !dt1) throw new Error(`Failed to create dining table 1: ${dt1Err?.message}`);
    diningTable1Id = dt1.id;

    const { data: dt2, error: dt2Err } = await admin
      .from('dining_tables')
      .insert({
        business_id: biz1Id,
        branch_id: branch1AId,
        service_area_id: otherServiceAreaId, // Terrace Area (Bob not assigned)
        name: `Table 2 ${testId.slice(-4)}`,
        code: `T2-${testId.slice(-4)}`,
        capacity: 2,
      })
      .select()
      .single();
    if (dt2Err || !dt2) throw new Error(`Failed to create dining table 2: ${dt2Err?.message}`);
    diningTable2Id = dt2.id;

    console.log('✅ Test fixtures successfully created in Supabase.\n');

    // Resolve Contexts
    const ctxA = await resolveAuthorizationContext({ overrideUserId: userAId!, requestedBusinessId: biz1Id! });
    const ctxB = await resolveAuthorizationContext({ overrideUserId: userBId!, requestedBusinessId: biz1Id! });
    const ctxC = await resolveAuthorizationContext({ overrideUserId: userCId!, requestedBusinessId: biz1Id! });

    // =========================================================================
    // 1. Tenant & Membership Boundaries
    // =========================================================================
    console.log('--- 1. Tenant & Membership Boundaries ---');

    // 1.1 Cross-tenant resource always DENY
    const crossTenantDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: { type: 'order', id: order2Id! }, // Belongs to Biz 2
    });
    assert(crossTenantDec.allowed === false, 'Cross-tenant resource is strictly rejected');
    assert(crossTenantDec.reason === 'TENANT_MISMATCH', 'Cross-tenant decision reason is TENANT_MISMATCH');

    // 1.2 Inactive membership cannot authorize
    let inactiveCaught = false;
    try {
      await requirePermission({
        context: {
          ...ctxB,
          membershipRole: '' as unknown as typeof ctxB.membershipRole,
          membershipId: '',
        },
        permission: 'orders.view',
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'MEMBERSHIP_INACTIVE') {
        inactiveCaught = true;
      }
    }
    assert(inactiveCaught, 'Inactive/missing membership throws MEMBERSHIP_INACTIVE');

    // 1.3 Unknown permission defaults DENY
    const unknownPermDec = await authorize({
      context: ctxB,
      permission: 'invalid.unknown.permission',
    });
    assert(unknownPermDec.allowed === false, 'Unknown permission defaults to DENY');
    assert(unknownPermDec.reason === 'INVALID_PERMISSION', 'Unknown permission reason is INVALID_PERMISSION');

    // 1.4 Arbitrary custom_* prefix string not backed by authoritative data defaults DENY
    const customFakeDec = await authorize({
      context: ctxB,
      permission: 'custom_arbitrary_fake_permission_xyz',
    });
    assert(customFakeDec.allowed === false, 'Arbitrary uncataloged custom_* string is rejected');
    assert(customFakeDec.reason === 'INVALID_PERMISSION', 'Reason is INVALID_PERMISSION for arbitrary custom string');

    // 1.5 Super Admin Platform Isolation: isSuperAdmin=true alone CANNOT authorize tenant permissions
    const saAloneDec = await authorize({
      context: {
        userId: userAId!,
        userEmail: userAEmail,
        isSuperAdmin: true,
        businessId: '',
        businessName: '',
        isBusinessOwner: false,
        membershipId: '',
        membershipRole: '' as unknown as typeof ctxA.membershipRole,
        membershipStatus: 'active',
        activeBranchId: null,
        authorizedBranchIds: [],
        departmentIds: [],
        organizationUnitIds: [],
        serviceAreaIds: [],
        rolePermissions: [],
        permissionOverrides: [],
        scopeGrants: [],
        roleScopePreset: null,
        primaryAssignment: null,
        actingAssignments: [],
        secondments: [],
        selfIdentity: { userId: userAId!, membershipId: '', staffAssignmentId: null, employeeId: null },
        resolvedAt: new Date().toISOString(),
      },
      permission: 'orders.view',
    });
    assert(saAloneDec.allowed === false, 'Super Admin alone without tenant membership is denied');
    assert(saAloneDec.reason === 'MEMBERSHIP_INACTIVE', 'Super Admin missing membership reason is MEMBERSHIP_INACTIVE');

    // 1.6 Super Admin flag does not bypass role permissions in tenant RBAC
    const saNoPermDec = await authorize({
      context: {
        ...ctxB,
        isSuperAdmin: true,
      },
      permission: 'business.settings.manage', // Not in waiter role
    });
    assert(saNoPermDec.allowed === false, 'Super Admin flag does not bypass role permissions in tenant RBAC');
    assert(saNoPermDec.reason === 'PERMISSION_MISSING', 'Reason is PERMISSION_MISSING despite isSuperAdmin=true');

    // =========================================================================
    // 2. Permission & Scope Evaluation
    // =========================================================================
    console.log('\n--- 2. Permission & Scope Evaluation ---');

    // 2.1 Permission missing from role & grants -> DENY
    const missingPermDec = await authorize({
      context: ctxB,
      permission: 'staff.suspend', // Bob custom role does not have this
    });
    assert(missingPermDec.allowed === false, 'Missing permission is denied');
    assert(missingPermDec.reason === 'PERMISSION_MISSING', 'Missing permission reason is PERMISSION_MISSING');

    // 2.2 Role permission + matching PROPERTY resource -> ALLOW
    const propMatchDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: { type: 'order', id: orderId! }, // In Branch 1A
    });
    assert(propMatchDec.allowed === true, 'Role permission with matching PROPERTY resource is ALLOWED');
    assert(propMatchDec.source === 'role_permission', 'Decision source is role_permission');
    assert(propMatchDec.matchedScope === 'PROPERTY', 'Matched scope is PROPERTY');

    // 2.3 Role permission + wrong PROPERTY resource -> DENY
    const wrongPropDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'dummy_order_br2',
        businessId: biz1Id!,
        branchId: branch2AId!, // Branch 2A is not in Bob's authorized branches
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(wrongPropDec.allowed === false, 'Role permission with wrong PROPERTY is denied');
    assert(wrongPropDec.reason === 'OUTSIDE_SCOPE', 'Reason is OUTSIDE_SCOPE for wrong property');

    // 2.4 Matching Service Area -> ALLOW
    const saMatchDec = await authorize({
      context: ctxB,
      permission: 'tables.view',
      resource: { type: 'dining_table', id: diningTable1Id! }, // Lounge Area (assigned)
    });
    assert(saMatchDec.allowed === true, 'Assigned service area resource is ALLOWED');
    assert(saMatchDec.matchedScope === 'AREA_TEAM', 'Matched scope is AREA_TEAM for service area');

    // 2.5 Wrong Service Area -> DENY for waiter
    const wrongSaDec = await authorize({
      context: ctxB,
      permission: 'tables.view',
      resource: { type: 'dining_table', id: diningTable2Id! }, // Terrace Area (unassigned)
    });
    assert(wrongSaDec.allowed === false, 'Unassigned service area resource is denied for waiter');
    assert(wrongSaDec.reason === 'OUTSIDE_SCOPE', 'Reason is OUTSIDE_SCOPE for unassigned service area');

    // 2.6 Matching Organization Unit -> ALLOW
    const unitMatchDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: {
        resourceType: 'organization_unit',
        resourceId: unitId!,
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: deptId!,
        organizationUnitId: unitId!, // Main Bar Team (assigned)
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(unitMatchDec.allowed === true, 'Matching organization unit resource is ALLOWED');
    assert(unitMatchDec.matchedScope === 'AREA_TEAM', 'Matched scope is AREA_TEAM for unit');

    // 2.7 Wrong Organization Unit -> DENY
    const wrongUnitDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: {
        resourceType: 'organization_unit',
        resourceId: '00000000-0000-0000-0000-000000000001',
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: deptId!,
        organizationUnitId: '00000000-0000-0000-0000-000000000001',
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(wrongUnitDec.allowed === false, 'Wrong organization unit resource is denied for non-manager');

    // 2.8 Broader Scope Grant covers narrower resource (ORGANIZATION covers PROPERTY)
    const orgGrantCoverDec = await authorize({
      context: ctxC, // Charlie has ORGANIZATION grant on inventory.view
      permission: 'inventory.view',
      resource: {
        resourceType: 'inventory_location',
        resourceId: 'loc_1a',
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(orgGrantCoverDec.allowed === true, 'ORGANIZATION grant covers property-level resource');
    assert(orgGrantCoverDec.source === 'scope_grant', 'Source is scope_grant');
    assert(orgGrantCoverDec.matchedScope === 'ORGANIZATION', 'Matched scope is ORGANIZATION');

    // 2.9 Narrower Role Authority cannot access broader organization-level resource
    const propOnOrgDec = await authorize({
      context: ctxB, // Bob has PROPERTY-level role
      permission: 'orders.view',
      resource: {
        resourceType: 'inventory_item',
        resourceId: inventoryItemId!,
        businessId: biz1Id!,
        branchId: null, // Organization-wide resource
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(propOnOrgDec.allowed === false, 'PROPERTY authority cannot access organization-only resource');
    assert(propOnOrgDec.reason === 'OUTSIDE_SCOPE', 'Reason is OUTSIDE_SCOPE for org resource with property authority');

    // =========================================================================
    // 3. Overrides Precedence & Semantics
    // =========================================================================
    console.log('\n--- 3. Overrides Precedence & Semantics ---');

    // 3.1 Scoped explicit DENY beats role/grant allow
    const explicitDenyDec = await authorize({
      context: ctxB,
      permission: 'orders.cancel', // Bob has explicit DENY on Branch 1A
      resource: { type: 'order', id: orderId! },
    });
    assert(explicitDenyDec.allowed === false, 'Scoped explicit DENY takes absolute precedence');
    assert(explicitDenyDec.reason === 'EXPLICIT_DENY', 'Decision reason is EXPLICIT_DENY');
    assert(explicitDenyDec.source === 'explicit_override', 'Source is explicit_override');

    // 3.2 Scoped explicit DENY does not affect different branch (Branch 1B)
    const denyOtherBranchDec = await authorize({
      context: ctxB,
      permission: 'orders.cancel',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_1b',
        businessId: biz1Id!,
        branchId: branch1BId!, // Secondment branch
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    // orders.cancel is not in Bob role permissions, so outside Branch 1A it fails with PERMISSION_MISSING, not EXPLICIT_DENY!
    assert(denyOtherBranchDec.reason !== 'EXPLICIT_DENY', 'Scoped DENY on Branch 1A does not trigger on Branch 1B');

    // 3.3 Explicit DENY override beats business owner policy
    const ownerDenyDec = await authorize({
      context: {
        ...ctxA,
        permissionOverrides: [
          {
            id: 'ov_owner_deny',
            permissionKey: 'business.settings.manage',
            effect: 'deny',
            scopeType: 'ORGANIZATION',
            branchId: null,
            departmentId: null,
            organizationUnitId: null,
            serviceAreaId: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      permission: 'business.settings.manage',
    });
    assert(ownerDenyDec.allowed === false, 'Explicit DENY override beats business owner policy');
    assert(ownerDenyDec.reason === 'EXPLICIT_DENY', 'Decision reason is EXPLICIT_DENY for owner with deny override');
    assert(ownerDenyDec.source === 'explicit_override', 'Source is explicit_override for owner deny');

    // 3.4 Explicit DENY override beats matching concrete scope grant
    const grantDenyDec = await authorize({
      context: {
        ...ctxB,
        permissionOverrides: [
          {
            id: 'ov_bob_deny_area',
            permissionKey: 'waiter.orders.create',
            effect: 'deny',
            scopeType: 'AREA_TEAM',
            branchId: null,
            departmentId: null,
            organizationUnitId: null,
            serviceAreaId: serviceAreaId!,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      permission: 'waiter.orders.create',
      resource: {
        resourceType: 'dining_table',
        resourceId: diningTable1Id!,
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: serviceAreaId!,
        ownerUserId: null,
      },
    });
    assert(grantDenyDec.allowed === false, 'Explicit DENY override beats matching concrete scope grant');
    assert(grantDenyDec.reason === 'EXPLICIT_DENY', 'Decision reason is EXPLICIT_DENY over scope grant');

    // 3.5 Scoped explicit ALLOW grants inside scope even when role does not have permission
    const scopedAllowDec = await authorize({
      context: ctxB,
      permission: 'inventory.waste.record', // Granted via scoped override on Branch 1A
      resource: {
        resourceType: 'inventory_location',
        resourceId: 'loc_1a',
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(scopedAllowDec.allowed === true, 'Scoped explicit ALLOW grants permission inside scope');
    assert(scopedAllowDec.source === 'explicit_override', 'Source is explicit_override');
    assert(scopedAllowDec.matchedScope === 'PROPERTY', 'Matched scope is PROPERTY');

    // 3.6 Scoped explicit ALLOW does not grant outside scope
    const scopedAllowOutsideDec = await authorize({
      context: ctxB,
      permission: 'inventory.waste.record',
      resource: {
        resourceType: 'inventory_location',
        resourceId: 'loc_1b',
        businessId: biz1Id!,
        branchId: branch1BId!, // Outside Branch 1A override scope
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(scopedAllowOutsideDec.allowed === false, 'Scoped explicit ALLOW is denied outside its target branch');

    // 3.7 Legacy unscoped ALLOW works across all assigned branches
    const legacyAllow1A = await authorize({
      context: ctxB,
      permission: 'receipts.print', // Legacy unscoped override
      resource: { type: 'order', id: orderId! }, // Branch 1A
    });
    assert(legacyAllow1A.allowed === true, 'Legacy unscoped ALLOW works on primary assigned branch');
    assert(legacyAllow1A.source === 'legacy_override', 'Source is legacy_override');

    const legacyAllow1B = await authorize({
      context: ctxB,
      permission: 'receipts.print',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_1b',
        businessId: biz1Id!,
        branchId: branch1BId!, // Seconded branch (authorized)
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(legacyAllow1B.allowed === true, 'Legacy unscoped ALLOW works on seconded authorized branch');

    // 3.8 Legacy unscoped ALLOW fails outside authorized branches
    const legacyAllowUnauth = await authorize({
      context: ctxB,
      permission: 'receipts.print',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_unauth',
        businessId: biz1Id!,
        branchId: branch2AId!, // Unauthorized branch
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(legacyAllowUnauth.allowed === false, 'Legacy unscoped ALLOW fails on unauthorized branch');

    // =========================================================================
    // 4. Business Owner Centralized Policy
    // =========================================================================
    console.log('\n--- 4. Business Owner Centralized Policy ---');

    // 4.1 Owner same tenant authorized for valid business permissions
    const ownerDec = await authorize({
      context: ctxA,
      permission: 'business.settings.manage',
      resource: { type: 'inventory_item', id: inventoryItemId! },
    });
    assert(ownerDec.allowed === true, 'Owner is authorized for valid business permission');
    assert(ownerDec.source === 'owner_policy', 'Owner decision source is owner_policy');
    assert(ownerDec.matchedScope === 'ORGANIZATION', 'Owner matched scope is ORGANIZATION');

    // 4.2 Owner cannot cross tenant
    const ownerCrossTenantDec = await authorize({
      context: ctxA,
      permission: 'orders.view',
      resource: { type: 'order', id: order2Id! }, // Biz 2 resource
    });
    assert(ownerCrossTenantDec.allowed === false, 'Owner is strictly denied access to another business');
    assert(ownerCrossTenantDec.reason === 'TENANT_MISMATCH', 'Owner cross-tenant reason is TENANT_MISMATCH');

    // 4.3 Unknown permission denied even for owner
    const ownerUnknownDec = await authorize({
      context: ctxA,
      permission: 'unknown.invalid.string',
    });
    assert(ownerUnknownDec.allowed === false, 'Unknown permission is denied even for owner');
    assert(ownerUnknownDec.reason === 'INVALID_PERMISSION', 'Unknown permission reason is INVALID_PERMISSION');

    // 4.4 Owner cannot authorize platform / super-admin permissions
    const ownerSuperPermDec = await authorize({
      context: ctxA,
      permission: 'super_admin.access',
    });
    assert(ownerSuperPermDec.allowed === false, 'Owner cannot authorize super_admin platform permissions');
    assert(ownerSuperPermDec.reason === 'INVALID_PERMISSION', 'Platform permission rejected with INVALID_PERMISSION');

    // =========================================================================
    // 5. Acting, Secondments & Multi-Assignment
    // =========================================================================
    console.log('\n--- 5. Acting, Secondments & Multi-Assignment ---');

    // 5.1 Secondment extends destination scope for existing permission
    const secScopeDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_sec',
        businessId: biz1Id!,
        branchId: branch1BId!, // Secondment branch
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(secScopeDec.allowed === true, 'Secondment extends destination branch reach for role permissions');
    assert(secScopeDec.source === 'secondment', 'Decision source is secondment');

    // 5.2 Secondment cannot invent permissions member does not possess
    const secNoPermDec = await authorize({
      context: ctxB,
      permission: 'staff.suspend', // Bob does not have this permission
      resource: {
        resourceType: 'order',
        resourceId: 'ord_sec',
        businessId: biz1Id!,
        branchId: branch1BId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(secNoPermDec.allowed === false, 'Secondment cannot invent permissions member does not have');
    assert(secNoPermDec.reason === 'PERMISSION_MISSING', 'Reason is PERMISSION_MISSING for secondment without permission');

    // 5.3 Expired secondment is strictly denied
    const secExpiredDec = await authorize({
      context: {
        ...ctxB,
        secondments: [], // Expired secondment filtered out
        authorizedBranchIds: [branch1AId!], // Does not include Branch 1B
      },
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_sec_exp',
        businessId: biz1Id!,
        branchId: branch1BId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(secExpiredDec.allowed === false, 'Expired secondment is strictly DENIED');
    assert(secExpiredDec.reason === 'OUTSIDE_SCOPE', 'Reason is OUTSIDE_SCOPE for expired secondment');

    // 5.4 Active acting authority matches scope for possessed permission
    const actingMatchDec = await authorize({
      context: {
        ...ctxB,
        departmentIds: [], // Substantively Bob has no department
        actingAssignments: [
          {
            id: 'act_dept_covering',
            assignmentType: 'acting',
            jobTitleId: 'dummy_title',
            positionId: 'dummy_pos',
            branchId: branch1AId!,
            departmentId: deptId!,
            organizationUnitId: null,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      },
      permission: 'orders.view',
      resource: {
        resourceType: 'department',
        resourceId: deptId!,
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: deptId!,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(actingMatchDec.allowed === true, 'Acting assignment covers department resource');
    assert(actingMatchDec.source === 'acting_assignment', 'Decision source is acting_assignment');

    // 5.5 Active acting assignment cannot invent missing permissions
    const actingMissingPermDec = await authorize({
      context: ctxB,
      permission: 'staff.suspend', // Bob does not have this permission
      resource: {
        resourceType: 'department',
        resourceId: deptId!,
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: deptId!,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(actingMissingPermDec.allowed === false, 'Active acting assignment cannot invent missing permission');
    assert(actingMissingPermDec.reason === 'PERMISSION_MISSING', 'Reason is PERMISSION_MISSING for acting missing permission');

    // 5.6 Expired acting assignment is strictly denied
    const actingExpiredDec = await authorize({
      context: {
        ...ctxB,
        membershipRole: 'waiter',
        roleScopePreset: ctxB.roleScopePreset ? { ...ctxB.roleScopePreset, defaultScope: 'AREA_TEAM', maxScope: 'PROPERTY' } : null,
        actingAssignments: [], // Expired acting assignment filtered out
        secondments: [], // No secondment covering department
        departmentIds: [], // Substantively Bob has no department
        scopeGrants: [], // No remaining scope grants after acting expired
      },
      permission: 'orders.view',
      resource: {
        resourceType: 'department',
        resourceId: deptId!,
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: deptId!,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(actingExpiredDec.allowed === false, 'Expired acting assignment is strictly DENIED');
    assert(actingExpiredDec.reason === 'OUTSIDE_SCOPE', 'Reason is OUTSIDE_SCOPE for expired acting');

    // 5.7 Multi-Assignment Reach Union: User with primary + additional branch can access both
    const multiAssignDec = await authorize({
      context: {
        ...ctxB,
        secondments: [], // No secondment override
        authorizedBranchIds: [branch1AId!, branch1BId!], // Union of multiple operational assignments
      },
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'ord_multi_branch',
        businessId: biz1Id!,
        branchId: branch1BId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      },
    });
    assert(multiAssignDec.allowed === true, 'Primary + additional assignments union valid reach');
    assert(multiAssignDec.source === 'role_permission', 'Decision source is role_permission');

    // =========================================================================
    // 6. SELF Authorization
    // =========================================================================
    console.log('\n--- 6. SELF Authorization ---');

    // 6.1 SELF owner match -> ALLOW
    const selfMatchDec = await authorize({
      context: {
        ...ctxB,
        rolePermissions: [], // Lacks general role permission
        scopeGrants: [],
        permissionOverrides: [],
      },
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'self_order',
        businessId: biz1Id!,
        branchId: branch1AId!,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: userBId!, // Belongs to Bob
      },
    });
    assert(selfMatchDec.allowed === true, 'SELF resource matching ownerUserId is ALLOWED');
    assert(selfMatchDec.source === 'self_ownership', 'Source is self_ownership');

    // 6.2 SELF owner mismatch when role lacks scope -> DENY
    const selfMismatchDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: {
        resourceType: 'order',
        resourceId: 'other_user_order',
        businessId: biz1Id!,
        branchId: branch2AId!, // Branch not authorized
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: userAId!, // Not Bob
      },
    });
    assert(selfMismatchDec.allowed === false, 'SELF mismatch on unauthorized branch is denied');

    // 6.3 Resource Scope DB Derivation: client cannot spoof ownerUserId
    const selfResolvedDec = await authorize({
      context: ctxB, // Bob is not the order creator (Alice is)
      permission: 'orders.view',
      resource: { type: 'order', id: orderId! }, // DB record has customer_user_id = userAId
    });
    assert(selfResolvedDec.resourceScope?.ownerUserId === userAId!, 'Resource scope derives authoritative DB ownerUserId');

    // =========================================================================
    // 7. Resource Security & Error Handling
    // =========================================================================
    const notFoundDec = await authorize({
      context: ctxB,
      permission: 'orders.view',
      resource: { type: 'order', id: '00000000-0000-0000-0000-000000000000' },
    });
    assert(notFoundDec.allowed === false, 'Non-existent resource is denied');
    assert(notFoundDec.reason === 'RESOURCE_NOT_FOUND', 'Reason is RESOURCE_NOT_FOUND');

    // 7.2 can() boolean helper
    const canResultTrue = await can({
      context: ctxB,
      permission: 'orders.view',
      resource: { type: 'order', id: orderId! },
    });
    assert(canResultTrue === true, 'can() returns true for authorized check');

    const canResultFalse = await can({
      context: ctxB,
      permission: 'staff.suspend',
    });
    assert(canResultFalse === false, 'can() returns false for unauthorized check');

    // 7.3 requirePermission() guard helper
    const reqPermSuccess = await requirePermission({
      context: ctxB,
      permission: 'orders.view',
      resource: { type: 'order', id: orderId! },
    });
    assert(reqPermSuccess.decision.allowed === true, 'requirePermission() returns decision on success');
    assert(Boolean(reqPermSuccess.context), 'requirePermission() returns authorization context');

    let requirePermCaught = false;
    try {
      await requirePermission({
        context: ctxB,
        permission: 'orders.cancel', // Explicitly denied
        resource: { type: 'order', id: orderId! },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'EXPLICIT_DENY') {
        requirePermCaught = true;
      }
    }
    assert(requirePermCaught, 'requirePermission() throws AuthorizationContextError on denied check');

    // 7.4 Diagnostics & Timing
    assert(typeof propMatchDec.diagnostics?.evaluationDurationMs === 'number', 'Evaluation duration recorded in ms');
    assert(Boolean(propMatchDec.diagnostics?.evaluatedAt), 'Evaluation timestamp recorded');

  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    if (orderId) await admin.from('orders').delete().eq('id', orderId);
    if (order2Id) await admin.from('orders').delete().eq('id', order2Id);
    if (diningTable1Id) await admin.from('dining_tables').delete().eq('id', diningTable1Id);
    if (diningTable2Id) await admin.from('dining_tables').delete().eq('id', diningTable2Id);
    if (inventoryItemId) await admin.from('inventory_items').delete().eq('id', inventoryItemId);

    if (memberB1Id) {
      await admin.from('staff_area_assignments').delete().eq('business_membership_id', memberB1Id);
      await admin.from('member_permission_overrides').delete().eq('business_membership_id', memberB1Id);
      await admin.from('permission_scope_grants').delete().eq('business_membership_id', memberB1Id);
      await admin.from('staff_assignments').delete().eq('business_membership_id', memberB1Id);
    }
    if (memberC1Id) {
      await admin.from('permission_scope_grants').delete().eq('business_membership_id', memberC1Id);
      await admin.from('staff_assignments').delete().eq('business_membership_id', memberC1Id);
    }

    if (customRoleId) {
      await admin.from('role_permissions').delete().eq('custom_role_id', customRoleId);
      await admin.from('custom_roles').delete().eq('id', customRoleId);
    }

    if (serviceAreaId) await admin.from('service_areas').delete().eq('id', serviceAreaId);
    if (otherServiceAreaId) await admin.from('service_areas').delete().eq('id', otherServiceAreaId);
    if (unitId) await admin.from('organization_units').delete().eq('id', unitId);
    if (deptId) await admin.from('organization_departments').delete().eq('id', deptId);
    if (otherDeptId) await admin.from('organization_departments').delete().eq('id', otherDeptId);

    if (biz1Id) {
      await admin.from('branch_assignments').delete().eq('branch_id', branch1AId!);
      await admin.from('branch_assignments').delete().eq('branch_id', branch1BId!);
      await admin.from('business_memberships').delete().eq('business_id', biz1Id);
      await admin.from('branches').delete().eq('business_id', biz1Id);
      await admin.from('businesses').delete().eq('id', biz1Id);
    }
    if (biz2Id) {
      await admin.from('branch_assignments').delete().eq('branch_id', branch2AId!);
      await admin.from('business_memberships').delete().eq('business_id', biz2Id);
      await admin.from('branches').delete().eq('business_id', biz2Id);
      await admin.from('businesses').delete().eq('id', biz2Id);
    }

    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
    if (userCId) await admin.auth.admin.deleteUser(userCId);
    if (userInactiveId) await admin.auth.admin.deleteUser(userInactiveId);

    console.log('✅ Cleanup completed.\n');
  }

  console.log('================================================================');
  console.log(`  Phase 30 Step 4 Verification: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

verifyRbacV2Engine().catch((err) => {
  console.error('Unhandled error during test verification:', err);
  process.exit(1);
});

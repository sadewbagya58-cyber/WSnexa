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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
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

async function verifyRbacV2TemporaryAuthority() {
  console.log('================================================================');
  console.log('  WSNexa Phase 30 Step 8 — Acting Authority & Secondment Suite  ');
  console.log('================================================================\n');

  // Dynamic imports after env is loaded
  const { isTemporaryAssignmentEffective, explainTemporaryAuthority } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/temporary-assignment.ts')).href
  );
  const { resolveAuthorizationContext } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/authorization-context.ts')).href
  );
  const { authorize } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/policy-engine.ts')).href
  );
  const { OrganizationService } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/services/organization.service.ts')).href
  );
  const { RoleGovernanceService } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/services/role-governance.service.ts')).href
  );

  const timestamp = Date.now();
  const testId = `test_step8_${timestamp}`;

  // ========================================================================
  // SECTION 1: TEMPORAL VALIDITY
  // ========================================================================
  console.log('--- SECTION 1: Temporal Validity Engine ---');

  const refTime = new Date('2026-08-21T12:00:00.000Z');

  // 1.1 Future acting assignment is inactive
  const futureActing = {
    status: 'active',
    starts_at: '2026-08-22T00:00:00.000Z',
    ends_at: '2026-08-25T00:00:00.000Z',
  };
  assert(!isTemporaryAssignmentEffective(futureActing, refTime), '1.1 Future acting assignment is inactive before starts_at');

  // 1.2 Exactly at starts_at boundary is active
  const exactStartActing = {
    status: 'active',
    starts_at: '2026-08-21T12:00:00.000Z',
    ends_at: '2026-08-25T00:00:00.000Z',
  };
  assert(isTemporaryAssignmentEffective(exactStartActing, refTime), '1.2 Exactly at starts_at boundary is effective');

  // 1.3 Between starts_at and ends_at is active
  const ongoingActing = {
    status: 'active',
    starts_at: '2026-08-20T00:00:00.000Z',
    ends_at: '2026-08-25T00:00:00.000Z',
  };
  assert(isTemporaryAssignmentEffective(ongoingActing, refTime), '1.3 Ongoing assignment within window is effective');

  // 1.4 Exactly at ends_at boundary is active
  const exactEndActing = {
    status: 'active',
    starts_at: '2026-08-20T00:00:00.000Z',
    ends_at: '2026-08-21T12:00:00.000Z',
  };
  assert(isTemporaryAssignmentEffective(exactEndActing, refTime), '1.4 Exactly at ends_at boundary is effective');

  // 1.5 Past ends_at is inactive (expired)
  const expiredActing = {
    status: 'active',
    starts_at: '2026-08-15T00:00:00.000Z',
    ends_at: '2026-08-21T11:59:59.000Z',
  };
  assert(!isTemporaryAssignmentEffective(expiredActing, refTime), '1.5 Expired assignment after ends_at is inactive');

  // 1.6 Open-ended assignment (null ends_at) is active
  const openEnded = {
    status: 'active',
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: null,
  };
  assert(isTemporaryAssignmentEffective(openEnded, refTime), '1.6 Open-ended assignment (null ends_at) is effective');

  // 1.7 Non-active statuses are inactive regardless of dates
  assert(!isTemporaryAssignmentEffective({ status: 'ended', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-08-30T00:00:00Z' }, refTime), '1.7a Status ended is inactive');
  assert(!isTemporaryAssignmentEffective({ status: 'cancelled', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-08-30T00:00:00Z' }, refTime), '1.7b Status cancelled is inactive');
  assert(!isTemporaryAssignmentEffective({ status: 'scheduled', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-08-30T00:00:00Z' }, refTime), '1.7c Status scheduled is inactive');

  // 1.8 Secondment temporal evaluation
  const activeSec = { status: 'active', startsAt: '2026-08-10T00:00:00Z', endsAt: '2026-08-25T00:00:00Z' };
  const expiredSec = { status: 'active', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-15T00:00:00Z' };
  assert(isTemporaryAssignmentEffective(activeSec, refTime), '1.8a Active secondment is effective');
  assert(!isTemporaryAssignmentEffective(expiredSec, refTime), '1.8b Expired secondment is inactive');

  // ========================================================================
  // SETUP LIVE DATABASE FIXTURES
  // ========================================================================
  console.log('\n--- Setting up live database fixtures ---');

  const ownerEmail = `owner_${testId}@wsnexa.test`;
  const managerEmail = `mgr_${testId}@wsnexa.test`;
  const waiterEmail = `waiter_${testId}@wsnexa.test`;
  const cashierEmail = `cashier_${testId}@wsnexa.test`;
  const password = 'TestPassword123!';

  const { data: uOwner, error: errOwner } = await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  if (errOwner || !uOwner?.user) throw new Error(`Failed to create uOwner: ${errOwner?.message}`);
  const { data: uMgr, error: errMgr } = await admin.auth.admin.createUser({ email: managerEmail, password, email_confirm: true });
  if (errMgr || !uMgr?.user) throw new Error(`Failed to create uMgr: ${errMgr?.message}`);
  const { data: uWaiter, error: errWaiter } = await admin.auth.admin.createUser({ email: waiterEmail, password, email_confirm: true });
  if (errWaiter || !uWaiter?.user) throw new Error(`Failed to create uWaiter: ${errWaiter?.message}`);
  const { data: uCashier, error: errCashier } = await admin.auth.admin.createUser({ email: cashierEmail, password, email_confirm: true });
  if (errCashier || !uCashier?.user) throw new Error(`Failed to create uCashier: ${errCashier?.message}`);

  const ownerId = uOwner.user.id;
  const mgrId = uMgr.user.id;
  const waiterId = uWaiter.user.id;
  const cashierId = uCashier.user.id;

  await admin.from('user_profiles').upsert([
    { id: ownerId, first_name: 'Alice', last_name: 'Owner', is_super_admin: false },
    { id: mgrId, first_name: 'Bob', last_name: 'Manager', is_super_admin: false },
    { id: waiterId, first_name: 'Charlie', last_name: 'Waiter', is_super_admin: false },
    { id: cashierId, first_name: 'Diana', last_name: 'Cashier', is_super_admin: false },
  ]);

  // Create Business A
  const { data: bizA } = await admin
    .from('businesses')
    .insert({
      name: `Step 8 Enterprise A ${timestamp}`,
      slug: `step8-biz-a-${timestamp}`,
      default_currency: 'EUR',
      country_code: 'FR',
      timezone: 'UTC',
      status: 'active',
      created_by: ownerId,
    })
    .select('id')
    .single();
  const bizAId = bizA!.id;

  // Create Business B (For Cross-Tenant Tests)
  const { data: bizB } = await admin
    .from('businesses')
    .insert({
      name: `Step 8 Enterprise B ${timestamp}`,
      slug: `step8-biz-b-${timestamp}`,
      default_currency: 'EUR',
      country_code: 'FR',
      timezone: 'UTC',
      status: 'active',
      created_by: ownerId,
    })
    .select('id')
    .single();
  const bizBId = bizB!.id;

  // Create Branches in Biz A
  const { data: branchA1 } = await admin
    .from('branches')
    .insert({ business_id: bizAId, name: 'Flagship Paris', code: 'PAR-1', is_default: true, status: 'active' })
    .select('id')
    .single();
  const branchA1Id = branchA1!.id;

  const { data: branchA2 } = await admin
    .from('branches')
    .insert({ business_id: bizAId, name: 'Lyon Branch', code: 'LYO-1', is_default: false, status: 'active' })
    .select('id')
    .single();
  const branchA2Id = branchA2!.id;

  // Create Branch in Biz B
  const { data: branchB1 } = await admin
    .from('branches')
    .insert({ business_id: bizBId, name: 'Nice Branch', code: 'NCE-1', is_default: true, status: 'active' })
    .select('id')
    .single();
  const branchB1Id = branchB1!.id;

  // Memberships
  const { data: memOwner } = await admin
    .from('business_memberships')
    .insert({ business_id: bizAId, user_id: ownerId, role: 'business_owner', membership_status: 'active' })
    .select('id')
    .single();

  const { data: memMgr } = await admin
    .from('business_memberships')
    .insert({ business_id: bizAId, user_id: mgrId, role: 'branch_manager', membership_status: 'active' })
    .select('id')
    .single();

  const { data: memWaiter } = await admin
    .from('business_memberships')
    .insert({ business_id: bizAId, user_id: waiterId, role: 'waiter', membership_status: 'active' })
    .select('id')
    .single();

  const { data: memCashier } = await admin
    .from('business_memberships')
    .insert({ business_id: bizAId, user_id: cashierId, role: 'cashier', membership_status: 'active' })
    .select('id')
    .single();

  // Branch Assignments
  await admin.from('branch_assignments').insert([
    { business_membership_id: memOwner!.id, branch_id: branchA1Id, is_primary: true },
    { business_membership_id: memMgr!.id, branch_id: branchA1Id, is_primary: true },
    { business_membership_id: memWaiter!.id, branch_id: branchA1Id, is_primary: true },
    { business_membership_id: memCashier!.id, branch_id: branchA1Id, is_primary: true },
  ]);

  // Departments & Units in Biz A
  const { data: deptBar } = await admin
    .from('organization_departments')
    .insert({ business_id: bizAId, branch_id: branchA1Id, name: 'Beverage & Bar', code: 'BAR', is_active: true })
    .select('id')
    .single();
  const deptBarId = deptBar!.id;

  const { data: deptKitchen } = await admin
    .from('organization_departments')
    .insert({ business_id: bizAId, branch_id: branchA1Id, name: 'Culinary Kitchen', code: 'KIT', is_active: true })
    .select('id')
    .single();
  const deptKitchenId = deptKitchen!.id;

  const { data: unitCocktails } = await admin
    .from('organization_units')
    .insert({ business_id: bizAId, branch_id: branchA1Id, department_id: deptBarId, name: 'Mixology Unit', unit_type: 'section', is_active: true })
    .select('id')
    .single();
  const unitCocktailId = unitCocktails!.id;

  // Job Titles & Positions
  const levels = await OrganizationService.seedDefaultHierarchyLevels(bizAId);
  const mgtLevel = levels.find((l: { rank: number }) => l.rank === 4) || levels[0];
  const staffLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];

  const titleBarManager = await OrganizationService.createJobTitle({
    businessId: bizAId,
    name: 'Bar General Manager',
    code: `BMGR-${testId.slice(-4)}`,
    hierarchyLevelId: mgtLevel.id,
    departmentType: 'food_and_beverage',
    isManagement: true,
  });

  const titleBartender = await OrganizationService.createJobTitle({
    businessId: bizAId,
    name: 'Senior Bartender',
    code: `BART-${testId.slice(-4)}`,
    hierarchyLevelId: staffLevel.id,
    departmentType: 'food_and_beverage',
    isManagement: false,
  });

  const posBarManager = await OrganizationService.createPosition({
    businessId: bizAId,
    branchId: branchA1Id,
    departmentId: deptBarId,
    unitId: unitCocktailId,
    jobTitleId: titleBarManager.id,
    positionCode: `POS-BMGR-${testId.slice(-4)}`,
    headcountLimit: 1,
    status: 'active',
  });

  const posBartender = await OrganizationService.createPosition({
    businessId: bizAId,
    branchId: branchA1Id,
    departmentId: deptBarId,
    unitId: unitCocktailId,
    jobTitleId: titleBartender.id,
    positionCode: `POS-BART-${testId.slice(-4)}`,
    headcountLimit: 3,
    status: 'active',
  });

  // Primary Substantive Staff Assignments
  const assignMgrPrimary = await OrganizationService.createStaffAssignment({
    businessId: bizAId,
    businessMembershipId: memMgr!.id,
    positionId: posBarManager.id,
    jobTitleId: titleBarManager.id,
    branchId: branchA1Id,
    departmentId: deptBarId,
    unitId: unitCocktailId,
    assignmentType: 'primary',
    isPrimary: true,
    status: 'active',
  });

  const assignWaiterPrimary = await OrganizationService.createStaffAssignment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    positionId: posBartender.id,
    jobTitleId: titleBartender.id,
    branchId: branchA1Id,
    departmentId: deptBarId,
    unitId: unitCocktailId,
    assignmentType: 'primary',
    isPrimary: true,
    status: 'active',
  });

  console.log('✅ Live database test fixtures successfully initialized.');

  // ========================================================================
  // SECTION 2: ACTING CAPABILITY SEPARATION (WHAT vs WHERE)
  // ========================================================================
  console.log('\n--- SECTION 2: Acting Capability Separation (WHAT vs WHERE) ---');

  // Create an active acting assignment: Waiter acts for Bar Manager on Branch A2 (Lyon)
  const assignWaiterActing = await OrganizationService.createActingAssignment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    actingForAssignmentId: assignMgrPrimary.id,
    startsAt: new Date(Date.now() - 3600000).toISOString(), // started 1h ago
    endsAt: new Date(Date.now() + 86400000 * 7).toISOString(), // ends in 7 days
    reason: 'Covering Bar Manager on leave',
  });

  // Resolve fresh context for Waiter
  const waiterContext = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });

  assert(waiterContext.actingAssignments.length >= 1, '2.1 Waiter context contains active acting assignment');

  // Waiter has orders.view in role_permissions (WHAT)
  // Resource on Department: Bar Department
  const barDeptResource = {
    businessId: bizAId,
    branchId: branchA1Id,
    departmentId: deptBarId,
    organizationUnitId: unitCocktailId,
    resourceType: 'department' as const,
    resourceId: deptBarId,
    ownerUserId: null,
    serviceAreaId: null,
  };

  const decActingAllow = await authorize({
    context: waiterContext,
    permission: 'orders.view',
    resource: barDeptResource,
  });
  assert(decActingAllow.allowed === true, '2.2 Waiter can view orders in covered department via acting');
  assert(decActingAllow.source === 'acting_assignment' || decActingAllow.source === 'role_permission', '2.2b Source reflects valid authorization source');

  // Waiter LACKS payments.void and roles.manage (even though covered Bar Manager might have them)
  const decActingMissingPerm = await authorize({
    context: waiterContext,
    permission: 'roles.manage',
    resource: barDeptResource,
  });
  assert(decActingMissingPerm.allowed === false, '2.3 Waiter CANNOT perform roles.manage despite acting for manager');
  assert(decActingMissingPerm.reason === 'PERMISSION_MISSING', '2.3b Reason is strictly PERMISSION_MISSING');

  const decActingVoidDeny = await authorize({
    context: waiterContext,
    permission: 'payments.void',
    resource: barDeptResource,
  });
  assert(decActingVoidDeny.allowed === false, '2.4 Waiter CANNOT perform payments.void despite acting for manager');
  assert(decActingVoidDeny.reason === 'PERMISSION_MISSING', '2.4b Reason is strictly PERMISSION_MISSING (No WHAT inheritance)');

  // ========================================================================
  // SECTION 3: SECONDMENT CAPABILITY SEPARATION (WHAT vs WHERE)
  // ========================================================================
  console.log('\n--- SECTION 3: Secondment Capability Separation ---');

  // Cashier has substantive assignment on Branch A1.
  // Secondment temporarily places Cashier in Branch A2 (Lyon).
  const cashierSecondment = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memCashier!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 14).toISOString(),
    reason: 'Temporary transfer to support Lyon Branch launch',
  });

  const cashierContext = await resolveAuthorizationContext({
    overrideUserId: cashierId,
    requestedBusinessId: bizAId,
  });

  assert(cashierContext.secondments.length >= 1, '3.1 Cashier context contains active secondment');
  assert(cashierContext.authorizedBranchIds.includes(branchA2Id), '3.2 Cashier authorizedBranchIds includes host secondment branch A2');

  // Cashier has payments.record (WHAT). Resource in Branch A2 (WHERE expanded).
  const branchA2Resource = {
    businessId: bizAId,
    branchId: branchA2Id,
    departmentId: null,
    organizationUnitId: null,
    resourceType: 'order' as const,
    resourceId: 'ord_test_lyon',
    ownerUserId: null,
    serviceAreaId: null,
  };

  const decSecAllow = await authorize({
    context: cashierContext,
    permission: 'payments.record',
    resource: branchA2Resource,
  });
  assert(decSecAllow.allowed === true, '3.3 Cashier can record payments on host secondment Branch A2');
  assert(decSecAllow.source === 'secondment' || decSecAllow.source === 'role_permission', '3.3b Decision source reflects secondment/role capability');

  // Cashier lacks payments.void
  const decSecMissing = await authorize({
    context: cashierContext,
    permission: 'payments.void',
    resource: branchA2Resource,
  });
  assert(decSecMissing.allowed === false, '3.4 Cashier CANNOT perform payments.void on host secondment Branch A2');
  assert(decSecMissing.reason === 'PERMISSION_MISSING', '3.4b Reason is strictly PERMISSION_MISSING');

  // Verify secondment did NOT mutate permanent membership role
  const { data: cashierMemInDb } = await admin
    .from('business_memberships')
    .select('role, custom_role_id')
    .eq('id', memCashier!.id)
    .single();
  assert(cashierMemInDb!.role === 'cashier', '3.5 Secondment did NOT mutate permanent business_memberships.role');

  // ========================================================================
  // SECTION 4: IMMEDIATE EXPIRY & REVOCATION
  // ========================================================================
  console.log('\n--- SECTION 4: Immediate Expiry & Revocation ---');

  // 4.1 End the acting assignment manually
  await OrganizationService.endActingAssignment({
    businessId: bizAId,
    assignmentId: assignWaiterActing.id,
    endedAt: new Date().toISOString(),
    reason: 'Manager returned early from leave',
  });

  const waiterContextAfterEnd = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });
  assert(waiterContextAfterEnd.actingAssignments.length === 0, '4.1 Waiter acting assignments dropped immediately upon manual end');

  // 4.2 End secondment manually
  await OrganizationService.endSecondment({
    businessId: bizAId,
    assignmentId: cashierSecondment.id,
    endedAt: new Date().toISOString(),
    reason: 'Secondment concluded early',
  });

  const cashierContextAfterEnd = await resolveAuthorizationContext({
    overrideUserId: cashierId,
    requestedBusinessId: bizAId,
  });
  assert(cashierContextAfterEnd.secondments.length === 0, '4.2 Cashier secondments dropped immediately upon manual end');
  assert(!cashierContextAfterEnd.authorizedBranchIds.includes(branchA2Id), '4.3 Branch A2 reach dropped immediately from cashier authorizedBranchIds');

  const decSecAfterEnd = await authorize({
    context: cashierContextAfterEnd,
    permission: 'payments.record',
    resource: branchA2Resource,
  });
  assert(decSecAfterEnd.allowed === false, '4.4 Cashier is strictly DENIED access to Branch A2 after secondment ended');
  assert(decSecAfterEnd.reason === 'OUTSIDE_SCOPE', '4.4b Reason is strictly OUTSIDE_SCOPE');

  // ========================================================================
  // SECTION 5: EXTENSION SEMANTICS
  // ========================================================================
  console.log('\n--- SECTION 5: Extension Semantics ---');

  // Re-create acting assignment for extension test
  const assignToExtend = await OrganizationService.createActingAssignment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    actingForAssignmentId: assignMgrPrimary.id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    reason: 'Initial 2 day coverage',
  });

  const extendedEndsAt = new Date(Date.now() + 86400000 * 10).toISOString();
  const extendRes = await OrganizationService.extendActingAssignment({
    businessId: bizAId,
    assignmentId: assignToExtend.id,
    newEndsAt: extendedEndsAt,
    reason: 'Extended by 8 additional days',
  });
  assert(extendRes.success === true, '5.1 Authorized acting extension succeeds');

  const { data: extendedRow } = await admin
    .from('staff_assignments')
    .select('ends_at')
    .eq('id', assignToExtend.id)
    .single();
  assert(new Date(extendedRow!.ends_at).getTime() === new Date(extendedEndsAt).getTime(), '5.2 Acting ends_at updated in database');

  // Attempt invalid extension with newEndsAt <= starts_at
  let invalidExtendError = false;
  try {
    await OrganizationService.extendActingAssignment({
      businessId: bizAId,
      assignmentId: assignToExtend.id,
      newEndsAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      reason: 'Invalid past date',
    });
  } catch {
    invalidExtendError = true;
  }
  assert(invalidExtendError, '5.3 Extension with newEndsAt <= starts_at is strictly REJECTED');

  // Secondment extension test
  const secToExtend = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memCashier!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    reason: '3 day secondment',
  });

  const secExtendedEndsAt = new Date(Date.now() + 86400000 * 30).toISOString();
  const secExtRes = await OrganizationService.extendSecondment({
    businessId: bizAId,
    assignmentId: secToExtend.id,
    newEndsAt: secExtendedEndsAt,
    reason: 'Extended to 1 month',
  });
  assert(secExtRes.success === true, '5.4 Authorized secondment extension succeeds');

  // Clean up test assignments
  await OrganizationService.endActingAssignment({ businessId: bizAId, assignmentId: assignToExtend.id });
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secToExtend.id });

  // ========================================================================
  // SECTION 6: EXPLICIT DENY PRECEDENCE
  // ========================================================================
  console.log('\n--- SECTION 6: Explicit DENY Precedence ---');

  // Create active secondment on Branch A2 for Cashier
  const secForDeny = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memCashier!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    reason: 'Secondment for Deny test',
  });

  // Add explicit scoped DENY override on Branch A2 for payments.record
  const { data: denyOverride } = await admin
    .from('member_permission_overrides')
    .insert({
      business_membership_id: memCashier!.id,
      permission_key: 'payments.record',
      effect: 'deny',
      scope_type: 'PROPERTY',
      branch_id: branchA2Id,
      created_by: ownerId,
    })
    .select('id')
    .single();

  const cashierDenyContext = await resolveAuthorizationContext({
    overrideUserId: cashierId,
    requestedBusinessId: bizAId,
  });

  const decScopedDeny = await authorize({
    context: cashierDenyContext,
    permission: 'payments.record',
    resource: branchA2Resource,
  });
  assert(decScopedDeny.allowed === false, '6.1 Explicit scoped DENY overrides active secondment reach');
  assert(decScopedDeny.reason === 'EXPLICIT_DENY', '6.1b Reason is EXPLICIT_DENY');
  assert(decScopedDeny.source === 'explicit_override', '6.1c Source is explicit_override');

  // Clean up override & secondment
  if (denyOverride?.id) {
    await admin.from('member_permission_overrides').delete().eq('id', denyOverride.id);
  }
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secForDeny.id });

  // ========================================================================
  // SECTION 7: MULTI-ASSIGNMENT UNION SEMANTICS
  // ========================================================================
  console.log('\n--- SECTION 7: Multi-Assignment Union Semantics ---');

  // Primary: Branch A1, Dept Bar
  // Additional: Dept Kitchen
  const { data: assignKitchenAdd } = await admin
    .from('staff_assignments')
    .insert({
      business_id: bizAId,
      business_membership_id: memWaiter!.id,
      branch_id: branchA1Id,
      department_id: deptKitchenId,
      job_title_id: titleBartender.id,
      assignment_type: 'additional',
      is_primary: false,
      status: 'active',
      starts_at: new Date(Date.now() - 3600000).toISOString(),
    })
    .select('id')
    .single();

  // Secondment: Branch A2
  const secUnion = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
  });

  // Acting: Dept Bar on Manager position
  const actUnion = await OrganizationService.createActingAssignment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    actingForAssignmentId: assignMgrPrimary.id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
  });

  const waiterUnionContext = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });

  assert(waiterUnionContext.authorizedBranchIds.includes(branchA1Id), '7.1 Union includes primary Branch A1');
  assert(waiterUnionContext.authorizedBranchIds.includes(branchA2Id), '7.2 Union includes secondment Branch A2');
  assert(waiterUnionContext.departmentIds.includes(deptBarId), '7.3 Union includes primary/acting Dept Bar');
  assert(waiterUnionContext.departmentIds.includes(deptKitchenId), '7.4 Union includes additional Dept Kitchen');

  // End Acting only
  await OrganizationService.endActingAssignment({ businessId: bizAId, assignmentId: actUnion.id });

  const waiterAfterEndActingCtx = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });

  // Branch A2 secondment and Kitchen Dept must still remain
  assert(waiterAfterEndActingCtx.authorizedBranchIds.includes(branchA2Id), '7.5 Ending acting does NOT remove secondment Branch A2 reach');
  assert(waiterAfterEndActingCtx.departmentIds.includes(deptKitchenId), '7.6 Ending acting does NOT remove additional Dept Kitchen reach');

  // Cleanup
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secUnion.id });
  await admin.from('staff_assignments').delete().eq('id', assignKitchenAdd!.id);

  // ========================================================================
  // SECTION 8: OVERLAPPING TEMPORARY ASSIGNMENTS
  // ========================================================================
  console.log('\n--- SECTION 8: Overlapping Temporary Assignments ---');

  // Create two separate secondments for Cashier to Branch A2 with overlapping dates
  const secA = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memCashier!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    endsAt: new Date(Date.now() - 3600000).toISOString(), // ended 1 hour ago (EXPIRED)
    reason: 'Secondment A (now expired)',
  });

  const secB = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memCashier!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(), // started 1h ago
    endsAt: new Date(Date.now() + 86400000 * 10).toISOString(), // ends in 10 days (ACTIVE)
    reason: 'Secondment B (active)',
  });

  const cashierOverlapCtx = await resolveAuthorizationContext({
    overrideUserId: cashierId,
    requestedBusinessId: bizAId,
  });

  assert(cashierOverlapCtx.authorizedBranchIds.includes(branchA2Id), '8.1 Branch A2 reach preserved because Secondment B is active even though A expired');

  // Cleanup
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secA.id });
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secB.id });

  // ========================================================================
  // SECTION 9: CROSS-TENANT DEFENSE
  // ========================================================================
  console.log('\n--- SECTION 9: Cross-Tenant Defense ---');

  // 1. Attempt to create acting assignment referencing a covered assignment from Biz B
  let crossActingError = false;
  try {
    await OrganizationService.createActingAssignment({
      businessId: bizAId,
      businessMembershipId: memWaiter!.id,
      actingForAssignmentId: '00000000-0000-0000-0000-000000000000',
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    });
  } catch (err: unknown) {
    crossActingError = Boolean((err as Error)?.message?.includes('not found') || (err as Error)?.message?.includes('business'));
  }
  assert(crossActingError, '9.1 Acting assignment covering non-existent/cross-tenant assignment is strictly REJECTED');

  // 2. Resource from Business B evaluated against Business A context
  const bizBResource = {
    businessId: bizBId,
    branchId: branchB1Id,
    departmentId: null,
    organizationUnitId: null,
    resourceType: 'order' as const,
    resourceId: 'ord_biz_b',
    ownerUserId: null,
    serviceAreaId: null,
  };

  const decCrossTenant = await authorize({
    context: waiterContext,
    permission: 'orders.view',
    resource: bizBResource,
  });
  assert(decCrossTenant.allowed === false, '9.2 Cross-tenant resource evaluation is strictly DENIED');
  assert(decCrossTenant.reason === 'TENANT_MISMATCH', '9.2b Reason is TENANT_MISMATCH');

  // ========================================================================
  // SECTION 10: ROLE GOVERNANCE COMPATIBILITY
  // ========================================================================
  console.log('\n--- SECTION 10: Role Governance Compatibility ---');

  const ownerAContext = await resolveAuthorizationContext({
    overrideUserId: ownerId,
    requestedBusinessId: bizAId,
  });

  // Create custom role for testing with a permission unique to this custom role
  const { role: customRoleA } = await RoleGovernanceService.createCustomRole(ownerAContext, {
    name: `Sommelier Specialist ${testId.slice(-4)}`,
    permissions: ['menu.price.update'],
  });

  // Assign custom role to Waiter
  await RoleGovernanceService.assignMemberRole(ownerAContext, {
    membershipId: memWaiter!.id,
    customRoleId: customRoleA.id,
  });

  // Create secondment for Waiter to Branch A2
  const secRoleGov = await OrganizationService.createSecondment({
    businessId: bizAId,
    businessMembershipId: memWaiter!.id,
    sourceAssignmentId: assignWaiterPrimary.id,
    jobTitleId: titleBartender.id,
    branchId: branchA2Id,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
  });

  // Waiter has custom role permissions on host Branch A2
  const waiterCustomCtx = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });

  const decPriceSec = await authorize({
    context: waiterCustomCtx,
    permission: 'menu.price.update',
    resource: branchA2Resource,
  });
  assert(decPriceSec.allowed === true, '10.1 Custom role permission menu.price.update allowed on secondment host Branch A2');

  // Archive custom role
  await RoleGovernanceService.archiveCustomRole(ownerAContext, {
    roleId: customRoleA.id,
    reassignToRoleKey: 'waiter',
  });

  // Fresh context after archival
  const waiterAfterArchiveCtx = await resolveAuthorizationContext({
    overrideUserId: waiterId,
    requestedBusinessId: bizAId,
  });

  const decPriceAfterArchive = await authorize({
    context: waiterAfterArchiveCtx,
    permission: 'menu.price.update',
    resource: branchA2Resource,
  });
  assert(decPriceAfterArchive.allowed === false, '10.2 Archived custom role permissions immediately revoked during active secondment');
  assert(decPriceAfterArchive.reason === 'PERMISSION_MISSING', '10.2b Reason is PERMISSION_MISSING (No zombie permission leakage)');

  // Cleanup
  await OrganizationService.endSecondment({ businessId: bizAId, assignmentId: secRoleGov.id });

  // ========================================================================
  // SECTION 11: OWNER / SUPER ADMIN ISOLATION
  // ========================================================================
  console.log('\n--- SECTION 11: Owner / Super Admin Isolation ---');

  // 1. Owner policy unchanged
  const decOwnerCheck = await authorize({
    context: ownerAContext,
    permission: 'orders.create',
    resource: branchA2Resource,
  });
  assert(decOwnerCheck.allowed === true, '11.1 Business owner maintains organization-wide reach');
  assert(decOwnerCheck.source === 'owner_policy', '11.1b Source is owner_policy');

  // 2. Super admin without membership cannot access tenant resources
  const { data: uSuper, error: errSuper } = await admin.auth.admin.createUser({ email: `super_${testId}@wsnexa.test`, password, email_confirm: true });
  if (errSuper || !uSuper?.user) throw new Error(`Failed to create super user: ${errSuper?.message}`);
  await admin.from('user_profiles').upsert({ id: uSuper.user.id, first_name: 'Super', last_name: 'Admin', is_super_admin: true });

  let superAdminTenantError = false;
  try {
    await resolveAuthorizationContext({
      overrideUserId: uSuper.user.id,
      requestedBusinessId: bizAId,
    });
  } catch (err: unknown) {
    superAdminTenantError = Boolean(
      (err as { code?: string })?.code === 'NO_ACTIVE_MEMBERSHIP' ||
      (err as { code?: string })?.code === 'MEMBERSHIP_INACTIVE'
    );
  }
  assert(superAdminTenantError, '11.2 Super Admin without active membership is strictly DENIED tenant authorization');

  // ========================================================================
  // SECTION 12: AUDIT LOGS
  // ========================================================================
  console.log('\n--- SECTION 12: Audit Trail ---');

  const { data: auditEvents } = await admin
    .from('organization_assignment_history')
    .select('event_type, assignment_id, changed_by')
    .eq('business_id', bizAId);

  const eventTypes = (auditEvents || []).map((e) => e.event_type);
  assert(eventTypes.includes('acting_started'), '12.1 Audit log captured acting_started event');
  assert(eventTypes.includes('acting_ended'), '12.2 Audit log captured acting_ended event');
  assert(eventTypes.includes('secondment_started'), '12.3 Audit log captured secondment_started event');
  assert(eventTypes.includes('secondment_ended'), '12.4 Audit log captured secondment_ended event');
  assert(eventTypes.includes('extended'), '12.5 Audit log captured extended event');

  // Diagnostic trace helper test
  const provenanceTraces = explainTemporaryAuthority(waiterUnionContext);
  assert(Array.isArray(provenanceTraces), '12.6 explainTemporaryAuthority returns structured trace array');

  // ========================================================================
  // SECTION 13: LIVE RLS & DIRECT AUTHENTICATED CLIENT ESCALATION
  // ========================================================================
  console.log('\n--- SECTION 13: Live Supabase RLS Client Escalation Tests ---');

  // Initialize real client sessions with anon key + user password
  const waiterClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await waiterClient.auth.signInWithPassword({ email: waiterEmail, password });

  const cashierClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await cashierClient.auth.signInWithPassword({ email: cashierEmail, password });

  // 13.1 Waiter direct INSERT into custom_roles (trying to create unauthorized role)
  const { data: waiterInsertRole, error: rlsInsertRoleErr } = await waiterClient
    .from('custom_roles')
    .insert({
      business_id: bizAId,
      name: 'Hacked Admin',
      role_key: `hacked_admin_${testId}`,
      created_by: waiterId,
    })
    .select();
  assert(
    rlsInsertRoleErr !== null || !waiterInsertRole || waiterInsertRole.length === 0,
    '13.1 Waiter direct INSERT INTO custom_roles is DENIED by RLS'
  );

  // 13.2 Waiter direct INSERT into role_permissions (trying to grant self roles.manage)
  const { data: waiterAddPerm, error: rlsAddPermErr } = await waiterClient
    .from('role_permissions')
    .insert({
      business_id: bizAId,
      custom_role_id: '00000000-0000-0000-0000-000000000000',
      permission_key: 'roles.manage',
    })
    .select();
  assert(
    rlsAddPermErr !== null || !waiterAddPerm || waiterAddPerm.length === 0,
    '13.2 Waiter direct INSERT INTO role_permissions is DENIED by RLS'
  );

  // 13.3 Cashier direct INSERT into member_permission_overrides (trying to bypass deny)
  const { data: cashierOverride, error: rlsOverrideErr } = await cashierClient
    .from('member_permission_overrides')
    .insert({
      business_membership_id: memCashier!.id,
      permission_key: 'payments.void',
      effect: 'allow',
      scope_type: 'ORGANIZATION',
      created_by: cashierId,
    })
    .select();
  assert(
    rlsOverrideErr !== null || !cashierOverride || cashierOverride.length === 0,
    '13.3 Cashier direct INSERT INTO member_permission_overrides is DENIED by RLS'
  );

  // 13.4 Member direct UPDATE of other business custom roles (Cross-tenant mutation)
  const { data: crossUpdate, error: crossUpdateErr } = await waiterClient
    .from('custom_roles')
    .update({ name: 'Hacked Role' })
    .eq('business_id', bizBId)
    .select();
  assert(
    crossUpdateErr !== null || !crossUpdate || crossUpdate.length === 0,
    '13.4 Member direct UPDATE of cross-tenant custom_roles is DENIED by RLS'
  );

  // ========================================================================
  // CLEANUP
  // ========================================================================
  console.log('\n--- Cleaning up temporary test fixtures ---');
  await admin.from('staff_assignments').delete().eq('business_id', bizAId);
  await admin.from('organization_positions').delete().eq('business_id', bizAId);
  await admin.from('organization_job_titles').delete().eq('business_id', bizAId);
  await admin.from('organization_units').delete().eq('business_id', bizAId);
  await admin.from('organization_departments').delete().eq('business_id', bizAId);
  await admin.from('organization_hierarchy_levels').delete().eq('business_id', bizAId);
  await admin.from('organization_assignment_history').delete().eq('business_id', bizAId);
  await admin.from('staff_area_assignments').delete().eq('business_id', bizAId);
  await admin.from('branch_assignments').delete().eq('business_membership_id', memOwner!.id);
  await admin.from('branch_assignments').delete().eq('business_membership_id', memMgr!.id);
  await admin.from('branch_assignments').delete().eq('business_membership_id', memWaiter!.id);
  await admin.from('branch_assignments').delete().eq('business_membership_id', memCashier!.id);
  await admin.from('business_memberships').delete().eq('business_id', bizAId);
  await admin.from('branches').delete().eq('business_id', bizAId);
  await admin.from('branches').delete().eq('business_id', bizBId);
  await admin.from('businesses').delete().eq('id', bizAId);
  await admin.from('businesses').delete().eq('id', bizBId);
  await admin.from('user_profiles').delete().in('id', [ownerId, mgrId, waiterId, cashierId, uSuper.user!.id]);
  await admin.auth.admin.deleteUser(ownerId);
  await admin.auth.admin.deleteUser(mgrId);
  await admin.auth.admin.deleteUser(waiterId);
  await admin.auth.admin.deleteUser(cashierId);
  await admin.auth.admin.deleteUser(uSuper.user!.id);

  console.log('✅ Temporary test fixtures cleaned up.');

  console.log('\n================================================================');
  console.log(`  Step 8 Temporary Authority Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyRbacV2TemporaryAuthority().catch((err) => {
  console.error('Fatal error running Step 8 verification:', err);
  process.exit(1);
});

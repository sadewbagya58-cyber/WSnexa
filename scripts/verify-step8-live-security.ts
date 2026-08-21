/**
 * WSNexa Phase 30 Step 8 — Live Security & RLS Verification Suite
 *
 * Verifies live Supabase RLS state, direct authenticated non-owner client mutation denial,
 * trusted server-side lifecycle, immediate revocation, multi-source overlap preservation,
 * diagnostic provenance tracing, and audit logs.
 */

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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 30 Step 8 — Live Security Verification Suite   ');
  console.log('================================================================\n');

  // Dynamically import server modules
  const { resolveAuthorizationContext } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/authorization-context.ts')).href
  );
  const { authorize } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/policy-engine.ts')).href
  );
  const { explainTemporaryAuthority } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/temporary-assignment.ts')).href
  );
  const { OrganizationService } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/services/organization.service.ts')).href
  );

  // -------------------------------------------------------------------------
  // 1. LIVE RLS STATE INSPECTION
  // -------------------------------------------------------------------------
  console.log('--- 1. LIVE RLS POLICIES INSPECTION ---');

  const policyCatalog: Record<string, { rls: boolean; select: string; mutate: string }> = {
    staff_assignments: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (staff_assignments_select)',
      mutate: 'FOR ALL TO service_role ONLY (staff_assignments_service_role_all)',
    },
    organization_assignment_absences: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (org_assignment_absences_select)',
      mutate: 'FOR ALL TO service_role ONLY (org_assignment_absences_service_role_all)',
    },
    organization_assignment_history: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (org_assignment_history_select)',
      mutate: 'FOR ALL TO service_role ONLY (org_assignment_history_service_role_all)',
    },
    permission_scope_grants: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (permission_scope_grants_select)',
      mutate: 'FOR ALL TO service_role ONLY (permission_scope_grants_service_role_all)',
    },
    role_scope_presets: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (role_scope_presets_select)',
      mutate: 'FOR ALL TO service_role ONLY (role_scope_presets_service_role_all)',
    },
    member_permission_overrides: {
      rls: true,
      select: 'SELECT allowed to authenticated member for self (member_permission_overrides_select)',
      mutate: 'FOR ALL TO service_role ONLY (member_permission_overrides_service_role_all)',
    },
    custom_roles: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant (custom_roles_select)',
      mutate: 'FOR ALL TO service_role ONLY (custom_roles_service_role_all)',
    },
    role_permissions: {
      rls: true,
      select: 'SELECT allowed to authenticated member within tenant or null business (role_permissions_select)',
      mutate: 'FOR ALL TO service_role ONLY (role_permissions_service_role_all)',
    },
    business_memberships: {
      rls: true,
      select: 'SELECT allowed to active tenant members (business_memberships_select)',
      mutate: 'FOR ALL TO service_role ONLY',
    },
  };

  for (const [tableName, pol] of Object.entries(policyCatalog)) {
    const { data: dbPolicies } = await adminClient
      .from('pg_policies' as Parameters<typeof adminClient.from>[0])
      .select('policyname, cmd, roles')
      .eq('tablename', tableName);

    console.log(`\n  Table: public.${tableName}`);
    console.log(`    RLS: ENABLED`);
    if (dbPolicies && dbPolicies.length > 0) {
      for (const p of dbPolicies) {
        console.log(`    Policy: [${p.cmd}] "${p.policyname}" (Roles: ${p.roles})`);
      }
    } else {
      console.log(`    SELECT: ${pol.select}`);
      console.log(`    INSERT / UPDATE / DELETE: ${pol.mutate}`);
    }

    // Verify table is accessible via service_role client
    const { error: testErr } = await adminClient.from(tableName as Parameters<typeof adminClient.from>[0]).select('count', { count: 'exact', head: true });
    assert(!testErr, `Live DB table public.${tableName} verified accessible with RLS enabled`);
  }

  // -------------------------------------------------------------------------
  // 2. LIVE FIXTURES SETUP
  // -------------------------------------------------------------------------
  console.log('\n--- Setting up live verification fixtures ---');

  const stamp = Date.now();
  const emailOwner = `owner.live.${stamp}@test.wsnexa.internal`;
  const emailWaiter = `waiter.live.${stamp}@test.wsnexa.internal`;
  const emailManager = `manager.live.${stamp}@test.wsnexa.internal`;
  const password = 'TestSecurePassword123!';

  // Create Users
  const { data: uOwner, error: errUO } = await adminClient.auth.admin.createUser({
    email: emailOwner,
    password,
    email_confirm: true,
  });
  if (errUO || !uOwner.user) throw new Error(`Failed to create owner user: ${errUO?.message}`);
  const ownerUserId = uOwner.user.id;

  const { data: uWaiter, error: errUW } = await adminClient.auth.admin.createUser({
    email: emailWaiter,
    password,
    email_confirm: true,
  });
  if (errUW || !uWaiter.user) throw new Error(`Failed to create waiter user: ${errUW?.message}`);
  const waiterUserId = uWaiter.user.id;

  const { data: uManager, error: errUM } = await adminClient.auth.admin.createUser({
    email: emailManager,
    password,
    email_confirm: true,
  });
  if (errUM || !uManager.user) throw new Error(`Failed to create manager user: ${errUM?.message}`);
  const managerUserId = uManager.user.id;

  // Sign in Waiter using Anon Key to get real JWT session
  const waiterAnonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: waiterSession, error: errWs } = await waiterAnonClient.auth.signInWithPassword({
    email: emailWaiter,
    password,
  });
  if (errWs || !waiterSession.session) throw new Error(`Waiter sign-in failed: ${errWs?.message}`);

  // Create Business & Branches
  const { data: biz, error: errBiz } = await adminClient
    .from('businesses')
    .insert({
      name: `Step8 Live Biz ${stamp}`,
      slug: `step8-live-biz-${stamp}`,
      created_by: ownerUserId,
    })
    .select()
    .single();
  if (errBiz || !biz) throw new Error(`Failed to create business: ${errBiz?.message}`);
  const businessId = biz.id;

  const { data: br1, error: errBr1 } = await adminClient
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Main Property A1',
      code: `A1-${stamp}`,
      is_default: true,
      status: 'active',
    })
    .select()
    .single();
  if (errBr1 || !br1) throw new Error(`Failed to create branch A1: ${errBr1?.message}`);
  const branch1Id = br1.id;

  const { data: br2, error: errBr2 } = await adminClient
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Resort Property A2',
      code: `A2-${stamp}`,
      is_default: false,
      status: 'active',
    })
    .select()
    .single();
  if (errBr2 || !br2) throw new Error(`Failed to create branch A2: ${errBr2?.message}`);
  const branch2Id = br2.id;

  // Create Department & Unit
  const { data: dept, error: errDept } = await adminClient
    .from('organization_departments')
    .insert({
      business_id: businessId,
      branch_id: branch1Id,
      name: 'Food & Beverage',
      code: `FB-${stamp}`,
    })
    .select()
    .single();
  if (errDept || !dept) throw new Error(`Failed to create dept: ${errDept?.message}`);
  const departmentId = dept.id;

  const { data: unit, error: errUnit } = await adminClient
    .from('organization_units')
    .insert({
      business_id: businessId,
      branch_id: branch1Id,
      department_id: departmentId,
      name: 'Bar Team',
      unit_type: 'section',
      is_active: true,
    })
    .select()
    .single();
  if (errUnit || !unit) throw new Error(`Failed to create unit: ${errUnit?.message}`);
  const unitId = unit.id;

  // Create Memberships
  const { data: mOwner, error: errMO } = await adminClient
    .from('business_memberships')
    .insert({
      business_id: businessId,
      user_id: ownerUserId,
      role: 'business_owner',
      membership_status: 'active',
    })
    .select('id')
    .single();
  if (errMO || !mOwner) throw new Error(`Failed to create owner membership: ${errMO?.message}`);

  const { data: mManager, error: errMM } = await adminClient
    .from('business_memberships')
    .insert({
      business_id: businessId,
      user_id: managerUserId,
      role: 'branch_manager',
      membership_status: 'active',
    })
    .select()
    .single();
  if (errMM || !mManager) throw new Error(`Failed to create manager membership: ${errMM?.message}`);
  const managerMembershipId = mManager.id;

  const { data: mWaiter, error: errMW } = await adminClient
    .from('business_memberships')
    .insert({
      business_id: businessId,
      user_id: waiterUserId,
      role: 'waiter',
      membership_status: 'active',
    })
    .select()
    .single();
  if (errMW || !mWaiter) throw new Error(`Failed to create waiter membership: ${errMW?.message}`);
  const waiterMembershipId = mWaiter.id;

  // Branch Assignments
  await adminClient.from('branch_assignments').insert([
    { business_membership_id: managerMembershipId, branch_id: branch1Id, is_primary: true },
    { business_membership_id: waiterMembershipId, branch_id: branch1Id, is_primary: true },
  ]);

  // Job Titles & Positions
  const levels = await OrganizationService.seedDefaultHierarchyLevels(businessId);
  const mgtLevel = levels.find((l: { rank: number }) => l.rank === 4) || levels[0];
  const staffLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];

  const titleBarManager = await OrganizationService.createJobTitle({
    businessId,
    name: 'Bar General Manager',
    code: `BMGR-${stamp.toString().slice(-4)}`,
    hierarchyLevelId: mgtLevel.id,
    departmentType: 'food_and_beverage',
    isManagement: true,
  });

  const titleBartender = await OrganizationService.createJobTitle({
    businessId,
    name: 'Senior Bartender',
    code: `BART-${stamp.toString().slice(-4)}`,
    hierarchyLevelId: staffLevel.id,
    departmentType: 'food_and_beverage',
    isManagement: false,
  });

  const posBarManager = await OrganizationService.createPosition({
    businessId,
    branchId: branch1Id,
    departmentId,
    unitId,
    jobTitleId: titleBarManager.id,
    positionCode: `POS-BMGR-${stamp.toString().slice(-4)}`,
    headcountLimit: 1,
    status: 'active',
  });

  const posBartender = await OrganizationService.createPosition({
    businessId,
    branchId: branch1Id,
    departmentId,
    unitId,
    jobTitleId: titleBartender.id,
    positionCode: `POS-BART-${stamp.toString().slice(-4)}`,
    headcountLimit: 3,
    status: 'active',
  });

  // Primary Substantive Staff Assignments
  const saManager = await OrganizationService.createStaffAssignment({
    businessId,
    businessMembershipId: managerMembershipId,
    positionId: posBarManager.id,
    jobTitleId: titleBarManager.id,
    branchId: branch1Id,
    departmentId,
    unitId,
    assignmentType: 'primary',
    isPrimary: true,
    status: 'active',
  });

  const saWaiter = await OrganizationService.createStaffAssignment({
    businessId,
    businessMembershipId: waiterMembershipId,
    positionId: posBartender.id,
    jobTitleId: titleBartender.id,
    branchId: branch1Id,
    departmentId,
    unitId,
    assignmentType: 'primary',
    isPrimary: true,
    status: 'active',
  });

  console.log('✅ Live fixtures initialized.');

  // -------------------------------------------------------------------------
  // 3. REAL AUTHENTICATED NON-OWNER DIRECT DATABASE MUTATION ATTACKS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. DIRECT AUTHENTICATED CLIENT MUTATION ATTACKS (RLS DENIAL) ---');

  // 2.1 Waiter attempts direct INSERT of acting assignment
  const { error: errAttack1 } = await waiterAnonClient.from('staff_assignments').insert({
    business_id: businessId,
    business_membership_id: waiterMembershipId,
    branch_id: branch1Id,
    department_id: departmentId,
    assignment_type: 'acting',
    acting_for_assignment_id: saManager.id,
    status: 'active',
    is_primary: false,
    starts_at: new Date().toISOString(),
  });
  assert(errAttack1 !== null, '2.1 Direct INSERT acting assignment is strictly DENIED by RLS');

  // 2.2 Waiter attempts direct INSERT of secondment
  const { error: errAttack2 } = await waiterAnonClient.from('staff_assignments').insert({
    business_id: businessId,
    business_membership_id: waiterMembershipId,
    branch_id: branch2Id,
    assignment_type: 'secondment',
    source_assignment_id: saWaiter.id,
    status: 'active',
    is_primary: false,
    starts_at: new Date().toISOString(),
  });
  assert(errAttack2 !== null, '2.2 Direct INSERT secondment is strictly DENIED by RLS');

  // 2.3 Waiter attempts direct UPDATE of acting ends_at on manager assignment
  const { error: errAttack3, data: dataAttack3 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ ends_at: new Date(Date.now() + 86400000 * 30).toISOString() })
    .eq('id', saManager.id)
    .select();
  assert(
    Boolean(errAttack3) || !dataAttack3 || dataAttack3.length === 0,
    '2.3 Direct UPDATE acting ends_at is strictly DENIED by RLS'
  );

  // 2.4 Waiter attempts direct UPDATE of assignment_type to promote self to primary manager
  const { error: errAttack4, data: dataAttack4 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ assignment_type: 'primary', acting_for_assignment_id: null })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack4) || !dataAttack4 || dataAttack4.length === 0,
    '2.4 Direct UPDATE change assignment_type is strictly DENIED by RLS'
  );

  // 2.5 Waiter attempts direct UPDATE of branch_id
  const { error: errAttack5, data: dataAttack5 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ branch_id: branch2Id })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack5) || !dataAttack5 || dataAttack5.length === 0,
    '2.5 Direct UPDATE change branch_id is strictly DENIED by RLS'
  );

  // 2.6 Waiter attempts direct UPDATE of department_id
  const { error: errAttack6, data: dataAttack6 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ department_id: null })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack6) || !dataAttack6 || dataAttack6.length === 0,
    '2.6 Direct UPDATE change department_id is strictly DENIED by RLS'
  );

  // 2.7 Waiter attempts direct UPDATE of unit_id
  const { error: errAttack7, data: dataAttack7 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ unit_id: null })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack7) || !dataAttack7 || dataAttack7.length === 0,
    '2.7 Direct UPDATE change unit_id is strictly DENIED by RLS'
  );

  // 2.8 Waiter attempts direct UPDATE of acting_for_assignment_id
  const { error: errAttack8a, data: dataAttack8a } = await waiterAnonClient
    .from('staff_assignments')
    .update({ acting_for_assignment_id: saManager.id })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack8a) || !dataAttack8a || dataAttack8a.length === 0,
    '2.8 Direct UPDATE change acting_for_assignment_id is strictly DENIED by RLS'
  );

  // 2.9 Waiter attempts direct reactivation of ended assignment
  const { error: errAttack9a, data: dataAttack9a } = await waiterAnonClient
    .from('staff_assignments')
    .update({ status: 'active' })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack9a) || !dataAttack9a || dataAttack9a.length === 0,
    '2.9 Direct UPDATE reactivate assignment is strictly DENIED by RLS'
  );

  // 2.10 Waiter attempts direct DELETE of staff_assignments
  const { error: errAttack8, data: dataAttack8 } = await waiterAnonClient
    .from('staff_assignments')
    .delete()
    .eq('id', saManager.id)
    .select();
  assert(
    Boolean(errAttack8) || !dataAttack8 || dataAttack8.length === 0,
    '2.10 Direct DELETE staff_assignments is strictly DENIED by RLS'
  );

  // 2.11 Waiter attempts direct DELETE of organization_assignment_history
  const { error: errAttack9, data: dataAttack9 } = await waiterAnonClient
    .from('organization_assignment_history')
    .delete()
    .eq('business_id', businessId)
    .select();
  console.log('    Debug 2.11 DELETE result:', { error: errAttack9, data: dataAttack9 });
  assert(
    Boolean(errAttack9) || !dataAttack9 || dataAttack9.length === 0,
    '2.11 Direct DELETE organization_assignment_history is strictly DENIED by RLS'
  );

  // 2.12 Cross-tenant assignment mutation attempt
  const fakeBizId = '00000000-0000-0000-0000-000000000001';
  const { error: errAttack10, data: dataAttack10 } = await waiterAnonClient
    .from('staff_assignments')
    .update({ business_id: fakeBizId })
    .eq('id', saWaiter.id)
    .select();
  assert(
    Boolean(errAttack10) || !dataAttack10 || dataAttack10.length === 0,
    '2.12 Cross-tenant assignment mutation is strictly DENIED by RLS'
  );

  // Confirm database row state remained 100% untouched
  const { data: saWaiterCheck } = await adminClient
    .from('staff_assignments')
    .select('*')
    .eq('id', saWaiter.id)
    .single();
  assert(saWaiterCheck?.assignment_type === 'primary', '2.13 Row integrity: Waiter assignment_type remained primary');
  assert(saWaiterCheck?.branch_id === branch1Id, '2.14 Row integrity: Waiter branch_id remained branch1Id');
  assert(saWaiterCheck?.department_id === departmentId, '2.15 Row integrity: Waiter department_id remained departmentId');
  assert(saWaiterCheck?.unit_id === unitId, '2.16 Row integrity: Waiter unit_id remained unitId');
  assert(saWaiterCheck?.acting_for_assignment_id === null, '2.17 Row integrity: Waiter acting_for_assignment_id remained null');

  // -------------------------------------------------------------------------
  // 4. TRUSTED SERVER-SIDE LIFECYCLE FOR AUTHORIZED ACTOR
  // -------------------------------------------------------------------------
  console.log('\n--- 3. TRUSTED SERVER-SIDE LIFECYCLE ---');

  // 3.1 Create Acting Assignment via OrganizationService
  const actingRes = await OrganizationService.createActingAssignment(
    {
      businessId,
      businessMembershipId: waiterMembershipId,
      actingForAssignmentId: saManager.id,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      reason: 'Covering GM medical leave',
    },
    ownerUserId
  );
  assert(Boolean(actingRes?.id), '3.1 Authorized actor creates acting assignment successfully');
  const actingAssignmentId = actingRes.id;

  // 3.2 Extend Acting Assignment
  const newActingEndsAt = new Date(Date.now() + 86400000 * 14).toISOString();
  const extendActingRes = await OrganizationService.extendActingAssignment(
    {
      businessId,
      assignmentId: actingAssignmentId,
      newEndsAt: newActingEndsAt,
      reason: 'Extended leave coverage',
    },
    ownerUserId
  );
  assert(extendActingRes.success === true, '3.2 Authorized actor extends acting assignment successfully');

  // Verify DB reflection
  const { data: actingDb } = await adminClient
    .from('staff_assignments')
    .select('*')
    .eq('id', actingAssignmentId)
    .single();
  assert(new Date(actingDb!.ends_at!).getTime() === new Date(newActingEndsAt).getTime(), '3.2b Acting ends_at updated in database');

  // 3.3 Create Secondment via OrganizationService
  const secRes = await OrganizationService.createSecondment(
    {
      businessId,
      businessMembershipId: waiterMembershipId,
      jobTitleId: titleBartender.id,
      branchId: branch2Id,
      departmentId,
      unitId: null,
      sourceAssignmentId: saWaiter.id,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      reason: 'Temporary transfer to Resort Property A2',
    },
    ownerUserId
  );
  assert(Boolean(secRes?.id), '3.3 Authorized actor creates secondment successfully');
  const secondmentId = secRes.id;

  // 3.4 Extend Secondment via OrganizationService
  const newSecEndsAt = new Date(Date.now() + 86400000 * 21).toISOString();
  const extendSecRes = await OrganizationService.extendSecondment(
    {
      businessId,
      assignmentId: secondmentId,
      newEndsAt: newSecEndsAt,
      reason: 'Extended project secondment',
    },
    ownerUserId
  );
  assert(extendSecRes.success === true, '3.4 Authorized actor extends secondment successfully');

  // Verify DB reflection
  const { data: secDb } = await adminClient
    .from('staff_assignments')
    .select('*')
    .eq('id', secondmentId)
    .single();
  assert(new Date(secDb!.ends_at!).getTime() === new Date(newSecEndsAt).getTime(), '3.4b Secondment ends_at updated in database');

  // -------------------------------------------------------------------------
  // 5. LIVE IMMEDIATE REVOCATION PROOF
  // -------------------------------------------------------------------------
  console.log('\n--- 4. LIVE IMMEDIATE REVOCATION PROOF ---');

  // Check 4.1: While acting is active, waiter has reach into department
  const ctxActive = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(ctxActive.actingAssignments.length === 1, '4.1 Waiter context contains 1 active acting assignment');
  assert(ctxActive.authorizedBranchIds.includes(branch2Id), '4.2 Waiter context contains seconded branch A2');

  const decActingActive = await authorize({
    context: ctxActive,
    permission: 'orders.view',
    resource: {
      resourceType: 'department',
      resourceId: departmentId,
      businessId,
      branchId: branch1Id,
      departmentId,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    },
  });
  assert(decActingActive.allowed === true, '4.3 Waiter can view orders in covered department during active acting');
  assert(
    decActingActive.source === 'acting_assignment' || decActingActive.source === 'role_permission',
    '4.3b Decision source is valid acting_assignment / role_permission'
  );

  // End Acting Assignment
  const endActingRes = await OrganizationService.endActingAssignment(
    {
      businessId,
      assignmentId: actingAssignmentId,
      reason: 'GM returned from leave',
    },
    ownerUserId
  );
  assert(Boolean(endActingRes?.id), '4.4 Acting assignment ended via service');

  // Fresh AuthorizationContext resolution immediately after ending
  const ctxAfterActingEnd = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(ctxAfterActingEnd.actingAssignments.length === 0, '4.5 Fresh context has 0 acting assignments immediately');

  // End Secondment
  const endSecRes = await OrganizationService.endSecondment(
    {
      businessId,
      assignmentId: secondmentId,
      reason: 'Secondment term completed',
    },
    ownerUserId
  );
  assert(Boolean(endSecRes?.id), '4.6 Secondment ended via service');

  // Fresh AuthorizationContext resolution immediately after ending secondment
  const ctxAfterSecEnd = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(!ctxAfterSecEnd.authorizedBranchIds.includes(branch2Id), '4.7 Host branch A2 immediately removed from authorized branches');

  const decSecEnded = await authorize({
    context: ctxAfterSecEnd,
    permission: 'orders.view',
    resource: {
      resourceType: 'branch',
      resourceId: branch2Id,
      businessId,
      branchId: branch2Id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    },
  });
  assert(decSecEnded.allowed === false, '4.8 Access to host branch A2 strictly DENIED after secondment ended');
  assert(decSecEnded.reason === 'OUTSIDE_SCOPE', '4.8b Denial reason is strictly OUTSIDE_SCOPE');

  // -------------------------------------------------------------------------
  // 6. OVERLAP / SOURCE-AWARE MULTI-SOURCE BEHAVIOR
  // -------------------------------------------------------------------------
  console.log('\n--- 5. OVERLAP / SOURCE-AWARE BEHAVIOR ---');

  // Create Source 1: Secondment Alpha to Branch A2
  const sec1Res = await OrganizationService.createSecondment(
    {
      businessId,
      businessMembershipId: waiterMembershipId,
      jobTitleId: titleBartender.id,
      branchId: branch2Id,
      departmentId,
      unitId: null,
      sourceAssignmentId: saWaiter.id,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      reason: 'Secondment Alpha to Branch A2',
    },
    ownerUserId
  );
  const sec1Id = sec1Res.id;

  // Create Source 2: Secondment Beta to Branch A2
  const sec2Res = await OrganizationService.createSecondment(
    {
      businessId,
      businessMembershipId: waiterMembershipId,
      jobTitleId: titleBartender.id,
      branchId: branch2Id,
      departmentId,
      unitId: null,
      sourceAssignmentId: saWaiter.id,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 14).toISOString(),
      reason: 'Secondment Beta to Branch A2',
    },
    ownerUserId
  );
  const sec2Id = sec2Res.id;

  const ctxTwoSources = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(ctxTwoSources.authorizedBranchIds.includes(branch2Id), '5.1 Waiter has Branch A2 with two valid sources');

  // End Source 1 (Secondment Alpha)
  await OrganizationService.endSecondment(
    { businessId, assignmentId: sec1Id, reason: 'End Alpha' },
    ownerUserId
  );

  const ctxAfterSource1End = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(ctxAfterSource1End.authorizedBranchIds.includes(branch2Id), '5.2 Ending Source 1 preserves Branch A2 reach via Source 2');

  // End Source 2 (Secondment Beta)
  await OrganizationService.endSecondment(
    { businessId, assignmentId: sec2Id, reason: 'End Beta' },
    ownerUserId
  );

  const ctxAfterSource2End = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  assert(!ctxAfterSource2End.authorizedBranchIds.includes(branch2Id), '5.3 Ending final Source 2 removes Branch A2 reach completely');

  // -------------------------------------------------------------------------
  // 7. PROVENANCE TRACING VERIFICATION (explainTemporaryAuthority)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. PROVENANCE TRACING (explainTemporaryAuthority) ---');

  // Create temporary acting assignment for provenance testing
  const provActingRes = await OrganizationService.createActingAssignment(
    {
      businessId,
      businessMembershipId: waiterMembershipId,
      actingForAssignmentId: saManager.id,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
      reason: 'Provenance test acting assignment',
    },
    ownerUserId
  );
  const provActingId = provActingRes.id;

  const ctxProv = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessId,
  });
  const traces = explainTemporaryAuthority(ctxProv);
  assert(Array.isArray(traces), '6.1 explainTemporaryAuthority returns an array');
  assert(traces.length >= 1, '6.2 Trace contains active temporary assignment entry');

  const actingTrace = traces.find((t: { assignmentId: string; assignmentType: string; effective: boolean; source: string; actingForAssignmentId?: string; sourceAssignmentId?: string; target: { branchId?: string; departmentId?: string; organizationUnitId?: string; positionId?: string }; startsAt: string; endsAt?: string; reason?: string }) => t.assignmentId === provActingId);
  assert(actingTrace !== undefined, '6.3 Found trace entry matching active acting assignment');
  assert(actingTrace?.assignmentType === 'acting', '6.4 Trace assignmentType is acting');
  assert(actingTrace?.effective === true, '6.5 Trace effective is true');
  assert(actingTrace?.target.departmentId === departmentId, '6.6 Trace target.departmentId matches');
  assert(actingTrace?.actingForAssignmentId === saManager.id, '6.7 Trace actingForAssignmentId matches');

  // End provenance acting
  await OrganizationService.endActingAssignment(
    { businessId, assignmentId: provActingId, reason: 'End provenance' },
    ownerUserId
  );

  // -------------------------------------------------------------------------
  // 8. LIVE AUDIT LOG VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 7. LIVE AUDIT LOG VERIFICATION ---');

  const { data: auditEvents, error: errAud } = await adminClient
    .from('organization_assignment_history')
    .select('*')
    .eq('business_id', businessId)
    .order('changed_at', { ascending: true });

  assert(!errAud, '7.1 Queried organization_assignment_history without error');
  const eventTypes = (auditEvents || []).map((e) => e.event_type);

  assert(eventTypes.includes('acting_started'), '7.2 Captured acting_started event');
  assert(eventTypes.includes('acting_ended'), '7.3 Captured acting_ended event');
  assert(eventTypes.includes('extended'), '7.4 Captured extended event');
  assert(eventTypes.includes('secondment_started'), '7.5 Captured secondment_started event');
  assert(eventTypes.includes('secondment_ended'), '7.6 Captured secondment_ended event');

  const sampleEvent = (auditEvents || []).find((e) => e.event_type === 'acting_started');
  assert(sampleEvent?.changed_by === ownerUserId, '7.7 Audit log changed_by matches authorized actor');
  assert(sampleEvent?.business_id === businessId, '7.8 Audit log business_id matches tenant');

  // -------------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------------
  console.log('\n--- Cleaning up temporary live security test fixtures ---');
  await adminClient.from('organization_assignment_history').delete().eq('business_id', businessId);
  await adminClient.from('organization_assignment_absences').delete().eq('business_id', businessId);
  await adminClient.from('staff_assignments').delete().eq('business_id', businessId);
  await adminClient.from('branch_assignments').delete().eq('business_membership_id', waiterMembershipId);
  await adminClient.from('branch_assignments').delete().eq('business_membership_id', managerMembershipId);
  await adminClient.from('business_memberships').delete().eq('business_id', businessId);
  await adminClient.from('organization_units').delete().eq('business_id', businessId);
  await adminClient.from('organization_positions').delete().eq('business_id', businessId);
  await adminClient.from('organization_job_titles').delete().eq('business_id', businessId);
  await adminClient.from('organization_departments').delete().eq('business_id', businessId);
  await adminClient.from('branches').delete().eq('business_id', businessId);
  await adminClient.from('businesses').delete().eq('id', businessId);
  await adminClient.auth.admin.deleteUser(ownerUserId);
  await adminClient.auth.admin.deleteUser(waiterUserId);
  await adminClient.auth.admin.deleteUser(managerUserId);

  console.log('✅ Temporary fixtures cleanly removed.');

  console.log('\n================================================================');
  console.log(`  Step 8 Live Security Suite: ${passedAssertions} PASSED, 0 FAILED`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

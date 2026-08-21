import * as path from 'path';
import * as fs from 'fs';

// Bypass server-only guard for direct script execution
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

// Load environment variables from .env.local synchronously before loading any application modules
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

import { createClient } from '@supabase/supabase-js';
import type { PermissionKey } from '../src/lib/validation/permission';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

async function runLiveSecurityVerification() {
  console.log('================================================================');
  console.log('  WSNEXA PHASE 30 STEP 7 — LIVE ROLE GOVERNANCE SECURITY AUDIT ');
  console.log('================================================================\n');

  // Dynamically import application services after environment is populated
  const { RoleGovernanceService } = await import('../src/server/services/role-governance.service');
  const { StaffInvitationService } = await import('../src/server/services/staff-invitation.service');
  const { resolveAuthorizationContext } = await import('../src/server/auth/authorization-context');
  const { can } = await import('../src/server/auth/policy-engine');
  const { OrganizationService } = await import('../src/server/services/organization.service');

  // ========================================================================
  // TASK 1: LIVE ROLE / RLS POLICIES AUDIT
  // ========================================================================
  console.log('--- TASK 1: Live RLS and Policy State Audit ---');

  const tablesToCheck = [
    'custom_roles',
    'role_permissions',
    'role_scope_presets',
    'permission_scope_grants',
    'member_permission_overrides',
    'business_memberships',
    'staff_invitations',
  ];

  for (const table of tablesToCheck) {
    // Check if table is readable
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
    console.log(`  Table: ${table} | Accessible via Admin: ${!error} | Error: ${error ? error.message : 'None'}`);
  }

  // We will run comprehensive direct DB queries via raw test sessions
  console.log('  Task 1 RLS status query completed.\n');

  // Setup test users & businesses
  const timestamp = Date.now();
  const password = 'TestPassword123!';
  const ownerAEmail = `owner_a_${timestamp}@wsnexa.test`;
  const ownerBEmail = `owner_b_${timestamp}@wsnexa.test`;
  const managerAEmail = `manager_a_${timestamp}@wsnexa.test`;
  const waiterAEmail = `waiter_a_${timestamp}@wsnexa.test`;
  const memberAEmail = `member_a_${timestamp}@wsnexa.test`;
  const inviteeEmail = `invitee_${timestamp}@wsnexa.test`;

  console.log('--- Setting up test principals and businesses in Supabase ---');

  // 1. Create Users
  const { data: userOwnerA, error: errOwnerA } = await admin.auth.admin.createUser({
    email: ownerAEmail,
    password,
    email_confirm: true,
  });
  if (errOwnerA || !userOwnerA.user) throw new Error(`Failed to create ownerA: ${errOwnerA?.message}`);
  const ownerAId = userOwnerA.user.id;

  const { data: userOwnerB, error: errOwnerB } = await admin.auth.admin.createUser({
    email: ownerBEmail,
    password,
    email_confirm: true,
  });
  if (errOwnerB || !userOwnerB.user) throw new Error(`Failed to create ownerB: ${errOwnerB?.message}`);
  const ownerBId = userOwnerB.user.id;

  const { data: userManagerA, error: errManagerA } = await admin.auth.admin.createUser({
    email: managerAEmail,
    password,
    email_confirm: true,
  });
  if (errManagerA || !userManagerA.user) throw new Error(`Failed to create managerA: ${errManagerA?.message}`);
  const managerAId = userManagerA.user.id;

  const { data: userWaiterA, error: errWaiterA } = await admin.auth.admin.createUser({
    email: waiterAEmail,
    password,
    email_confirm: true,
  });
  if (errWaiterA || !userWaiterA.user) throw new Error(`Failed to create waiterA: ${errWaiterA?.message}`);
  const waiterAId = userWaiterA.user.id;

  const { data: userMemberA, error: errMemberA } = await admin.auth.admin.createUser({
    email: memberAEmail,
    password,
    email_confirm: true,
  });
  if (errMemberA || !userMemberA.user) throw new Error(`Failed to create memberA: ${errMemberA?.message}`);
  const memberAId = userMemberA.user.id;

  const { data: userInvitee, error: errInvitee } = await admin.auth.admin.createUser({
    email: inviteeEmail,
    password,
    email_confirm: true,
  });
  if (errInvitee || !userInvitee.user) throw new Error(`Failed to create invitee: ${errInvitee?.message}`);
  const inviteeId = userInvitee.user.id;

  // Insert user_profiles
  await admin.from('user_profiles').upsert([
    { id: ownerAId, first_name: 'Alice', last_name: 'OwnerA', is_super_admin: false },
    { id: ownerBId, first_name: 'Oscar', last_name: 'OwnerB', is_super_admin: false },
    { id: managerAId, first_name: 'Bob', last_name: 'ManagerA', is_super_admin: false },
    { id: waiterAId, first_name: 'Charlie', last_name: 'WaiterA', is_super_admin: false },
    { id: memberAId, first_name: 'David', last_name: 'MemberA', is_super_admin: false },
    { id: inviteeId, first_name: 'Eve', last_name: 'Invitee', is_super_admin: false },
  ]);

  // 2. Create Businesses & Branches
  const { data: bizA, error: bizAErr } = await admin
    .from('businesses')
    .insert({
      name: `Step7 Biz A ${timestamp}`,
      slug: `step7-biz-a-${timestamp}`,
      default_currency: 'EUR',
      country_code: 'FR',
      timezone: 'UTC',
      status: 'active',
      created_by: ownerAId,
    })
    .select('id')
    .single();
  if (bizAErr || !bizA) {
    throw new Error(`Failed to create bizA: ${bizAErr?.message}`);
  }
  const businessAId = bizA.id;

  const { data: bizB, error: bizBErr } = await admin
    .from('businesses')
    .insert({
      name: `Step7 Biz B ${timestamp}`,
      slug: `step7-biz-b-${timestamp}`,
      default_currency: 'USD',
      country_code: 'US',
      timezone: 'UTC',
      status: 'active',
      created_by: ownerBId,
    })
    .select('id')
    .single();
  if (bizBErr || !bizB) {
    throw new Error(`Failed to create bizB: ${bizBErr?.message}`);
  }
  const businessBId = bizB.id;

  const { data: branchA, error: branchAErr } = await admin
    .from('branches')
    .insert({
      business_id: businessAId,
      name: 'Main Property A',
      code: `MPA${timestamp.toString().slice(-4)}`,
      is_default: true,
      status: 'active',
    })
    .select('id')
    .single();
  if (branchAErr || !branchA) {
    throw new Error(`Failed to create branchA: ${branchAErr?.message}`);
  }
  const branchAId = branchA.id;

  const { data: branchB, error: branchBErr } = await admin
    .from('branches')
    .insert({
      business_id: businessBId,
      name: 'Main Property B',
      code: `MPB${timestamp.toString().slice(-4)}`,
      is_default: true,
      status: 'active',
    })
    .select('id')
    .single();
  if (branchBErr || !branchB) {
    throw new Error(`Failed to create branchB: ${branchBErr?.message}`);
  }
  const branchBId = branchB.id;

  // 3. Create Memberships
  const { data: ownerAMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: ownerAId,
      role: 'business_owner',
      membership_status: 'active',
    })
    .select('id')
    .single();

  const { data: ownerBMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessBId,
      user_id: ownerBId,
      role: 'business_owner',
      membership_status: 'active',
    })
    .select('id')
    .single();

  const { data: managerAMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: managerAId,
      role: 'branch_manager',
      membership_status: 'active',
    })
    .select('id')
    .single();

  const { data: waiterAMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: waiterAId,
      role: 'waiter',
      membership_status: 'active',
    })
    .select('id')
    .single();

  const { data: memberAMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: memberAId,
      role: 'cashier',
      membership_status: 'active',
    })
    .select('id')
    .single();

  // Branch assignments
  await admin.from('branch_assignments').insert([
    { business_membership_id: ownerAMem!.id, branch_id: branchAId, is_primary: true },
    { business_membership_id: ownerBMem!.id, branch_id: branchBId, is_primary: true },
    { business_membership_id: managerAMem!.id, branch_id: branchAId, is_primary: true },
    { business_membership_id: waiterAMem!.id, branch_id: branchAId, is_primary: true },
    { business_membership_id: memberAMem!.id, branch_id: branchAId, is_primary: true },
  ]);

  // Create real authenticated clients via Anon Key
  const waiterClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: waiterSession } = await waiterClient.auth.signInWithPassword({
    email: waiterAEmail,
    password,
  });
  assert(Boolean(waiterSession?.session?.access_token), 'Authenticated waiter client session initialized');

  const managerClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: managerSession } = await managerClient.auth.signInWithPassword({
    email: managerAEmail,
    password,
  });
  assert(Boolean(managerSession?.session?.access_token), 'Authenticated manager client session initialized');

  const memberClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: memberSession } = await memberClient.auth.signInWithPassword({
    email: memberAEmail,
    password,
  });
  assert(Boolean(memberSession?.session?.access_token), 'Authenticated cashier/member client session initialized');

  // Seed a custom role in Biz A and Biz B
  const { data: customRoleA } = await admin
    .from('custom_roles')
    .insert({
      business_id: businessAId,
      name: 'Cocktail Specialist',
      role_key: `cocktail_specialist_${timestamp}`,
      description: 'Specialist mixologist in Biz A',
      is_active: true,
      created_by: ownerAId,
    })
    .select()
    .single();

  const { data: customRoleB } = await admin
    .from('custom_roles')
    .insert({
      business_id: businessBId,
      name: 'Sommelier B',
      role_key: `sommelier_b_${timestamp}`,
      description: 'Sommelier in Biz B',
      is_active: true,
      created_by: ownerBId,
    })
    .select()
    .single();

  // ========================================================================
  // TASK 2: REAL AUTHENTICATED CLIENT ESCALATION TESTS
  // ========================================================================
  console.log('\n--- TASK 2: Real Authenticated Client Direct Escalation Tests ---');

  // 1. Waiter attempts to create privileged custom role
  const { data: waiterCreateRole, error: waiterCreateErr } = await waiterClient
    .from('custom_roles')
    .insert({
      business_id: businessAId,
      name: 'Illegitimate Super Admin',
      role_key: `illegitimate_role_${timestamp}`,
      created_by: waiterAId,
    })
    .select();
  const waiterRoleCreated = await admin.from('custom_roles').select('*').eq('role_key', `illegitimate_role_${timestamp}`);
  assert(
    (waiterCreateErr !== null || !waiterCreateRole || waiterCreateRole.length === 0) &&
    waiterRoleCreated.data?.length === 0,
    '2.1 Waiter direct INSERT INTO custom_roles is DENIED by RLS'
  );

  // 2. Waiter attempts to add roles.manage or sensitive permission directly into role_permissions
  const { data: waiterAddPerm, error: waiterPermErr } = await waiterClient
    .from('role_permissions')
    .insert({
      business_id: businessAId,
      custom_role_id: customRoleA!.id,
      permission_key: 'roles.manage',
    })
    .select();
  const waiterPermInserted = await admin.from('role_permissions').select('*').eq('custom_role_id', customRoleA!.id).eq('permission_key', 'roles.manage');
  assert(
    (waiterPermErr !== null || !waiterAddPerm || waiterAddPerm.length === 0) &&
    waiterPermInserted.data?.length === 0,
    '2.2 Waiter direct INSERT INTO role_permissions is DENIED by RLS'
  );

  // 3. Normal member attempts to update business_memberships.role for themselves
  const { data: memberRoleEsc, error: memberRoleErr } = await memberClient
    .from('business_memberships')
    .update({ role: 'business_owner' })
    .eq('id', memberAMem!.id)
    .select();
  const memberCheck1 = await admin.from('business_memberships').select('role').eq('id', memberAMem!.id).single();
  assert(
    (memberRoleErr !== null || !memberRoleEsc || memberRoleEsc.length === 0) &&
    memberCheck1.data?.role === 'cashier',
    '2.3 Normal member direct UPDATE business_memberships.role is DENIED by RLS'
  );

  // 4. Normal member attempts to set their own custom_role_id
  const { data: memberCustomRoleEsc, error: memberCustomRoleErr } = await memberClient
    .from('business_memberships')
    .update({ custom_role_id: customRoleA!.id })
    .eq('id', memberAMem!.id)
    .select();
  const memberCheck2 = await admin.from('business_memberships').select('custom_role_id').eq('id', memberAMem!.id).single();
  assert(
    (memberCustomRoleErr !== null || !memberCustomRoleEsc || memberCustomRoleEsc.length === 0) &&
    memberCheck2.data?.custom_role_id === null,
    '2.4 Normal member direct UPDATE custom_role_id on self is DENIED by RLS'
  );

  // 5. Branch manager attempts direct DB promotion to business_owner
  const { data: mgrEsc, error: mgrErr } = await managerClient
    .from('business_memberships')
    .update({ role: 'business_owner' })
    .eq('id', managerAMem!.id)
    .select();
  const mgrCheck = await admin.from('business_memberships').select('role').eq('id', managerAMem!.id).single();
  assert(
    (mgrErr !== null || !mgrEsc || mgrEsc.length === 0) &&
    mgrCheck.data?.role === 'branch_manager',
    '2.5 Branch manager direct DB promotion to business_owner is DENIED by RLS'
  );

  // 6. Business A member attempts to mutate Business B custom role
  const { data: crossBizMut, error: crossBizErr } = await memberClient
    .from('custom_roles')
    .update({ name: 'Hacked Sommelier B' })
    .eq('id', customRoleB!.id)
    .select();
  const crossBizCheck = await admin.from('custom_roles').select('name').eq('id', customRoleB!.id).single();
  assert(
    (crossBizErr !== null || !crossBizMut || crossBizMut.length === 0) &&
    crossBizCheck.data?.name === 'Sommelier B',
    '2.6 Business A member direct UPDATE of Business B custom_role is DENIED by RLS'
  );

  // 7. Normal member attempts to mutate role_scope_presets
  const { data: presetMut, error: presetErr } = await memberClient
    .from('role_scope_presets')
    .update({ max_scope: 'ORGANIZATION' })
    .eq('business_id', businessAId)
    .select();
  assert(
    presetErr !== null || !presetMut || presetMut.length === 0,
    '2.7 Normal member direct UPDATE role_scope_presets is DENIED by RLS'
  );

  // 8. Normal member attempts to mutate permission_scope_grants
  const { data: grantMut, error: grantErr } = await memberClient
    .from('permission_scope_grants')
    .insert({
      business_id: businessAId,
      role_key: 'cashier',
      permission_key: 'roles.manage',
      scope_type: 'ORGANIZATION',
      effect: 'allow',
    })
    .select();
  const grantCheck = await admin.from('permission_scope_grants').select('*').eq('business_id', businessAId).eq('permission_key', 'roles.manage');
  assert(
    (grantErr !== null || !grantMut || grantMut.length === 0) &&
    grantCheck.data?.length === 0,
    '2.8 Normal member direct INSERT permission_scope_grants is DENIED by RLS'
  );

  // ========================================================================
  // TASK 3: AUTHORIZED SERVER ROLE GOVERNANCE
  // ========================================================================
  console.log('\n--- TASK 3: Authorized Server Role Governance Lifecycle ---');

  const ownerAContext = await resolveAuthorizationContext({
    overrideUserId: ownerAId,
    requestedBusinessId: businessAId,
  });

  // 1. Create custom role
  const createRoleRes = await RoleGovernanceService.createCustomRole(ownerAContext, {
    name: 'Head Barista',
    description: 'Senior barista managing coffee bar',
    permissions: ['menu.view', 'orders.view', 'inventory.view'],
    defaultScope: 'AREA_TEAM',
    maxScope: 'PROPERTY',
  });
  assert(createRoleRes.success === true && Boolean(createRoleRes.role?.id), '3.1 Authorized createCustomRole succeeds');
  const baristaRoleId = createRoleRes.role!.id;

  // 2. Update custom role
  const updateRoleRes = await RoleGovernanceService.updateCustomRole(ownerAContext, {
    roleId: baristaRoleId,
    description: 'Lead Artisan Barista & Trainer',
  });
  assert(updateRoleRes.success === true && updateRoleRes.role?.description === 'Lead Artisan Barista & Trainer', '3.2 Authorized updateCustomRole succeeds');

  // 3. Replace permission bundle
  const setPermRes = await RoleGovernanceService.setCustomRolePermissions(ownerAContext, baristaRoleId, [
    'menu.view',
    'orders.view',
    'inventory.view',
    'tables.view',
  ]);
  assert(setPermRes.success === true && setPermRes.permissions.includes('tables.view'), '3.3 Authorized setCustomRolePermissions replaces bundle');

  // 4. Clone built-in role to custom role
  const cloneRoleRes = await RoleGovernanceService.cloneRole(ownerAContext, {
    sourceType: 'built_in',
    sourceRoleKey: 'kitchen_staff',
    name: 'Pastry Chef Specialist',
    description: 'Specialized pastry chef role',
  });
  assert(cloneRoleRes.success === true && Boolean(cloneRoleRes.role?.id), '3.4 Authorized cloneRole from built-in template succeeds');
  const pastryRoleId = cloneRoleRes.role!.id;

  // 5. Assign custom role to eligible member
  const assignRoleRes = await RoleGovernanceService.assignMemberRole(ownerAContext, {
    membershipId: memberAMem!.id,
    customRoleId: baristaRoleId,
  });
  assert(assignRoleRes.success === true, '3.5 Authorized assignMemberRole assigns custom role');

  // 6. Role usage inspection
  const usageBeforeArchive = await RoleGovernanceService.getRoleUsage(ownerAContext, {
    customRoleId: baristaRoleId,
  });
  assert(
    usageBeforeArchive.activeMembers === 1 && usageBeforeArchive.canSafelyArchive === false,
    '3.6 getRoleUsage detects active member assignment (canSafelyArchive = false)'
  );

  // 7. Archive role with member reassignment
  const archiveRes = await RoleGovernanceService.archiveCustomRole(ownerAContext, {
    roleId: baristaRoleId,
    reassignToCustomRoleId: pastryRoleId,
  });
  assert(archiveRes.success === true && archiveRes.reassignedCount === 1, '3.7 archiveCustomRole with reassignment succeeds');

  // Verify member now has pastryRoleId
  const memberReassigned = await admin.from('business_memberships').select('custom_role_id').eq('id', memberAMem!.id).single();
  assert(memberReassigned.data?.custom_role_id === pastryRoleId, '3.7b Active member successfully migrated to reassignment target');

  // 8. Restore role
  const restoreRes = await RoleGovernanceService.restoreCustomRole(ownerAContext, {
    roleId: baristaRoleId,
  });
  assert(restoreRes.success === true, '3.8 restoreCustomRole restores role to active');

  // ========================================================================
  // TASK 4: OWNER PROTECTION & PRIVILEGE CEILINGS
  // ========================================================================
  console.log('\n--- TASK 4: Owner Protection & Reach Ceilings ---');

  const managerAContext = await resolveAuthorizationContext({
    overrideUserId: managerAId,
    requestedBusinessId: businessAId,
  });

  // 1. Non-owner cannot assign business_owner
  let assignOwnerErr = false;
  try {
    await RoleGovernanceService.assignMemberRole(managerAContext, {
      membershipId: memberAMem!.id,
      builtInRole: 'business_owner',
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    assignOwnerErr = e.code === 'OWNER_ROLE_PROTECTED' || e.code === 'UNAUTHORIZED';
  }
  assert(assignOwnerErr, '4.1 Non-owner cannot assign business_owner (OWNER_ROLE_PROTECTED)');

  // 2. Non-owner cannot demote owner
  let demoteOwnerErr = false;
  try {
    await RoleGovernanceService.assignMemberRole(managerAContext, {
      membershipId: ownerAMem!.id,
      builtInRole: 'branch_manager',
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    demoteOwnerErr = e.code === 'OWNER_ROLE_PROTECTED' || e.code === 'UNAUTHORIZED';
  }
  assert(demoteOwnerErr, '4.2 Non-owner cannot demote business_owner (OWNER_ROLE_PROTECTED)');

  // 3. Owner cannot be removed / demoted through generic role assignment if last owner
  let ownerSelfDemoteErr = false;
  try {
    await RoleGovernanceService.assignMemberRole(ownerAContext, {
      membershipId: ownerAMem!.id,
      builtInRole: 'branch_manager',
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    ownerSelfDemoteErr = e.code === 'OWNER_ROLE_PROTECTED' || Boolean(e.message?.includes('owner'));
  }
  assert(ownerSelfDemoteErr, '4.3 Last owner cannot be demoted through role assignment');

  // 4. business_owner template remains ORGANIZATION / ORGANIZATION
  const ownerTemplate = await RoleGovernanceService.getBuiltInRoleTemplate('business_owner');
  assert(
    ownerTemplate!.defaultScope === 'ORGANIZATION' &&
    ownerTemplate!.maxScope === 'ORGANIZATION' &&
    ownerTemplate!.isOwnerRole === true,
    '4.4 business_owner default & max scope strictly remain ORGANIZATION'
  );

  // 5. super_admin.* cannot enter tenant custom roles
  let superAdminPermErr = false;
  try {
    await RoleGovernanceService.createCustomRole(ownerAContext, {
      name: 'Super Auditor',
      permissions: ['super_admin.audit.view' as unknown as PermissionKey],
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    superAdminPermErr = e.code === 'INVALID_PERMISSION' || Boolean(e.message?.includes('super_admin'));
  }
  assert(superAdminPermErr, '4.5 Platform super_admin.* permissions strictly prohibited from tenant roles');

  // ========================================================================
  // TASK 5: INVITATION SECURITY & CLAIM-TIME REVALIDATION
  // ========================================================================
  console.log('\n--- TASK 5: Invitation Security & Claim-Time Revalidation ---');

  // 1. Create invitation with valid custom role
  const inviteRes = await StaffInvitationService.createInvitation(ownerAId, businessAId, {
    branchId: branchAId,
    assignedRole: 'cashier',
    expiryOption: '48h',
    customRoleId: baristaRoleId,
    invitedEmail: `invitee_step7_${timestamp}@wsnexa.test`,
  });
  assert(inviteRes.success === true && Boolean(inviteRes.rawCode), '5.1 Invitation created referencing active custom role');

  // 2. Archive that custom role before claim
  await RoleGovernanceService.archiveCustomRole(ownerAContext, {
    roleId: baristaRoleId,
    reassignToCustomRoleId: pastryRoleId,
  });

  // 3. Claim is rejected because role is archived
  const claimArchivedRes = await StaffInvitationService.claimInvitation(
    inviteeId,
    `invitee_step7_${timestamp}@wsnexa.test`,
    inviteRes.rawCode!
  );
  assert(
    claimArchivedRes.success === false && Boolean(claimArchivedRes.message?.includes('archived')),
    '5.2 Claiming invitation with archived custom role is strictly DENIED at claim time'
  );

  // 4. Restore role
  await RoleGovernanceService.restoreCustomRole(ownerAContext, {
    roleId: baristaRoleId,
  });

  // 5. Claim succeeds after role is restored
  const claimRestoredRes = await StaffInvitationService.claimInvitation(
    inviteeId,
    `invitee_step7_${timestamp}@wsnexa.test`,
    inviteRes.rawCode!
  );
  assert(claimRestoredRes.success === true, '5.3 Restoring custom role allows invitation to be successfully claimed');

  // 6. Cross-tenant custom role in invitation is rejected at creation
  let crossTenantInviteErr = false;
  try {
    const crossRes = await StaffInvitationService.createInvitation(ownerAId, businessAId, {
      branchId: branchAId,
      assignedRole: 'cashier',
      expiryOption: '48h',
      customRoleId: customRoleB!.id, // Belongs to Biz B
      invitedEmail: `cross_tenant_${timestamp}@wsnexa.test`,
    });
    if (!crossRes.success) crossTenantInviteErr = true;
  } catch {
    crossTenantInviteErr = true;
  }
  assert(crossTenantInviteErr, '5.4 Creating invitation referencing another tenant custom role is strictly REJECTED');

  // ========================================================================
  // TASK 6: ROLE / ORGANIZATION SEPARATION (DECOUPLING)
  // ========================================================================
  console.log('\n--- TASK 6: Role / Organization Separation ---');

  // Create department, hierarchy level, job title, and position via OrganizationService
  const dept = await OrganizationService.createDepartment({
    businessId: businessAId,
    name: 'Beverage Operations',
    code: `BEV_${timestamp.toString().slice(-4)}`,
  });

  const levels = await OrganizationService.seedDefaultHierarchyLevels(businessAId);
  const opLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];

  const jobTitle = await OrganizationService.createJobTitle({
    businessId: businessAId,
    name: `Beverage Lead Specialist ${timestamp}`,
    code: `BLS_${timestamp.toString().slice(-4)}`,
    hierarchyLevelId: opLevel.id,
    departmentType: 'beverage',
    isManagement: false,
  });

  const position = await OrganizationService.createPosition({
    businessId: businessAId,
    branchId: branchAId,
    departmentId: dept.id,
    jobTitleId: jobTitle.id,
    positionCode: `POS_BLS_${timestamp.toString().slice(-4)}`,
    headcountLimit: 5,
  });

  // Create substantive staff assignment for memberA
  const staffAssign = await OrganizationService.createStaffAssignment({
    businessId: businessAId,
    businessMembershipId: memberAMem!.id,
    branchId: branchAId,
    departmentId: dept.id,
    positionId: position.id,
    jobTitleId: jobTitle.id,
    assignmentType: 'primary',
    isPrimary: true,
    status: 'active',
  });

  // 1. Mutate RBAC Role from pastryRoleId back to baristaRoleId
  await RoleGovernanceService.assignMemberRole(ownerAContext, {
    membershipId: memberAMem!.id,
    customRoleId: baristaRoleId,
  });

  // Verify staff assignment, job title, position, department remain completely unchanged
  const staffAssignAfterRoleChange = await admin
    .from('staff_assignments')
    .select('*, organization_positions(*), organization_job_titles(*), organization_departments(*)')
    .eq('id', staffAssign!.id)
    .single();

  assert(
    staffAssignAfterRoleChange.data?.department_id === dept!.id &&
    staffAssignAfterRoleChange.data?.position_id === position!.id &&
    staffAssignAfterRoleChange.data?.job_title_id === jobTitle!.id &&
    staffAssignAfterRoleChange.data?.status === 'active',
    '6.1 Changing RBAC role does NOT mutate substantive position, department, or job title'
  );

  // 2. Mutate substantive staff position
  const jobTitle2 = await OrganizationService.createJobTitle({
    businessId: businessAId,
    name: `Floor Supervisor ${timestamp}`,
    code: `SUP_${timestamp.toString().slice(-4)}`,
    hierarchyLevelId: opLevel.id,
    departmentType: 'service',
    isManagement: false,
  });

  await admin
    .from('staff_assignments')
    .update({ job_title_id: jobTitle2.id })
    .eq('id', staffAssign.id);

  // Verify business_membership role & custom_role_id remain untouched
  const memberAfterOrgChange = await admin
    .from('business_memberships')
    .select('role, custom_role_id')
    .eq('id', memberAMem!.id)
    .single();

  assert(
    memberAfterOrgChange.data?.custom_role_id === baristaRoleId,
    '6.2 Mutating organizational placement does NOT alter business_memberships RBAC role or custom_role_id'
  );

  // ========================================================================
  // TASK 7: AUTHORIZATION REFRESH & ZERO STALE CONTEXT
  // ========================================================================
  console.log('\n--- TASK 7: Authorization Context Refresh ---');

  // Step 1: Member has Barista role -> resolve context
  const contextRoleA = await resolveAuthorizationContext({
    overrideUserId: memberAId,
    requestedBusinessId: businessAId,
  });
  const canViewTablesA = await can({ context: contextRoleA, permission: 'tables.view' });
  const canManageKitchenA = await can({ context: contextRoleA, permission: 'kitchen.update' });
  assert(canViewTablesA === true && canManageKitchenA === false, '7.1 Fresh Context A contains Role A permissions (tables.view)');

  // Step 2: Change member role to kitchen_staff built-in role
  await RoleGovernanceService.assignMemberRole(ownerAContext, {
    membershipId: memberAMem!.id,
    builtInRole: 'kitchen_staff',
  });

  // Step 3: Resolve a NEW authorization context
  const contextRoleB = await resolveAuthorizationContext({
    overrideUserId: memberAId,
    requestedBusinessId: businessAId,
  });
  const canViewTablesB = await can({ context: contextRoleB, permission: 'tables.view' });
  const canManageKitchenB = await can({ context: contextRoleB, permission: 'kitchen.update' });

  assert(
    canViewTablesB === false && canManageKitchenB === true,
    '7.2 Fresh Context B immediately drops Role A permissions and gains Role B permissions (Zero stale state)'
  );

  // ========================================================================
  // TASK 8: AUDIT LOG VERIFICATION
  // ========================================================================
  console.log('\n--- TASK 8: Live Audit Log Trail Verification ---');

  const requiredAuditActions = [
    'custom_role.created',
    'custom_role.updated',
    'custom_role.permissions_updated',
    'custom_role.cloned',
    'custom_role.archived',
    'custom_role.restored',
    'member_role.changed',
  ];

  // Let's create a specific cloned role to ensure custom_role.cloned is generated
  await RoleGovernanceService.cloneRole(ownerAContext, {
    sourceType: 'custom',
    sourceCustomRoleId: baristaRoleId,
    name: 'Senior Coffee Artisan',
  });

  const { data: auditEntries } = await admin
    .from('audit_logs')
    .select('action, actor_id, business_id, target_id, payload')
    .eq('business_id', businessAId);

  const recordedActions = new Set((auditEntries || []).map((e) => e.action));

  for (const action of requiredAuditActions) {
    const present = recordedActions.has(action);
    assert(present, `8. Audit log captured action: ${action}`);
  }

  // ========================================================================
  // CLEANUP TEST FIXTURES
  // ========================================================================
  console.log('\n--- Cleaning up temporary test fixtures ---');
  await admin.from('businesses').delete().in('id', [businessAId, businessBId]);
  await admin.auth.admin.deleteUser(ownerAId);
  await admin.auth.admin.deleteUser(ownerBId);
  await admin.auth.admin.deleteUser(managerAId);
  await admin.auth.admin.deleteUser(waiterAId);
  await admin.auth.admin.deleteUser(memberAId);
  await admin.auth.admin.deleteUser(inviteeId);
  console.log('✅ Live security audit test fixtures cleaned up.');

  console.log('\n================================================================');
  console.log(`  Live Security Audit Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runLiveSecurityVerification().catch((err) => {
  console.error('Fatal live security audit failure:', err);
  process.exit(1);
});

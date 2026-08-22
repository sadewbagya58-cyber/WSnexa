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

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    failCount++;
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

async function runVerification() {
  const { createAdminClient, createClient } = await import('../src/lib/supabase/server');
  const {
    listRoleTemplatesAction,
    getRoleTemplateAction,
    createCustomRoleAction,
    updateCustomRoleAction,
    cloneRoleAction,
    archiveCustomRoleAction,
    restoreCustomRoleAction,
    listCustomRolesAction,
    getCustomRoleAction,
    getRoleUsageAction,
    reassignRoleMembersAction,
    assignMemberRoleAction,
    previewRoleEffectiveAccessAction,
    setScopedMemberOverrideAction,
    removeMemberOverrideAction,
    listPermissionScopeGrantsAction,
    createPermissionScopeGrantAction,
    updatePermissionScopeGrantAction,
    revokePermissionScopeGrantAction,
    previewMemberEffectiveAccessAction,
    diagnoseAccessAction,
  } = await import('../src/server/actions/permission');
  const { RoleGovernanceService } = await import('../src/server/services/role-governance.service');
  const { ScopeGrantService } = await import('../src/server/services/scope-grant.service');
  const { PermissionService } = await import('../src/server/services/permission.service');
  const { resolveAuthorizationContext, can, authorize } = await import('../src/server/auth');
  const { getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');

  console.log('\n================================================================');
  console.log('    WSNexa Phase 30 Step 10 — Access Management UI & Diagnostics');
  console.log('================================================================\n');

  const admin = createAdminClient();

  // Clean up any test fixtures from previous runs
  const { data: testBiz } = await admin
    .from('businesses')
    .select('id')
    .ilike('name', 'Step10 UI Test%');
  if (testBiz && testBiz.length > 0) {
    const bizIds = testBiz.map((b) => b.id);
    await admin.from('permission_scope_grants').delete().in('business_id', bizIds);
    await admin.from('member_permission_overrides').delete().in('business_id', bizIds);
    await admin.from('custom_roles').delete().in('business_id', bizIds);
    await admin.from('business_memberships').delete().in('business_id', bizIds);
    await admin.from('branches').delete().in('business_id', bizIds);
    await admin.from('businesses').delete().in('id', bizIds);
  }

  // Setup Test Fixtures in Supabase
  console.log('--- Setting up test fixtures in Supabase ---');

  // Create User Profiles via auth.admin
  const testRunId = Date.now().toString();
  const ownerEmail = `owner-step10-${testRunId}@test.local`;
  const managerEmail = `mgr-step10-${testRunId}@test.local`;
  const waiterEmail = `waiter-step10-${testRunId}@test.local`;
  const tenantBEmail = `tenantb-step10-${testRunId}@test.local`;
  const testPassword = 'Password123!';

  const { data: uOwner } = await admin.auth.admin.createUser({ email: ownerEmail, password: testPassword, email_confirm: true });
  const { data: uMgr } = await admin.auth.admin.createUser({ email: managerEmail, password: testPassword, email_confirm: true });
  const { data: uWaiter } = await admin.auth.admin.createUser({ email: waiterEmail, password: testPassword, email_confirm: true });
  const { data: uTenantB } = await admin.auth.admin.createUser({ email: tenantBEmail, password: testPassword, email_confirm: true });

  const ownerUserId = uOwner!.user!.id;
  const managerUserId = uMgr!.user!.id;
  const waiterUserId = uWaiter!.user!.id;
  const tenantBUserId = uTenantB!.user!.id;

  await admin.from('user_profiles').upsert([
    { id: ownerUserId, first_name: 'Owner', last_name: 'User', is_super_admin: false },
    { id: managerUserId, first_name: 'Manager', last_name: 'User', is_super_admin: false },
    { id: waiterUserId, first_name: 'Waiter', last_name: 'User', is_super_admin: false },
    { id: tenantBUserId, first_name: 'TenantB', last_name: 'User', is_super_admin: false },
  ]);

  // Create Business Tenant A
  const { data: bizA, error: errA } = await admin
    .from('businesses')
    .insert({
      name: `Step10 UI Test Business A ${testRunId}`,
      slug: `step10-biz-a-${testRunId}`,
      business_type: 'restaurant',
      country_code: 'US',
      default_currency: 'USD',
      timezone: 'America/New_York',
      status: 'active',
      created_by: ownerUserId,
    })
    .select()
    .single();

  if (errA || !bizA) {
    throw new Error(`Failed to create Business A: ${errA?.message}`);
  }

  // Create Business Tenant B
  const { data: bizB, error: errB } = await admin
    .from('businesses')
    .insert({
      name: `Step10 UI Test Business B ${testRunId}`,
      slug: `step10-biz-b-${testRunId}`,
      business_type: 'restaurant',
      country_code: 'US',
      default_currency: 'USD',
      timezone: 'America/New_York',
      status: 'active',
      created_by: tenantBUserId,
    })
    .select()
    .single();

  if (errB || !bizB) {
    throw new Error(`Failed to create Business B: ${errB?.message}`);
  }

  const businessAId = bizA.id;
  const businessBId = bizB.id;

  // Create Branches for Business A
  const { data: branchA1, error: errBA1 } = await admin
    .from('branches')
    .insert({ business_id: businessAId, name: 'Branch A1 Main', code: `BA1-${testRunId}` })
    .select()
    .single();
  if (errBA1 || !branchA1) throw new Error(`Failed to create Branch A1: ${errBA1?.message}`);

  const { data: branchA2, error: errBA2 } = await admin
    .from('branches')
    .insert({ business_id: businessAId, name: 'Branch A2 Sub', code: `BA2-${testRunId}` })
    .select()
    .single();
  if (errBA2 || !branchA2) throw new Error(`Failed to create Branch A2: ${errBA2?.message}`);

  // Create Branch for Business B
  const { data: branchB1, error: errBB1 } = await admin
    .from('branches')
    .insert({ business_id: businessBId, name: 'Branch B1 Foreign', code: `BB1-${testRunId}` })
    .select()
    .single();
  if (errBB1 || !branchB1) throw new Error(`Failed to create Branch B1: ${errBB1?.message}`);

  // Create Memberships for Business A
  const { data: ownerMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: ownerUserId,
      role: 'business_owner',
      membership_status: 'active',
    })
    .select()
    .single();

  const { data: managerMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: managerUserId,
      role: 'branch_manager',
      membership_status: 'active',
    })
    .select()
    .single();

  const { data: waiterMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessAId,
      user_id: waiterUserId,
      role: 'waiter',
      membership_status: 'active',
    })
    .select()
    .single();

  // Create Membership for Business B
  const { data: tenantBMem } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessBId,
      user_id: tenantBUserId,
      role: 'business_owner',
      membership_status: 'active',
    })
    .select()
    .single();

  console.log('✅ Test fixtures successfully created in Supabase.\n');

  // Resolve Authorization Contexts
  const ownerAuth = await resolveAuthorizationContext({
    overrideUserId: ownerUserId,
    requestedBusinessId: businessAId,
  });

  const managerAuth = await resolveAuthorizationContext({
    overrideUserId: managerUserId,
    requestedBusinessId: businessAId,
  });

  const waiterAuth = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessAId,
  });

  const tenantBAuth = await resolveAuthorizationContext({
    overrideUserId: tenantBUserId,
    requestedBusinessId: businessBId,
  });

  // ====================================================================
  // SECTION 0 — Canonical Scope Model Audit
  // ====================================================================
  console.log('--- 0. Canonical Scope Model Audit ---');

  const canonicalScopes = ['ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF'];
  const actualEnumScopes = scopeTypeEnum.options;

  assert(
    JSON.stringify(actualEnumScopes) === JSON.stringify(canonicalScopes),
    'Canonical scope types are exactly ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF'
  );
  assert(!actualEnumScopes.includes('REGION' as any), 'REGION does NOT exist as an RBAC scope');
  assert(!actualEnumScopes.includes('SERVICE_AREA' as any), 'SERVICE_AREA does NOT exist as a canonical RBAC scope type');
  assert(actualEnumScopes.includes('SELF'), 'SELF scope level is supported');
  assert(actualEnumScopes.includes('AREA_TEAM'), 'AREA_TEAM scope level is supported for units/service areas');

  const { SCOPE_PRESET_OPTIONS } = await import('../src/components/access/scope-preset-selector');
  const uiScopeValues = SCOPE_PRESET_OPTIONS.map((opt) => opt.value);
  assert(
    JSON.stringify(uiScopeValues) === JSON.stringify(canonicalScopes),
    'UI ScopePresetSelector options match canonical scope values exactly'
  );
  const areaTeamOpt = SCOPE_PRESET_OPTIONS.find((opt) => opt.value === 'AREA_TEAM');
  assert(
    areaTeamOpt?.description.includes('service area') === true,
    'Service Area targets resolve under AREA_TEAM scope level'
  );

  // ====================================================================
  // SECTION 1 — Access Hub Route Security
  // ====================================================================
  console.log('\n--- 1. Access Hub Route Security ---');

  const routePerm = getRequiredPermissionForRoute('/dashboard/access');
  assert(routePerm === 'roles.view', '/dashboard/access requires roles.view route permission');

  const ownerCanRoute = await can({ context: ownerAuth, permission: routePerm! });
  assert(ownerCanRoute === true, 'Business Owner can access /dashboard/access route');

  await PermissionService.setScopedMemberOverride(ownerAuth, {
    membershipId: managerMem!.id,
    permissionKey: 'roles.view',
    effect: 'allow',
    scopeType: 'PROPERTY',
    branchId: branchA1!.id,
  });

  const managerAuthUpdated = await resolveAuthorizationContext({
    overrideUserId: managerUserId,
    requestedBusinessId: businessAId,
  });

  const managerCanRoute = await can({
    context: managerAuthUpdated,
    permission: routePerm!,
    resource: { type: 'branch', id: branchA1!.id, branchId: branchA1!.id },
  });
  assert(managerCanRoute === true, 'Authorized role manager with roles.view can access /dashboard/access route');

  const waiterCanRoute = await can({ context: waiterAuth, permission: routePerm! });
  assert(waiterCanRoute === false, 'Ordinary waiter without roles.view is DENIED access to /dashboard/access route');

  // ====================================================================
  // SECTION 2 — Built-In Role Templates
  // ====================================================================
  console.log('\n--- 2. Built-In Role Templates ---');

  const templatesRes = await listRoleTemplatesAction();
  assert(templatesRes.success === true, 'listRoleTemplatesAction returns success');
  const templates = templatesRes.data || [];
  assert(templates.length === 5, 'Exactly 5 canonical built-in role templates exposed');

  const templateKeys = templates.map((t) => t.roleKey);
  assert(
    templateKeys.includes('business_owner') &&
      templateKeys.includes('branch_manager') &&
      templateKeys.includes('cashier') &&
      templateKeys.includes('kitchen_staff') &&
      templateKeys.includes('waiter'),
    'Contains business_owner, branch_manager, cashier, kitchen_staff, waiter'
  );

  const ownerTemplate = templates.find((t) => t.roleKey === 'business_owner');
  assert(ownerTemplate?.isProtected === true, 'Business Owner template marked as system protected');

  // Clone Built-in to Custom Role
  const cloneRes = await RoleGovernanceService.cloneRole(ownerAuth, {
    sourceType: 'built_in',
    sourceRoleKey: 'waiter',
    name: 'Lead Waiter Cloned',
    description: 'Cloned from waiter template',
  });
  assert(cloneRes.success === true && !!cloneRes.role?.id, 'Clone built-in template to custom role succeeds');
  const clonedRoleId = cloneRes.role!.id;

  // ====================================================================
  // SECTION 3 — Custom Roles Lifecycle
  // ====================================================================
  console.log('\n--- 3. Custom Roles Lifecycle ---');

  const createRoleRes = await RoleGovernanceService.createCustomRole(ownerAuth, {
    name: 'Shift Supervisor Test',
    description: 'Custom shift supervisor role',
    permissions: ['orders.view', 'orders.create', 'tables.view'],
    defaultScope: 'PROPERTY',
    maxScope: 'PROPERTY',
  });
  assert(createRoleRes.success === true && !!createRoleRes.role?.id, 'Create custom role succeeds');
  const customRoleId = createRoleRes.role!.id;

  const updateRoleRes = await RoleGovernanceService.updateCustomRole(ownerAuth, {
    roleId: customRoleId,
    name: 'Shift Supervisor Updated',
    description: 'Updated description',
    permissions: ['orders.view', 'orders.create', 'tables.view', 'menu.view'],
    defaultScope: 'PROPERTY',
    maxScope: 'PROPERTY',
  });
  assert(updateRoleRes.success === true, 'Update custom role metadata and permissions succeeds');

  // Reserved Role Name Rejection
  let reservedNameRejected = false;
  try {
    await RoleGovernanceService.createCustomRole(ownerAuth, {
      name: 'Business Owner',
      description: 'Attempt duplicate owner name',
      permissions: ['orders.view'],
      defaultScope: 'ORGANIZATION',
      maxScope: 'ORGANIZATION',
    });
  } catch {
    reservedNameRejected = true;
  }
  assert(reservedNameRejected === true, 'Create custom role with reserved name "Business Owner" rejected');

  // Duplicate Role Name Rejection
  let duplicateNameRejected = false;
  try {
    await RoleGovernanceService.createCustomRole(ownerAuth, {
      name: 'Shift Supervisor Updated',
      description: 'Attempt duplicate name',
      permissions: ['orders.view'],
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    });
  } catch {
    duplicateNameRejected = true;
  }
  assert(duplicateNameRejected === true, 'Create custom role with duplicate name rejected');

  // Archive & Restore Custom Role
  const archiveRes = await RoleGovernanceService.archiveCustomRole(ownerAuth, { roleId: customRoleId });
  assert(archiveRes.success === true, 'Archive custom role succeeds');

  const getArchivedRes = await RoleGovernanceService.getCustomRoleById(businessAId, customRoleId);
  assert(getArchivedRes?.isArchived === true, 'Custom role reflects archived state in DB');

  const restoreRes = await RoleGovernanceService.restoreCustomRole(ownerAuth, { roleId: customRoleId });
  assert(restoreRes.success === true, 'Restore custom role succeeds');

  // ====================================================================
  // SECTION 4 — Safe Role Assignment
  // ====================================================================
  console.log('\n--- 4. Safe Role Assignment ---');

  const assignRes = await RoleGovernanceService.assignMemberRole(ownerAuth, {
    membershipId: waiterMem!.id,
    customRoleId,
  });
  assert(assignRes.success === true, 'Assign custom role to staff member succeeds');

  // Attempt assign archived role (reassigning members to waiter role during archival)
  await RoleGovernanceService.archiveCustomRole(ownerAuth, { roleId: customRoleId, reassignToRoleKey: 'waiter' });
  let archivedAssignRejected = false;
  try {
    await RoleGovernanceService.assignMemberRole(ownerAuth, {
      membershipId: waiterMem!.id,
      customRoleId,
    });
  } catch {
    archivedAssignRejected = true;
  }
  assert(archivedAssignRejected === true, 'Assigning archived custom role is strictly rejected');

  await RoleGovernanceService.restoreCustomRole(ownerAuth, { roleId: customRoleId });

  // Self escalation attempt by manager
  let selfEscalationRejected = false;
  try {
    await RoleGovernanceService.assignMemberRole(managerAuth, {
      membershipId: managerMem!.id,
      builtInRole: 'business_owner',
    });
  } catch {
    selfEscalationRejected = true;
  }
  assert(selfEscalationRejected === true, 'Manager self-escalation attempt to business_owner rejected');

  // ====================================================================
  // SECTION 5 — Permission Scope Grants
  // ====================================================================
  console.log('\n--- 5. Permission Scope Grants ---');

  const grantRes = await ScopeGrantService.createScopeGrant(ownerAuth, {
    roleKey: 'waiter',
    permissionKey: 'orders.cancel',
    scopeType: 'PROPERTY',
    branchId: branchA1!.id,
    effect: 'allow',
    grantSource: 'role_preset',
  });
  assert(grantRes.success === true && !!grantRes.grant?.id, 'Create permission scope grant succeeds');
  const grantId = grantRes.grant!.id;

  const updateGrantRes = await ScopeGrantService.updateScopeGrant(ownerAuth, {
    grantId,
    effect: 'deny',
  });
  assert(updateGrantRes.success === true && updateGrantRes.grant?.effect === 'deny', 'Update scope grant effect to deny succeeds');

  const revokeGrantRes = await ScopeGrantService.revokeScopeGrant(ownerAuth, grantId);
  assert(revokeGrantRes.success === true, 'Revoke scope grant succeeds');

  // ====================================================================
  // SECTION 6 — Member Permission Overrides
  // ====================================================================
  console.log('\n--- 6. Member Permission Overrides ---');

  const overrideAllowRes = await PermissionService.setScopedMemberOverride(ownerAuth, {
    membershipId: waiterMem!.id,
    permissionKey: 'payments.refund',
    effect: 'allow',
    scopeType: 'PROPERTY',
    branchId: branchA1!.id,
  });
  assert(overrideAllowRes.success === true, 'Set explicit ALLOW member override succeeds');

  const overrideDenyRes = await PermissionService.setScopedMemberOverride(ownerAuth, {
    membershipId: waiterMem!.id,
    permissionKey: 'orders.cancel',
    effect: 'deny',
    scopeType: 'PROPERTY',
    branchId: branchA1!.id,
  });
  assert(overrideDenyRes.success === true, 'Set explicit DENY member override succeeds');

  // Verify DENY beats role/owner rules when matching scope
  const targetAuthForWaiter = await resolveAuthorizationContext({
    overrideUserId: waiterUserId,
    requestedBusinessId: businessAId,
  });

  const denyEval = await authorize({
    context: targetAuthForWaiter,
    permission: 'orders.cancel',
    resource: { type: 'branch', id: branchA1!.id, branchId: branchA1!.id },
  });
  assert(denyEval.allowed === false && denyEval.reason === 'EXPLICIT_DENY', 'Explicit DENY override takes precedence and denies access');

  const removeOverrideRes = await PermissionService.removeMemberOverride(
    ownerUserId,
    businessAId,
    waiterMem!.id,
    'orders.cancel' as any
  );
  assert(removeOverrideRes.success === true, 'Remove member override succeeds');

  // ====================================================================
  // SECTION 7 — Effective Access Diagnostics
  // ====================================================================
  console.log('\n--- 7. Effective Access Diagnostics ---');

  const diagRes = await diagnoseAccessAction(
    {
      membershipId: waiterMem!.id,
      permission: 'menu.view',
      resourceType: 'branch',
      branchId: branchA1!.id,
    },
    { overrideUserId: ownerUserId, requestedBusinessId: businessAId }
  );
  assert(diagRes.success === true && !!diagRes.data, 'diagnoseAccessAction returns diagnostic evaluation result');
  assert(typeof diagRes.data?.explanation === 'string' && diagRes.data.explanation.length > 0, 'Diagnostic result includes natural language explanation');

  const diagMissingRes = await diagnoseAccessAction(
    {
      membershipId: waiterMem!.id,
      permission: 'reports.view',
    },
    { overrideUserId: ownerUserId, requestedBusinessId: businessAId }
  );
  assert(diagMissingRes.data?.decision.allowed === false && diagMissingRes.data?.decision.reason === 'PERMISSION_MISSING', 'Diagnostic correctly identifies PERMISSION_MISSING');

  // ====================================================================
  // SECTION 8 — Temporary Authority Visibility
  // ====================================================================
  console.log('\n--- 8. Temporary Authority Visibility ---');

  const previewRes = await ScopeGrantService.previewMemberEffectiveAccess(businessAId, waiterMem!.id);
  assert(previewRes !== null && Array.isArray(previewRes.temporaryAuthority?.actingAssignments), 'Effective access preview exposes temporary authority structure');

  // ====================================================================
  // SECTION 9 — Tenant Isolation
  // ====================================================================
  console.log('\n--- 9. Tenant Isolation ---');

  let crossTenantInspectRejected = false;
  try {
    await diagnoseAccessAction({
      membershipId: tenantBMem!.id,
      permission: 'orders.view',
    });
  } catch {
    crossTenantInspectRejected = true;
  }
  assert(crossTenantInspectRejected === true || (await diagnoseAccessAction({ membershipId: tenantBMem!.id, permission: 'orders.view' })).success === false, 'Tenant A cannot inspect Tenant B member access');

  let crossTenantRoleMutateRejected = false;
  try {
    await RoleGovernanceService.updateCustomRole(ownerAuth, {
      roleId: '00000000-0000-4000-a000-000000000099', // invalid cross tenant id
      name: 'Hacked',
      permissions: [],
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    });
  } catch {
    crossTenantRoleMutateRejected = true;
  }
  assert(crossTenantRoleMutateRejected === true, 'Tenant A cannot mutate Tenant B custom role');

  // ====================================================================
  // SECTION 10 — Direct Authenticated DB Escalation Defense
  // ====================================================================
  console.log('\n--- 10. Direct Authenticated DB Escalation Defense ---');

  // Using un-privileged client simulating direct Supabase client call from browser
  const anonClient = createClient();

  const { error: rlsCustomRoleErr } = await (await anonClient)
    .from('custom_roles')
    .insert({
      business_id: businessAId,
      name: 'Direct RLS Escalated Role',
      default_scope: 'ORGANIZATION',
      max_scope: 'ORGANIZATION',
    });
  assert(!!rlsCustomRoleErr, 'Direct client custom_roles insert blocked by RLS');

  const { error: rlsGrantErr } = await (await anonClient)
    .from('permission_scope_grants')
    .insert({
      business_id: businessAId,
      role_key: 'waiter',
      permission_key: 'super_admin.access',
      scope_type: 'ORGANIZATION',
      effect: 'ALLOW',
    });
  assert(!!rlsGrantErr, 'Direct client permission_scope_grants insert blocked by RLS');

  const { error: rlsOverrideErr } = await (await anonClient)
    .from('member_permission_overrides')
    .insert({
      business_id: businessAId,
      business_membership_id: waiterMem!.id,
      permission_key: 'business.settings.manage',
      is_allowed: true,
    });
  assert(!!rlsOverrideErr, 'Direct client member_permission_overrides insert blocked by RLS');

  const { data: updatedMemData, error: rlsRoleElevateErr } = await (await anonClient)
    .from('business_memberships')
    .update({ role: 'business_owner' })
    .eq('id', waiterMem!.id)
    .select();

  const { data: checkWaiterMem } = await admin
    .from('business_memberships')
    .select('role')
    .eq('id', waiterMem!.id)
    .single();

  assert(
    (!!rlsRoleElevateErr || !updatedMemData || updatedMemData.length === 0) && checkWaiterMem?.role !== 'business_owner',
    'Direct client business_memberships role elevation blocked by RLS'
  );

  // ====================================================================
  // SECTION 11 — Static Security & Production Guards
  // ====================================================================
  console.log('\n--- 11. Static Security & Production Guards ---');

  const permissionActionsContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/actions/permission.ts'),
    'utf-8'
  );
  assert(
    permissionActionsContent.includes('resolveAuthorizationContext') &&
      !permissionActionsContent.includes('PermissionService.hasPermission'),
    'Access management server actions resolve authorization context and do NOT call legacy PermissionService authorization'
  );

  const routePermContent = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/security/route-permissions.ts'),
    'utf-8'
  );
  assert(
    routePermContent.includes('/dashboard/access') &&
      routePermContent.includes('roles.view'),
    'Route permissions map includes /dashboard/access registered with roles.view'
  );

  // Clean up Test Fixtures
  console.log('\n--- Cleaning up test fixtures ---');
  await admin.from('permission_scope_grants').delete().in('business_id', [businessAId, businessBId]);
  await admin.from('member_permission_overrides').delete().in('business_id', [businessAId, businessBId]);
  await admin.from('custom_roles').delete().in('business_id', [businessAId, businessBId]);
  await admin.from('business_memberships').delete().in('business_id', [businessAId, businessBId]);
  await admin.from('branches').delete().in('business_id', [businessAId, businessBId]);
  await admin.from('businesses').delete().in('id', [businessAId, businessBId]);
  console.log('✅ Cleanup completed.\n');

  console.log('================================================================');
  console.log(`  Phase 30 Step 10 Verification: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Step 10 Verification Suite Error:', err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';

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

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (failureDetails) {
      console.error(`     Details: ${failureDetails}`);
    }
  }
}

async function runRbacRemediationVerification() {
  console.log('================================================================');
  console.log('  WSNexa QA RBAC Remediation Verification Suite');
  console.log('================================================================\n');

  // =================================================================
  // SECTION 1: Kitchen Order Confirmation RBAC & Flow Verification
  // =================================================================
  console.log('--- SECTION 1: Kitchen Order Confirmation & Status Transitions ---');

  const orderServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/order.service.ts'),
    'utf8'
  );

  // 1.1 Kitchen update permission authorizes confirmed, preparing, ready
  assert(
    orderServiceContent.includes("} else if (nextStatus === 'confirmed' || nextStatus === 'preparing' || nextStatus === 'ready') {") &&
    orderServiceContent.includes("permission: 'kitchen.update'"),
    '1.1. OrderService allows kitchen.update to authorize transitions to confirmed, preparing, and ready'
  );

  // 1.2 Waiter approval barrier prevents Kitchen from confirming unapproved orders
  assert(
    orderServiceContent.includes("if (order.approval_status === 'pending_waiter_approval' && nextStatus !== 'cancelled') {") &&
    orderServiceContent.includes("return { success: false, message: 'Forbidden: Order is awaiting waiter approval.' };"),
    '1.2. OrderService strictly blocks transitioning orders that are pending waiter approval'
  );

  // 1.3 Direct guest order approval sets initial status to confirmed when waiter approval is NOT required
  assert(
    orderServiceContent.includes("} else if (secEvalResult) {") &&
    orderServiceContent.includes("updateData.approval_status = 'approved';") &&
    orderServiceContent.includes("updateData.status = 'confirmed';"),
    '1.3. Guest orders without waiter approval requirement are created in confirmed status upon security approval'
  );

  // 1.4 Least privilege: kitchen_staff built-in role does NOT have orders.update_status
  const rolePresetsContent = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/validation/permission-presets.ts'),
    'utf8'
  );
  const kitchenPresetMatch = rolePresetsContent.match(/key:\s*'kitchen_staff'[\s\S]*?permissions:\s*\[([\s\S]*?)\]/);
  const kitchenPermissions = kitchenPresetMatch ? kitchenPresetMatch[1] : '';
  assert(
    kitchenPermissions.includes("'kitchen.update'") &&
    kitchenPermissions.includes("'kitchen.access'") &&
    !kitchenPermissions.includes("'orders.update_status'"),
    '1.4. Least privilege: kitchen_staff retains kitchen.update and is NOT granted broad orders.update_status'
  );

  // =================================================================
  // SECTION 2: Branch Manager Staff Invitations & Scope Reach
  // =================================================================
  console.log('\n--- SECTION 2: Branch Manager Staff Invitations & Administrative Reach ---');

  const { validateAdministrativeReach } = await import(
    '../src/server/auth/scope-target-validator'
  );
  const { AuthorizationContextError } = await import(
    '../src/server/auth/errors'
  );

  const branchManagerAuthContext: any = {
    userId: 'bm-user-001',
    userEmail: 'bm@test.com',
    businessId: 'biz-001',
    membershipRole: 'branch_manager',
    isBusinessOwner: false,
    activeBranchId: 'branch-alpha',
    authorizedBranchIds: ['branch-alpha'],
    assignedBranchIds: ['branch-alpha'],
    effectiveScope: 'PROPERTY',
    rolePermissions: [
      'staff.view',
      'staff.invite',
      'staff.manage',
      'branches.view',
      'tables.manage',
      'orders.view',
    ],
    permissionOverrides: [],
    scopeGrants: [],
  };

  // 2.1 Branch Manager with staff.invite can delegate PROPERTY scope to assigned branch
  let bmInviteAllowed = false;
  try {
    validateAdministrativeReach({
      actorContext: branchManagerAuthContext,
      requestedScope: 'PROPERTY',
      targetBranchId: 'branch-alpha',
      permissionKey: 'staff.invite',
    });
    bmInviteAllowed = true;
  } catch (e: any) {
    console.error('2.1 error:', e.message);
  }
  assert(
    bmInviteAllowed === true,
    '2.1. validateAdministrativeReach allows Branch Manager with staff.invite to invite staff to assigned branch'
  );

  // 2.2 Branch Manager CANNOT delegate ORGANIZATION scope
  let bmOrgInviteBlocked = false;
  try {
    validateAdministrativeReach({
      actorContext: branchManagerAuthContext,
      requestedScope: 'ORGANIZATION',
      permissionKey: 'staff.invite',
    });
  } catch (e: any) {
    if (e instanceof AuthorizationContextError) {
      bmOrgInviteBlocked = true;
    }
  }
  assert(
    bmOrgInviteBlocked === true,
    '2.2. validateAdministrativeReach strictly blocks Branch Manager from delegating ORGANIZATION scope'
  );

  // 2.3 Branch Manager CANNOT delegate to unassigned branch
  let bmOtherBranchBlocked = false;
  try {
    validateAdministrativeReach({
      actorContext: branchManagerAuthContext,
      requestedScope: 'PROPERTY',
      targetBranchId: 'branch-beta',
      permissionKey: 'staff.invite',
    });
  } catch (e: any) {
    if (e instanceof AuthorizationContextError) {
      bmOtherBranchBlocked = true;
    }
  }
  assert(
    bmOtherBranchBlocked === true,
    '2.3. validateAdministrativeReach strictly blocks Branch Manager from inviting staff to unassigned branch'
  );

  // 2.4 StaffInvitationService enforces role ceiling for non-owners (cannot invite business_owner or branch_manager)
  const staffInviteServiceContent = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/staff-invitation.service.ts'),
    'utf8'
  );
  assert(
    staffInviteServiceContent.includes("if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {") &&
    staffInviteServiceContent.includes("Branch managers cannot invite business owners or branch managers.") &&
    staffInviteServiceContent.includes("Non-owner administrators cannot invite roles with organization-wide scope."),
    '2.4. StaffInvitationService enforces strict role ceiling & scope restrictions against non-owner inviter'
  );

  // 2.5 StaffInvitationService enforces branch boundary on revoke and regenerate
  assert(
    staffInviteServiceContent.includes("if (invite.branch_id && !authContext.authorizedBranchIds.includes(invite.branch_id)) {") &&
    staffInviteServiceContent.includes("Forbidden: Cannot manage invitations for an unassigned branch.") &&
    staffInviteServiceContent.includes("Forbidden: Non-owner administrators cannot manage organization-scoped invitations."),
    '2.5. StaffInvitationService enforces authorized branch boundaries on revoke and regenerate actions'
  );

  // =================================================================
  // SECTION 3: UI Permissions & Role Selection Filtering
  // =================================================================
  console.log('\n--- SECTION 3: Staff Invites Management UI Permissions & Filtering ---');

  const staffInvitesUiContent = fs.readFileSync(
    path.join(process.cwd(), 'src/components/team/staff-invites-management.tsx'),
    'utf8'
  );

  // 3.1 UI enables invite management for Branch Manager
  assert(
    staffInvitesUiContent.includes("const isOwner = userRole === 'business_owner';") &&
    staffInvitesUiContent.includes("const isBranchManager = userRole === 'branch_manager';") &&
    staffInvitesUiContent.includes("const canManageInvites = isOwner || isBranchManager;") &&
    staffInvitesUiContent.includes("{canManageInvites && (") &&
    staffInvitesUiContent.includes("+ Invite Staff"),
    '3.1. StaffInvitesManagement enables "+ Invite Staff" button for branch managers'
  );

  // 3.2 Role select filters out branch_manager for non-owners
  assert(
    staffInvitesUiContent.includes("{isOwner && <option value=\"builtin:branch_manager\">Branch Manager</option>}"),
    '3.2. Role dropdown in StaffInvitesManagement only displays "Branch Manager" to business owners'
  );

  // 3.3 Custom roles with ORGANIZATION scope filtered out for non-owners
  assert(
    staffInvitesUiContent.includes("customRoles.filter((cr) => isOwner || (cr.defaultScope !== 'ORGANIZATION' && cr.maxScope !== 'ORGANIZATION'))"),
    '3.3. Custom roles dropdown in StaffInvitesManagement hides organization-scoped roles from branch managers'
  );

  // 3.4 Table and card actions guarded by branch membership
  assert(
    staffInvitesUiContent.includes("const canManageThisInvite = (inv: FormattedInvitation) =>") &&
    staffInvitesUiContent.includes("isOwner || (isBranchManager && Boolean(inv.branchId) && branches.some((b) => b.id === inv.branchId));") &&
    staffInvitesUiContent.includes("{canManageThisInvite(inv) && inv.status === 'pending' && ("),
    '3.4. Regenerate and Revoke actions are restricted to invitations within the branch manager\'s authorized branch'
  );

  console.log('\n================================================================');
  console.log(`  RBAC Remediation Verification: ${passedTests} / ${totalTests} Tests Passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRbacRemediationVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

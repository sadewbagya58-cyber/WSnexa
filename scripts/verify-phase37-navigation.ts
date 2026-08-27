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

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

async function runAssertions() {
  const {
    CANONICAL_DASHBOARD_NAV_SECTIONS,
    getParentNavPath,
    isNavItemActive,
  } = await import('../src/lib/navigation/dashboard-navigation');
  const {
    resolveDashboardNavigation,
  } = await import('../src/server/navigation/navigation-engine');
  const { resolveDefaultWorkspaceRoute } = await import('../src/server/tenant/guard');
  const { ROLE_PRESETS, getPermissionsForPreset } = await import('../src/lib/validation/permission-presets');
  type AuthorizationContext = import('../src/types/authorization.types').AuthorizationContext;

  console.log('================================================================');
  console.log('  WSNexa Phase 37 Step 2: Simplified Navigation & Roles UX Verification');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      failed++;
    }
  }

  // --- 1. Canonical Navigation Config Assertions ---
  console.log('--- 1. Canonical Navigation Config ---');
  const allItems = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  assert(allItems.length === 10, `Canonical nav sections contain exactly 10 primary items (got ${allItems.length})`);

  const expectedLabels = [
    'Dashboard',
    'Orders',
    'Menu',
    'Dining & QR',
    'Reservations',
    'Customers',
    'Operations',
    'Team',
    'Reports',
    'Settings',
  ];

  for (const label of expectedLabels) {
    const found = allItems.some((item) => item.label === label);
    assert(found, `Primary navigation contains label "${label}"`);
  }

  // --- 2. Owner Navigation Resolution Assertions ---
  console.log('\n--- 2. Business Owner Resolution ---');
  const ownerContext = {
    userId: 'user_owner_123',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: true,
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const ownerNav = resolveDashboardNavigation(ownerContext);
  const ownerItems = ownerNav.flatMap((s) => s.items);
  assert(ownerItems.length === 10, `Business Owner resolves all 10 primary items (got ${ownerItems.length})`);

  // --- 3. Role-Based Parent Hub Collapse Assertions ---
  console.log('\n--- 3. Role-Based Parent Hub Collapse ---');
  const restrictedContext = {
    userId: 'user_staff_456',
    businessId: 'bus_123',
    authorizedBranchIds: ['branch_123'],
    activeBranchId: 'branch_123',
    isBusinessOwner: false,
    rolePermissions: ['inventory.counts.manage'],
    permissionOverrides: [],
    scopeGrants: [],
  } as unknown as AuthorizationContext;

  const restrictedNav = resolveDashboardNavigation(restrictedContext);
  const restrictedItems = restrictedNav.flatMap((s) => s.items);

  const hasOperations = restrictedItems.some((i) => i.id === 'operations');
  assert(hasOperations, 'Operations workspace is visible to user with inventory.counts.manage');

  const hasCustomers = restrictedItems.some((i) => i.id === 'customers');
  assert(!hasCustomers, 'Customers workspace collapses for user without customer permissions');

  const hasDining = restrictedItems.some((i) => i.id === 'dining');
  assert(!hasDining, 'Dining workspace collapses for user without dining permissions');

  // --- 4. Direct Operational Landing Routes ---
  console.log('\n--- 4. Direct Operational Staff Landing Routes ---');
  assert(resolveDefaultWorkspaceRoute('cashier') === '/dashboard/cashier', 'Cashier lands directly on /dashboard/cashier');
  assert(resolveDefaultWorkspaceRoute('kitchen_staff') === '/dashboard/kitchen', 'Kitchen Staff lands directly on /dashboard/kitchen');
  assert(resolveDefaultWorkspaceRoute('waiter') === '/dashboard/waiter', 'Waiter lands directly on /dashboard/waiter');
  assert(resolveDefaultWorkspaceRoute('business_owner') === '/dashboard', 'Business Owner lands on /dashboard');

  // --- 5. Detail Route Parent Mapping ---
  console.log('\n--- 5. Detail Route Parent Mapping & Active Highlights ---');
  assert(getParentNavPath('/dashboard/tables') === '/dashboard/dining', '/dashboard/tables maps to /dashboard/dining');
  assert(getParentNavPath('/dashboard/reviews') === '/dashboard/customers', '/dashboard/reviews maps to /dashboard/customers');
  assert(getParentNavPath('/dashboard/inventory/recipes') === '/dashboard/inventory', '/dashboard/inventory/recipes maps to /dashboard/inventory');
  assert(getParentNavPath('/dashboard/access/roles') === '/dashboard/team', '/dashboard/access/roles maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/team/roles') === '/dashboard/team', '/dashboard/team/roles maps to /dashboard/team');
  assert(getParentNavPath('/dashboard/cashier') === '/dashboard/orders', '/dashboard/cashier maps to /dashboard/orders');

  const diningItem = { href: '/dashboard/dining' };
  assert(isNavItemActive(diningItem, '/dashboard/tables'), 'isNavItemActive correctly highlights Dining & QR for /dashboard/tables');

  const teamItem = { href: '/dashboard/team' };
  assert(isNavItemActive(teamItem, '/dashboard/access/roles'), 'isNavItemActive correctly highlights Team for /dashboard/access/roles');
  assert(isNavItemActive(teamItem, '/dashboard/team/roles'), 'isNavItemActive correctly highlights Team for legacy /dashboard/team/roles');

  // --- 6. Roles UX & Canonical Presets Verification ---
  console.log('\n--- 6. Canonical Presets & Role Governance ---');
  assert(ROLE_PRESETS.length >= 4, `At least 4 canonical presets exist (got ${ROLE_PRESETS.length})`);
  const cashierPreset = getPermissionsForPreset('cashier');
  assert(cashierPreset.includes('cashier.access'), 'Cashier preset includes cashier.access');
  assert(cashierPreset.includes('payments.record'), 'Cashier preset includes payments.record');

  const kitchenPreset = getPermissionsForPreset('kitchen_staff');
  assert(kitchenPreset.includes('kitchen.access'), 'Kitchen preset includes kitchen.access');
  assert(kitchenPreset.includes('kitchen.update'), 'Kitchen preset includes kitchen.update');

  const waiterPreset = getPermissionsForPreset('waiter');
  assert(waiterPreset.includes('waiter.access'), 'Waiter preset includes waiter.access');
  assert(waiterPreset.includes('waiter.orders.create'), 'Waiter preset includes waiter.orders.create');

  // --- 7. Role Editor Wizard Auto-Submit Prevention Assertions ---
  console.log('\n--- 7. Role Editor Wizard Auto-Submit Prevention ---');
  const roleEditorPath = path.join(process.cwd(), 'src/components/access/role-editor-modal.tsx');
  assert(fs.existsSync(roleEditorPath), 'role-editor-modal.tsx exists');
  const roleEditorContent = fs.readFileSync(roleEditorPath, 'utf8');

  assert(!roleEditorContent.includes('<form onSubmit='), 'RoleEditorModal does not use outer <form onSubmit> wrapper');
  assert(roleEditorContent.includes("if (mode === 'create' && step !== 3)"), 'handleFinalSubmit strictly guards against premature submission before Step 3');
  assert(roleEditorContent.includes('key="final-submit-save-btn"'), 'Final submit button has distinct key attribute to prevent DOM element recycling');
  assert(roleEditorContent.includes('handleNextStep'), 'Explicit handleNextStep advances wizard without calling create action');
  assert(roleEditorContent.includes('handlePrevStep'), 'Explicit handlePrevStep goes back without calling save action');

  // --- 8. Staff Invitations Custom Roles Integration ---
  console.log('\n--- 8. Staff Invitations Custom Roles Integration ---');
  const invitesPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/team/invites/page.tsx');
  const invitesPageContent = fs.readFileSync(invitesPagePath, 'utf8');
  assert(invitesPageContent.includes('RoleGovernanceService.listCustomRoles'), 'Invites page queries active custom roles');
  assert(invitesPageContent.includes('customRoles={customRoles}'), 'Invites page passes customRoles prop to StaffInvitesManagement');

  const invitesCompPath = path.join(process.cwd(), 'src/components/team/staff-invites-management.tsx');
  const invitesCompContent = fs.readFileSync(invitesCompPath, 'utf8');
  assert(invitesCompContent.includes('<optgroup label="Custom Roles">'), 'Staff invites dropdown includes optgroup for Custom Roles');
  assert(invitesCompContent.includes('<optgroup label="Built-in Roles">'), 'Staff invites dropdown includes optgroup for Built-in Roles');
  const inviteServicePath = path.join(process.cwd(), 'src/server/services/staff-invitation.service.ts');
  const inviteServiceContent = fs.readFileSync(inviteServicePath, 'utf8');
  assert(inviteServiceContent.includes('customRoleId: (r.custom_role_id as string) || cr?.id || null'), 'Staff invitation service maps customRoleId');
  assert(inviteServiceContent.includes("Cannot invite with an archived or inactive custom role"), 'StaffInvitationService verifies custom role is active');
  assert(inviteServiceContent.includes("The custom role associated with this invitation has been archived"), 'StaffInvitationService revalidates custom role on claim');

  // --- 9. Custom Role Claim — Old Permission Leakage Hotfix ---
  console.log('\n--- 9. Custom Role Claim — Old Permission Leakage Hotfix ---');

  // A. claimInvitation: onboarding_intent must not be built-in role for custom-role invites
  assert(
    inviteServiceContent.includes("invite.custom_role_id ? 'staff' : invite.assigned_role"),
    "claimInvitation: uses 'staff' as onboarding_intent for custom-role invitations, not the base built-in role"
  );

  // B. claimInvitation: target route must not route to cashier/kitchen/waiter for custom-role invites
  assert(
    inviteServiceContent.includes('if (!invite.custom_role_id)'),
    'claimInvitation: target route switch is guarded by !invite.custom_role_id check'
  );

  // C. claimInvitation: old member_permission_overrides are cleared on role reassignment
  assert(
    inviteServiceContent.includes("'member_permission_overrides'") &&
      inviteServiceContent.includes('.delete()') &&
      inviteServiceContent.includes('SECURITY: Clear all old member-level permission overrides'),
    'claimInvitation: clears old member_permission_overrides when existing member is reassigned a new role'
  );

  // D. claimInvitation: membership-level permission_scope_grants are cleared on role reassignment
  assert(
    inviteServiceContent.includes("'permission_scope_grants'") &&
      inviteServiceContent.includes('.is(\'role_key\', null)') &&
      inviteServiceContent.includes(".is('custom_role_id', null)"),
    'claimInvitation: clears old membership-level permission_scope_grants when existing member is reassigned'
  );

  // E. authorization-context: scope grants query is isolated for custom-role members
  const authContextPath = path.join(process.cwd(), 'src/server/auth/authorization-context.ts');
  const authContextContent = fs.readFileSync(authContextPath, 'utf8');
  assert(
    authContextContent.includes('activeMembership.custom_role_id') &&
      authContextContent.includes('? `business_membership_id.eq.${activeMembership.id},custom_role_id.eq.${activeMembership.custom_role_id}`') &&
      authContextContent.includes(': `business_membership_id.eq.${activeMembership.id},role_key.eq.${activeMembership.role}`'),
    'authorization-context: scope grants query uses custom_role_id isolation when member has custom role'
  );

  // F. authorization-context: role scope presets query is isolated for custom-role members
  assert(
    authContextContent.includes('? `custom_role_id.eq.${activeMembership.custom_role_id}`') &&
      authContextContent.includes(': `role_key.eq.${activeMembership.role}`'),
    'authorization-context: role scope presets query uses custom_role_id isolation when member has custom role'
  );

  // G. resolveDefaultWorkspaceRoute: custom_role_id parameter causes /dashboard return
  assert(
    resolveDefaultWorkspaceRoute('cashier', 'some-uuid') === '/dashboard',
    "resolveDefaultWorkspaceRoute: returns '/dashboard' when customRoleId is provided, even if role='cashier'"
  );
  assert(
    resolveDefaultWorkspaceRoute('cashier', null) === '/dashboard/cashier',
    "resolveDefaultWorkspaceRoute: still returns '/dashboard/cashier' for built-in cashier without customRoleId"
  );
  assert(
    resolveDefaultWorkspaceRoute('cashier', undefined) === '/dashboard/cashier',
    "resolveDefaultWorkspaceRoute: still returns '/dashboard/cashier' for built-in cashier with undefined customRoleId"
  );

  // H. DashboardShell: accepts userCustomRoleId and userCustomRoleName props
  const shellPath = path.join(process.cwd(), 'src/components/layout/dashboard-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');
  assert(
    shellContent.includes('userCustomRoleId?: string | null') &&
      shellContent.includes('userCustomRoleName?: string | null'),
    'DashboardShell interface has userCustomRoleId and userCustomRoleName optional props'
  );
  assert(
    shellContent.includes('formatRoleLabel(userRole, userCustomRoleName)'),
    'DashboardShell calls formatRoleLabel with userCustomRoleName for role header badge'
  );
  assert(
    shellContent.includes("if (customRoleName) return customRoleName"),
    'formatRoleLabel returns customRoleName immediately if present, skipping built-in role label'
  );

  // I. ActiveTenantContext type: membership includes customRoleId and customRoleName
  const typesPath = path.join(process.cwd(), 'src/types/index.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  assert(
    typesContent.includes('customRoleId?: string | null') &&
      typesContent.includes('customRoleName?: string | null'),
    'ActiveTenantContext.membership includes optional customRoleId and customRoleName fields'
  );

  // J. Tenant resolver: includes custom role name lookup and maps to membership context
  const resolverPath = path.join(process.cwd(), 'src/server/tenant/resolver.ts');
  const resolverContent = fs.readFileSync(resolverPath, 'utf8');
  assert(
    resolverContent.includes('customRoleName') && resolverContent.includes("'custom_roles'"),
    'Tenant resolver fetches custom role name and maps it into membership context'
  );

  // --- 10. Super Admin & Public Route Isolation ---
  console.log('\n--- 10. Super Admin Isolation ---');
  const hasAdminRoutes = allItems.some((i) => i.href.startsWith('/admin'));
  assert(!hasAdminRoutes, 'No Super Admin /admin routes present in business workspace navigation');

  console.log('\n================================================================');
  console.log(`  Phase 37 Step 2 Navigation & Roles Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions().catch((err) => {
  console.error('Unexpected error running assertions:', err);
  process.exit(1);
});

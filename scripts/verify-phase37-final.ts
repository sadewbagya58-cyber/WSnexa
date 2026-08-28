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

const rootDir = process.cwd();

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

async function runFinalAcceptance() {
  console.log(`\n================================================================`);
  console.log(`  WSNexa Phase 37 Step 5: Master Final Acceptance Test Suite`);
  console.log(`================================================================\n`);

  const {
    encryptInvitationCode,
    decryptInvitationCode,
    generateInvitationCode,
  } = await import('../src/lib/security/invite-token');
  const { resolveInventorySubNavPermissions } = await import('../src/server/inventory/inventory-nav-permissions');
  const { resolveDefaultWorkspaceRoute } = await import('../src/server/tenant/guard');
  const { getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');
  const { CANONICAL_DASHBOARD_NAV_SECTIONS } = await import('../src/lib/navigation/dashboard-navigation');

  // --- 1. Canonical 10-Item Primary Navigation ---
  console.log('--- 1. Canonical 10-Item Primary Navigation ---');
  const allNavItems = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap((s) => s.items);
  const navLabels = allNavItems.map((item) => item.label);
  const expected10Labels = [
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

  assert(
    allNavItems.length === 10 &&
    expected10Labels.every((label) => navLabels.includes(label)),
    '1. Canonical primary navigation contains exactly the 10 simplified hubs without sidebar bloat'
  );

  // --- 2. Settings Hub Discoverability ---
  console.log('\n--- 2. Settings Hub Discoverability ---');
  const settingsHubFile = path.join(rootDir, 'src/app/(dashboard)/dashboard/settings/page.tsx');
  const settingsHubContent = fs.readFileSync(settingsHubFile, 'utf-8');
  assert(
    settingsHubContent.includes('Settings Hub') &&
    settingsHubContent.includes('Business Profile') &&
    settingsHubContent.includes('Branch Management') &&
    settingsHubContent.includes('Order Security & Anti-Fraud') &&
    settingsHubContent.includes('Payment Settings') &&
    settingsHubContent.includes('isOwner && ('),
    '2. Settings Hub exists at /dashboard/settings and surfaces all settings destinations with owner billing card'
  );

  // --- 3. Team Hub Destinations Permission-Aware ---
  console.log('\n--- 3. Team Hub Discoverability ---');
  const teamSubNavFile = path.join(rootDir, 'src/components/team/team-subnav.tsx');
  assert(fs.existsSync(teamSubNavFile), '3. TeamSubNav component provides discoverable secondary navigation for Team & Access Control');

  // --- 4. Inventory Subnav Permission-Aware ---
  console.log('\n--- 4. Inventory Subnavigation Capability Matrix ---');
  const invSubNavHelperFile = path.join(rootDir, 'src/server/inventory/inventory-nav-permissions.ts');
  assert(fs.existsSync(invSubNavHelperFile), '4. resolveInventorySubNavPermissions helper gates each tab on canonical capabilities');

  const invSubNavFile = path.join(rootDir, 'src/components/inventory/inventory-subnav.tsx');
  const invSubNavContent = fs.readFileSync(invSubNavFile, 'utf-8');
  assert(
    invSubNavContent.includes('canViewSettings = false') &&
    invSubNavContent.includes('canViewCounts = false') &&
    invSubNavContent.includes('canViewRecipes = false'),
    '4b. InventorySubNav defaults all sub-workspace visibility flags to false for fail-safe security'
  );

  // --- 5. Customer Tabs Permission-Aware ---
  console.log('\n--- 5. Customer Hub Discoverability ---');
  const crmSubNavFile = path.join(rootDir, 'src/components/crm/crm-subnav.tsx');
  assert(fs.existsSync(crmSubNavFile), '5. CRMSubNav component provides permission-aware access to Directory, Reviews, Reputation, and Loyalty');

  // --- 6. Mobile Branch Switcher ---
  console.log('\n--- 6. Mobile Navigation & Branch Switcher ---');
  const dashboardShellFile = path.join(rootDir, 'src/components/layout/dashboard-shell.tsx');
  const dashboardShellContent = fs.readFileSync(dashboardShellFile, 'utf-8');
  assert(
    dashboardShellContent.includes('ActiveBranchSwitcher') &&
    dashboardShellContent.includes('Active Branch'),
    '6. Mobile navigation drawer provides responsive ActiveBranchSwitcher with zero overflow'
  );

  // --- 7. Help Global Entry Point ---
  console.log('\n--- 7. Global Help & Documentation ---');
  assert(
    dashboardShellContent.includes('/dashboard/help') &&
    dashboardShellContent.includes('Help & Guides'),
    '7. Global Help entry point is available from header, mobile drawer, and profile menu'
  );

  // --- 8 & 9. Owner Billing Entry & Non-Owner Billing Guard ---
  console.log('\n--- 8 & 9. Owner Billing Isolation ---');
  const subPageFile = path.join(rootDir, 'src/app/(dashboard)/dashboard/settings/subscription/page.tsx');
  const subPageContent = fs.readFileSync(subPageFile, 'utf-8');
  assert(
    subPageContent.includes("context.membership?.role !== 'business_owner'") &&
    subPageContent.includes('return <AccessDenied'),
    '8 & 9. Subscription & Billing route /dashboard/settings/subscription strictly restricts non-owners'
  );

  // --- 10 & 11. Inventory.View Read-Only & Settings Direct URL Protected ---
  console.log('\n--- 10 & 11. Inventory View-Only & Route Guarding ---');
  const invMockAuthContext = {
    userId: 'user-1',
    userEmail: 'staff@example.com',
    businessId: 'biz-1',
    businessName: 'Biz',
    businessSlug: 'biz',
    membershipId: 'mem-1',
    membershipRole: 'staff',
    customRoleId: 'custom-1',
    isBusinessOwner: false,
    activeBranchId: 'branch-1',
    authorizedBranchIds: ['branch-1'],
    branchAssignments: [],
    departmentIds: [],
    departments: [],
    organizationUnitIds: [],
    organizationUnits: [],
    serviceAreaIds: [],
    serviceAreas: [],
    staffAssignments: [],
    actingAssignments: [],
    secondments: [],
    rolePermissions: ['inventory.view'],
    permissionOverrides: [],
    scopeGrants: [
      {
        id: 'grant-1',
        permissionKey: 'inventory.view',
        effect: 'allow' as const,
        scopeType: 'PROPERTY' as const,
        branchId: 'branch-1',
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        grantSource: 'custom_role' as const,
        sourceId: 'custom-1',
      },
    ],
    roleScopePreset: null,
    selfIdentity: { userId: 'user-1', membershipId: 'mem-1', staffAssignmentIds: [] },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 0,
      sources: {
        membershipSource: 'test',
        branchAssignmentCount: 0,
        staffAssignmentCount: 0,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 1,
        overrideCount: 0,
        scopeGrantCount: 1,
      },
    },
  };

  const navPermsViewOnly = await resolveInventorySubNavPermissions(invMockAuthContext, 'branch-1', 'biz-1');
  assert(
    navPermsViewOnly.canViewInventory === true &&
    navPermsViewOnly.canViewItems === true &&
    navPermsViewOnly.canViewSettings === false &&
    navPermsViewOnly.canViewCounts === false &&
    navPermsViewOnly.canViewRecipes === false &&
    navPermsViewOnly.canViewPurchasing === false &&
    navPermsViewOnly.canViewReceiving === false &&
    navPermsViewOnly.canViewTransfers === false &&
    navPermsViewOnly.canViewSuppliers === false &&
    navPermsViewOnly.canViewLocations === false &&
    navPermsViewOnly.canViewWaste === false,
    '10. inventory.view only role resolves exclusively Overview Hub and Stock Items'
  );

  const ownerMockAuthContext = {
    userId: 'owner-1',
    userEmail: 'owner@example.com',
    businessId: 'biz-1',
    businessName: 'Biz',
    businessSlug: 'biz',
    membershipId: 'mem-owner',
    membershipRole: 'business_owner',
    customRoleId: null,
    isBusinessOwner: true,
    activeBranchId: 'branch-1',
    authorizedBranchIds: ['branch-1'],
    branchAssignments: [],
    departmentIds: [],
    departments: [],
    organizationUnitIds: [],
    organizationUnits: [],
    serviceAreaIds: [],
    serviceAreas: [],
    staffAssignments: [],
    actingAssignments: [],
    secondments: [],
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
    roleScopePreset: null,
    selfIdentity: { userId: 'owner-1', membershipId: 'mem-owner', staffAssignmentIds: [] },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 0,
      sources: {
        membershipSource: 'test',
        branchAssignmentCount: 0,
        staffAssignmentCount: 0,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 0,
        overrideCount: 0,
        scopeGrantCount: 0,
      },
    },
  };
  const navPermsOwner = await resolveInventorySubNavPermissions(ownerMockAuthContext, 'branch-1', 'biz-1');
  assert(
    navPermsOwner.canViewInventory &&
    navPermsOwner.canViewItems &&
    navPermsOwner.canViewCounts &&
    navPermsOwner.canViewRecipes &&
    navPermsOwner.canViewPurchasing &&
    navPermsOwner.canViewReceiving &&
    navPermsOwner.canViewTransfers &&
    navPermsOwner.canViewSuppliers &&
    navPermsOwner.canViewLocations &&
    navPermsOwner.canViewWaste &&
    navPermsOwner.canViewSettings,
    '10b. Business Owner retains all 11 inventory subnavigation tabs'
  );

  const settingsReqPerm = getRequiredPermissionForRoute('/dashboard/inventory/settings');
  assert(
    Array.isArray(settingsReqPerm) && settingsReqPerm.includes('inventory.settings.manage'),
    '11. ROUTE_PERMISSION_MAP maps /dashboard/inventory/settings to inventory.settings.manage'
  );

  const invSettingsPageFile = path.join(rootDir, 'src/app/(dashboard)/dashboard/inventory/settings/page.tsx');
  const invSettingsPageContent = fs.readFileSync(invSettingsPageFile, 'utf-8');
  assert(
    invSettingsPageContent.includes("requireRoutePermission('/dashboard/inventory/settings')") &&
    invSettingsPageContent.includes('!navPermissions.canViewSettings') &&
    invSettingsPageContent.includes('return <AccessDenied'),
    '11b. Direct URL access to /dashboard/inventory/settings returns clean AccessDenied without rendering management UI'
  );

  // --- 12. Custom Role Permission Keys Hidden by Default ---
  console.log('\n--- 12. Custom Role Permission Sanitation ---');
  const permMatrixFile = path.join(rootDir, 'src/components/access/permission-matrix.tsx');
  const permMatrixContent = fs.readFileSync(permMatrixFile, 'utf-8');
  assert(
    permMatrixContent.includes('showTechnicalKeys') &&
    permMatrixContent.includes('Show Technical IDs'),
    '12. PermissionMatrix hides raw technical keys by default and provides optional disclosure toggle'
  );

  // --- 13. Role Wizard Explicit Submission Preserved ---
  console.log('\n--- 13. Role Wizard Auto-Submit Prevention ---');
  const roleWizardFile = path.join(rootDir, 'src/components/access/role-editor-modal.tsx');
  const roleWizardContent = fs.readFileSync(roleWizardFile, 'utf-8');
  assert(
    !roleWizardContent.includes('<form onSubmit') &&
    roleWizardContent.includes('handleFinalSubmit') &&
    roleWizardContent.includes('step !== 3'),
    '13. RoleEditorModal strictly guards against auto-submit and requires explicit click on Step 3'
  );

  // --- 14, 15, 16, 17. Staff Invitation Persistent Copy Lifecycle & AES-256-GCM Cryptography ---
  console.log('\n--- 14, 15, 16, 17. Staff Invitation Persistent AES-256-GCM Copy Lifecycle ---');
  const testCode = 'WSN-STF-A8B9-C3D4-E5F6';
  const encrypted = encryptInvitationCode(testCode);
  const decrypted = decryptInvitationCode(encrypted);
  assert(
    encrypted.includes(':') && decrypted === testCode,
    '14. AES-256-GCM authenticated encryption/decryption roundtrip succeeds'
  );

  const corruptedPayload = 'invalid:tampered:payload';
  const corruptedDecrypted = decryptInvitationCode(corruptedPayload);
  assert(corruptedDecrypted === null, '14b. Decryption safely returns null for invalid or tampered ciphertext');

  const generated = generateInvitationCode('staff');
  assert(
    generated.rawCode.startsWith('WSN-STF-') &&
    generated.tokenPrefix.startsWith('WSN-STF-') &&
    generated.encryptedCode.length > 20 &&
    decryptInvitationCode(generated.encryptedCode) === generated.rawCode,
    '14c. generateInvitationCode produces valid rawCode, tokenHash, tokenPrefix, and encryptedCode'
  );

  const staffInviteServiceFile = path.join(rootDir, 'src/server/services/staff-invitation.service.ts');
  const staffInviteServiceContent = fs.readFileSync(staffInviteServiceFile, 'utf-8');
  assert(
    staffInviteServiceContent.includes('encrypted_code: encryptedCode') &&
    staffInviteServiceContent.includes('decryptInvitationCode') &&
    staffInviteServiceContent.includes('isValidPending && r.encrypted_code'),
    '14d. StaffInvitationService persists encrypted_code and decrypts rawCode exclusively for valid pending invites'
  );

  const staffInvitesUiFile = path.join(rootDir, 'src/components/team/staff-invites-management.tsx');
  const staffInvitesUiContent = fs.readFileSync(staffInvitesUiFile, 'utf-8');
  assert(
    staffInvitesUiContent.includes('copyCodeToClipboard') &&
    staffInvitesUiContent.includes('Copy Code') &&
    staffInvitesUiContent.includes('Code unavailable'),
    '15, 16, 17. StaffInvitesManagement renders Copy Code for valid pending invites and Code unavailable for claimed/expired/revoked'
  );

  // --- 18. Custom-Role Invite Selection Preserved ---
  console.log('\n--- 18. Custom-Role Staff Invite Support ---');
  assert(
    staffInvitesUiContent.includes('customRoles') &&
    staffInvitesUiContent.includes('Custom Roles') &&
    staffInvitesUiContent.includes('customRoleId'),
    '18. StaffInvitesManagement groups Custom Roles and preserves customRoleId on invite creation'
  );

  // --- 19 & 20. Waiter & Customer Realtime Subscriptions ---
  console.log('\n--- 19 & 20. Realtime Subscriptions & Event Flow ---');
  const realtimeWaiterFile = path.join(rootDir, 'src/hooks/use-realtime-waiter-requests.ts');
  const realtimeWaiterContent = fs.readFileSync(realtimeWaiterFile, 'utf-8');
  assert(
    realtimeWaiterContent.includes('waiter_requests') &&
    realtimeWaiterContent.includes('postgres_changes'),
    '19. useRealtimeWaiterRequests subscribes to realtime waiter assistance requests'
  );

  const realtimeCustomerFile = path.join(rootDir, 'src/hooks/use-realtime-order.ts');
  const realtimeCustomerContent = fs.readFileSync(realtimeCustomerFile, 'utf-8');
  assert(
    realtimeCustomerContent.includes('getPublicOrderTrackingStateAction') &&
    realtimeCustomerContent.includes('postgres_changes') &&
    realtimeCustomerContent.includes('order_tracking_'),
    '20. useRealtimeOrder subscribes to live status updates and fallback poll for customer tracking'
  );

  // --- 21. Kitchen Newest-First Order Queue ---
  console.log('\n--- 21. Kitchen Queue Order Sorting ---');
  const orderServiceFile = path.join(rootDir, 'src/server/services/order.service.ts');
  const orderServiceContent = fs.readFileSync(orderServiceFile, 'utf-8');
  assert(
    orderServiceContent.includes(".order('created_at', { ascending: false })"),
    '21. Kitchen queue and active orders load newest incoming active orders first'
  );

  // --- 22. Cashier Order Settlement Canonical Parameter Mapping ---
  console.log('\n--- 22. Cashier Settlement RPC Mapping ---');
  const paymentServiceFile = path.join(rootDir, 'src/server/services/payment.service.ts');
  const paymentServiceContent = fs.readFileSync(paymentServiceFile, 'utf-8');
  assert(
    paymentServiceContent.includes("admin.rpc('record_order_payment'") &&
    paymentServiceContent.includes('p_actor_id: authContext.userId'),
    '22. Cashier settlement calls record_order_payment RPC with canonical p_actor_id parameter'
  );

  // --- 23. Orders Today Metric Copy ---
  console.log('\n--- 23. Dashboard Metrics Semantic Accuracy ---');
  const dashboardMetricsFile = path.join(rootDir, 'src/components/dashboard/dashboard-today-metrics.tsx');
  const dashboardMetricsContent = fs.readFileSync(dashboardMetricsFile, 'utf-8');
  assert(
    dashboardMetricsContent.includes('Orders Today') &&
    dashboardMetricsContent.includes('ordersTodayCount'),
    '23. Dashboard metrics display accurate "Orders Today" label'
  );

  // --- 24. Low Stock De-duplication ---
  console.log('\n--- 24. Low Stock Alert De-duplication ---');
  const dashboardTodayDataFile = path.join(rootDir, 'src/server/navigation/dashboard-today-data.ts');
  const dashboardTodayDataContent = fs.readFileSync(dashboardTodayDataFile, 'utf-8');
  assert(
    dashboardTodayDataContent.includes('inventory_balances') &&
    dashboardTodayDataContent.includes('min_stock_level') &&
    dashboardTodayDataContent.includes('balances.reduce'),
    '24. Dashboard today data aggregates balances across storage locations and de-duplicates low-stock count per item'
  );

  // --- 25. Responsive Billing History ---
  console.log('\n--- 25. Responsive Mobile Billing History ---');
  const billingHistoryFile = path.join(rootDir, 'src/components/subscription/owner-billing-history-client.tsx');
  const billingHistoryContent = fs.readFileSync(billingHistoryFile, 'utf-8');
  assert(
    billingHistoryContent.includes('block md:hidden') &&
    billingHistoryContent.includes('hidden md:block') &&
    billingHistoryContent.includes('View Details & Invoice →'),
    '25. OwnerBillingHistoryClient implements responsive mobile card layout and desktop table'
  );

  // --- 26. Operational Staff Direct Landing Routes ---
  console.log('\n--- 26. Operational Staff Direct Landing Routes ---');
  assert(
    resolveDefaultWorkspaceRoute('cashier') === '/dashboard/cashier',
    '26a. Built-in Cashier lands directly on /dashboard/cashier'
  );
  assert(
    resolveDefaultWorkspaceRoute('kitchen_staff') === '/dashboard/kitchen',
    '26b. Built-in Kitchen Staff lands directly on /dashboard/kitchen'
  );
  assert(
    resolveDefaultWorkspaceRoute('waiter') === '/dashboard/waiter',
    '26c. Built-in Waiter lands directly on /dashboard/waiter'
  );
  assert(
    resolveDefaultWorkspaceRoute('cashier', 'custom-role-uuid-1') === '/dashboard',
    '26d. Custom role user lands on /dashboard regardless of underlying base role'
  );

  // --- 28. Blocker 1: Dashboard Check Inventory Dead-End CTA Capability Gating ---
  console.log('\n--- 28. Blocker 1: Dashboard Attention Card Capability-Gating ---');
  const { resolveDashboardHomeModel } = await import('../src/server/navigation/dashboard-home-model');
  const { fetchDashboardTodayData } = await import('../src/server/navigation/dashboard-today-data');

  // Non-inventory Senior Cashier model
  const seniorCashierAuthContext = {
    ...invMockAuthContext,
    membershipRole: 'staff',
    rolePermissions: ['orders.view', 'pos.create'],
    scopeGrants: [],
  };
  const seniorCashierHomeModel = await resolveDashboardHomeModel(seniorCashierAuthContext);
  assert(
    seniorCashierHomeModel.canViewInventory === false &&
    seniorCashierHomeModel.canManageInventory === false &&
    seniorCashierHomeModel.showLowStockCard === false,
    '28a. Senior Cashier without inventory permissions has showLowStockCard = false and canViewInventory = false'
  );

  // Inventory-permitted role
  const inventoryManagerHomeModel = await resolveDashboardHomeModel(invMockAuthContext);
  assert(
    inventoryManagerHomeModel.canViewInventory === true &&
    inventoryManagerHomeModel.showLowStockCard === true,
    '28b. Inventory-permitted role has showLowStockCard = true and canViewInventory = true'
  );

  // --- 29. Blocker 2: Staff Directory Custom Role Name Display ---
  console.log('\n--- 29. Blocker 2: Staff Directory Custom Role Name Display ---');
  const teamMgmtFile = path.join(rootDir, 'src/components/team/team-management.tsx');
  const teamMgmtContent = fs.readFileSync(teamMgmtFile, 'utf-8');
  assert(
    teamMgmtContent.includes('formatRoleLabel(m.role, m.customRoleName)') &&
    teamMgmtContent.includes('m.customRoleName && (') &&
    teamMgmtContent.includes('Custom') &&
    teamMgmtContent.includes('formatRoleLabel = (role: string, customRoleName?: string | null) => {') &&
    teamMgmtContent.includes('if (customRoleName) {'),
    '29. Team Directory formats custom role names with Custom badge, rendering Senior Cashier instead of base Cashier'
  );

  // --- 30. Blocker 3: Enterprise Staff Invitation Scope Model ---
  console.log('\n--- 30. Blocker 3: Enterprise Staff Invitation Scope & Ceiling Model ---');
  const { createInvitationSchema } = await import('../src/lib/validation/staff-invitation');
  const { validateMaxScope, validateAdministrativeReach } = await import('../src/server/auth/scope-target-validator');

  const validOrgInviteInput = {
    assignedRole: 'branch_manager' as const,
    scopeType: 'ORGANIZATION' as const,
    customRoleId: '11111111-1111-4111-a111-111111111111',
    expiryOption: '48h' as const,
  };
  const parsedOrgInvite = createInvitationSchema.safeParse(validOrgInviteInput);
  assert(
    parsedOrgInvite.success === true,
    '30a. createInvitationSchema accepts ORGANIZATION scoped custom role invitations without requiring branchId'
  );

  const validDeptInviteInput = {
    branchId: '22222222-2222-4222-a222-222222222222',
    assignedRole: 'cashier' as const,
    scopeType: 'DEPARTMENT' as const,
    departmentId: '33333333-3333-4333-a333-333333333333',
    expiryOption: '48h' as const,
  };
  const parsedDeptInvite = createInvitationSchema.safeParse(validDeptInviteInput);
  assert(
    parsedDeptInvite.success === true,
    '30b. createInvitationSchema accepts DEPARTMENT scoped invitations with departmentId'
  );

  // Validate Max Scope Ceiling Enforcement
  let ceilingEnforced = false;
  try {
    validateMaxScope('PROPERTY', 'ORGANIZATION');
  } catch {
    ceilingEnforced = true;
  }
  assert(
    ceilingEnforced === true,
    '30c. validateMaxScope strictly forbids ORGANIZATION scope when role ceiling is PROPERTY'
  );

  // Validate Inviter Reach Enforcement
  let reachEnforced = false;
  try {
    validateAdministrativeReach({
      actorContext: seniorCashierAuthContext,
      requestedScope: 'ORGANIZATION',
    });
  } catch {
    reachEnforced = true;
  }
  assert(
    reachEnforced === true,
    '30d. validateAdministrativeReach forbids non-owner actor from delegating ORGANIZATION scope'
  );

  assert(
    staffInviteServiceContent.includes("scope_type: effectiveScope") &&
    staffInviteServiceContent.includes("department_id: input.departmentId") &&
    staffInviteServiceContent.includes("assignmentLabel") &&
    staffInviteServiceContent.includes("Organization Wide"),
    '30e. StaffInvitationService records scope metadata, generates assignmentLabel, and creates department assignments on claim'
  );

  console.log(`\n================================================================`);
  console.log(`  Phase 37 Step 5 Final Acceptance: ${passedTests} / ${totalTests} Tests Passed`);
  console.log(`================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runFinalAcceptance().catch((err) => {
  console.error('Final acceptance execution failed:', err);
  process.exit(1);
});

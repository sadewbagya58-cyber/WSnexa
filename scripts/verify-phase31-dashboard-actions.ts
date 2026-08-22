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

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

import { AuthorizationContext } from '../src/types/authorization.types';

function createMockAuthContext(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    userId: 'user-123',
    userEmail: 'test@wsnexa.internal',
    businessId: 'biz-123',
    businessName: 'Test Hospitality Group',
    businessSlug: 'test-hospitality',
    membershipId: 'mem-123',
    membershipRole: 'cashier',
    customRoleId: null,
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
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
    roleScopePreset: {
      roleKey: 'custom',
      customRoleId: 'custom-1',
      defaultScope: 'PROPERTY',
      maxScope: 'ORGANIZATION',
    },
    selfIdentity: {
      userId: 'user-123',
      membershipId: 'mem-123',
      staffAssignmentIds: [],
    },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 1,
      sources: {
        membershipSource: 'test',
        branchAssignmentCount: 1,
        staffAssignmentCount: 0,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 0,
        overrideCount: 0,
        scopeGrantCount: 0,
      },
    },
    ...overrides,
  };
}

async function runVerification() {
  const { resolveDashboardHomeModel } = await import('../src/server/navigation/dashboard-home-model');

  console.log('\n================================================================');
  console.log('  WSNexa Phase 31 Step 4 — Role Dashboards & Page Actions Check');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- A. Dashboard Capability Model Assertions ---
  console.log('--- A. Dashboard Capability Resolver ---');

  const modelResolverFile = path.join(process.cwd(), 'src', 'server', 'navigation', 'dashboard-home-model.ts');
  assert(fs.existsSync(modelResolverFile), 'resolveDashboardHomeModel resolver file exists');

  // Business Owner Context
  const ownerCtx = createMockAuthContext({
    membershipRole: 'business_owner',
    isBusinessOwner: true,
    rolePermissions: ['menu.manage', 'tables.manage', 'inventory.manage', 'reports.view', 'roles.view', 'reviews.view'],
  });
  const ownerModel = await resolveDashboardHomeModel(ownerCtx);
  assert(ownerModel.isBusinessOwner, 'Owner context flags isBusinessOwner as true');
  assert(ownerModel.showExecutiveSummary, 'Owner receives executive summary card');
  assert(ownerModel.showSetupChecklist, 'Owner receives setup progress checklist');
  assert(ownerModel.showMenuStatsCard && ownerModel.showDiningStatsCard, 'Owner receives menu & dining stats cards');
  assert(!ownerModel.isFallbackMode, 'Owner dashboard is not fallback mode');

  // Branch Manager Context
  const managerCtx = createMockAuthContext({
    membershipRole: 'branch_manager',
    isBusinessOwner: false,
    rolePermissions: ['menu.view', 'tables.manage', 'inventory.view', 'reports.view'],
  });
  const managerModel = await resolveDashboardHomeModel(managerCtx);
  assert(!managerModel.isBusinessOwner, 'Branch manager context is not business owner');
  assert(managerModel.showExecutiveSummary, 'Branch Manager receives executive summary');
  assert(managerModel.showDiningStatsCard, 'Branch Manager receives dining stats card');
  assert(!managerModel.showAccessGovernanceCard, 'Branch Manager without roles.view hides Access Control card');

  // Cashier Context
  const cashierCtx = createMockAuthContext({
    membershipRole: 'cashier',
    isBusinessOwner: false,
    rolePermissions: ['cashier.access', 'menu.view'],
  });
  const cashierModel = await resolveDashboardHomeModel(cashierCtx);
  assert(cashierModel.showCashierShortcutCard, 'Cashier receives Cashier POS shortcut card');
  assert(!cashierModel.showSetupChecklist, 'Cashier hides setup progress checklist');
  assert(!cashierModel.showAccessGovernanceCard, 'Cashier hides Access Governance card');

  // Kitchen Staff Context
  const kitchenCtx = createMockAuthContext({
    membershipRole: 'kitchen_staff',
    isBusinessOwner: false,
    rolePermissions: ['kitchen.orders.view', 'menu.view'],
  });
  const kitchenModel = await resolveDashboardHomeModel(kitchenCtx);
  assert(kitchenModel.showKitchenQueueCard, 'Kitchen Staff receives Kitchen Queue card');
  assert(!kitchenModel.showCashierShortcutCard, 'Kitchen Staff hides Cashier POS card');

  // Waiter Context (View-Only Capabilities)
  const waiterCtx = createMockAuthContext({
    membershipRole: 'waiter',
    isBusinessOwner: false,
    rolePermissions: ['waiter.access', 'menu.view', 'tables.view', 'inventory.view'],
  });
  const waiterModel = await resolveDashboardHomeModel(waiterCtx);
  assert(waiterModel.showWaiterQueueCard, 'Waiter receives Waiter Queue card');
  assert(!waiterModel.showExecutiveSummary, 'Waiter hides executive summary');
  assert(!waiterModel.canManageMenu, 'Waiter with menu.view lacks canManageMenu capability');
  assert(!waiterModel.canManageTables, 'Waiter with tables.view lacks canManageTables capability');
  assert(!waiterModel.canManageInventory, 'Waiter with inventory.view lacks canManageInventory capability');
  assert(
    !waiterModel.quickActions.some((a) => ['menu-cat', 'menu-item', 'tables-areas', 'tables-bulk', 'tables-qr', 'inventory-count', 'inventory-po'].includes(a.id)),
    'Mutation quick actions (Add Category, Add Item, Bulk Tables, PO, Counts) disappear for Waiter'
  );

  // Custom Auditor Role Context
  const auditorCtx = createMockAuthContext({
    membershipRole: 'custom',
    customRoleId: 'custom-auditor-1',
    isBusinessOwner: false,
    rolePermissions: ['reports.view', 'inventory.view'],
  });
  const auditorModel = await resolveDashboardHomeModel(auditorCtx);
  assert(auditorModel.showReportsCard, 'Custom Auditor role receives Reports card based on reports.view');
  assert(auditorModel.showInventoryCard, 'Custom Auditor role receives Inventory card based on inventory.view');
  assert(!auditorModel.showCashierShortcutCard, 'Custom Auditor role hides Cashier POS card');
  assert(!auditorModel.canManageInventory, 'Custom Auditor with inventory.view lacks canManageInventory');

  // Restricted User Context (Fallback Mode)
  const restrictedCtx = createMockAuthContext({
    membershipRole: 'custom',
    customRoleId: 'custom-minimal-1',
    isBusinessOwner: false,
    rolePermissions: [],
  });
  const restrictedModel = await resolveDashboardHomeModel(restrictedCtx);
  assert(restrictedModel.isFallbackMode, 'Restricted user with 0 capabilities receives Fallback Mode dashboard');

  // --- B. Page Actions & Permission Gating Assertions ---
  console.log('\n--- B. Page Action & CTA Permission Gating ---');

  const dashboardPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx');
  const dashboardPageCode = fs.readFileSync(dashboardPagePath, 'utf8');
  assert(dashboardPageCode.includes('resolveDashboardHomeModel'), 'Main dashboard page consumes resolveDashboardHomeModel');
  assert(dashboardPageCode.includes('model.showMenuStatsCard'), 'Main dashboard conditionally fetches menu stats data');
  assert(dashboardPageCode.includes('model.showDiningStatsCard'), 'Main dashboard conditionally fetches dining stats data');
  assert(dashboardPageCode.includes('model.showAuditLogs'), 'Main dashboard conditionally fetches audit logs data');

  // Differentiate View vs Manage CTA Labels
  assert(
    dashboardPageCode.includes("model.canManageMenu || model.isBusinessOwner ? 'Manage Categories →' : 'View Categories →'"),
    'Categories card CTA differentiates Manage Categories from View Categories'
  );
  assert(
    dashboardPageCode.includes("model.canManageMenu || model.isBusinessOwner ? 'Manage Items →' : 'View Items →'"),
    'Menu Items card CTA differentiates Manage Items from View Items'
  );
  assert(
    dashboardPageCode.includes("model.canManageTables || model.isBusinessOwner ? 'Manage Service Areas →' : 'View Service Areas →'"),
    'Service Areas card CTA differentiates Manage Service Areas from View Service Areas'
  );
  assert(
    dashboardPageCode.includes("model.canManageTables || model.isBusinessOwner ? 'Manage Tables →' : 'View Tables →'"),
    'Dining Tables card CTA differentiates Manage Tables from View Tables'
  );
  assert(
    dashboardPageCode.includes("model.canManageInventory || model.isBusinessOwner ? 'Manage Stock Catalog →' : 'View Stock Catalog →'"),
    'Stock Items card CTA differentiates Manage Stock Catalog from View Stock Catalog'
  );
  assert(
    dashboardPageCode.includes("model.canManageAccess || model.isBusinessOwner ? 'Manage Roles & Scope Grants →' : 'View Access Control Hub →'"),
    'Access Control card CTA differentiates Manage Roles from View Access Control Hub'
  );

  const stockItemsPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'inventory', 'items', 'page.tsx');
  const stockItemsCode = fs.readFileSync(stockItemsPagePath, 'utf8');
  assert(stockItemsCode.includes('canManageItems'), 'Stock items page evaluates canManageItems permission for + Add Ingredient action');

  const stockCountsPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'inventory', 'counts', 'page.tsx');
  const stockCountsCode = fs.readFileSync(stockCountsPagePath, 'utf8');
  assert(stockCountsCode.includes('canManageCounts'), 'Stock counts page evaluates canManageCounts permission for + Start New Count action');

  const recipesPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'inventory', 'recipes', 'page.tsx');
  const recipesCode = fs.readFileSync(recipesPagePath, 'utf8');
  assert(recipesCode.includes('canManageRecipes'), 'Recipes page evaluates canManageRecipes permission for + Create Recipe action');

  const purchasingPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'inventory', 'purchasing', 'page.tsx');
  const purchasingCode = fs.readFileSync(purchasingPagePath, 'utf8');
  assert(purchasingCode.includes('canManagePO'), 'Purchasing page evaluates canManagePO permission for + New Purchase Order action');

  const menuPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'menu', 'page.tsx');
  const menuPageCode = fs.readFileSync(menuPagePath, 'utf8');
  assert(menuPageCode.includes('canManageMenu'), 'Menu overview page evaluates canManageMenu permission for + Add Menu Item action');

  // Dining Setup & High-Impact Settings Gating
  const diningPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'dining', 'page.tsx');
  const diningPageCode = fs.readFileSync(diningPagePath, 'utf8');
  assert(diningPageCode.includes('canManageTables'), 'Dining setup page evaluates canManageTables permission');
  assert(diningPageCode.includes('canManage={canManage}'), 'Dining setup page passes canManage prop to DiningSetupWorkspace');

  const diningWorkspacePath = path.join(process.cwd(), 'src', 'components', 'dining', 'dining-setup-workspace.tsx');
  const diningWorkspaceCode = fs.readFileSync(diningWorkspacePath, 'utf8');
  assert(diningWorkspaceCode.includes('canManage={canManage}'), 'DiningSetupWorkspace passes canManage prop to AreaManager, TableGrid, and BranchQrManager');

  const orderSecurityPagePath = path.join(process.cwd(), 'src', 'app', 'dashboard', 'settings', 'order-security', 'page.tsx');
  const orderSecurityPageCode = fs.readFileSync(orderSecurityPagePath, 'utf8');
  assert(orderSecurityPageCode.includes('requireRoutePermission'), 'Order security page uses requireRoutePermission route guard');
  assert(orderSecurityPageCode.includes('canManageOrderSecurity'), 'Order security page evaluates order_security.manage permission');

  const paymentsPagePath = path.join(process.cwd(), 'src', 'app', 'dashboard', 'settings', 'payments', 'page.tsx');
  const paymentsPageCode = fs.readFileSync(paymentsPagePath, 'utf8');
  assert(paymentsPageCode.includes('requireRoutePermission'), 'Branch payments page uses requireRoutePermission route guard');
  assert(paymentsPageCode.includes('canManageBranchPayments'), 'Branch payments page evaluates branches.manage permission');

  // --- C. Explicit DENY & Scope Invariants ---
  console.log('\n--- C. Explicit DENY & Scope Invariants ---');

  const denyCtx = createMockAuthContext({
    membershipRole: 'branch_manager',
    isBusinessOwner: false,
    rolePermissions: ['menu.manage', 'reports.view'],
    permissionOverrides: [
      {
        id: 'override-deny-1',
        businessMembershipId: 'mem-123',
        permissionKey: 'menu.manage',
        effect: 'deny',
        scopeType: 'ORGANIZATION',
        branchId: null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const denyModel = await resolveDashboardHomeModel(denyCtx);
  assert(!denyModel.canManageMenu, 'Explicit DENY override revokes canManageMenu despite role allowance');
  assert(!denyModel.quickActions.some((a) => a.id === 'menu-item'), 'Explicit DENY removes menu-item quick action shortcut');

  // --- D. Security & Performance Invariants ---
  console.log('\n--- D. Security & Performance Invariants ---');

  assert(!dashboardPageCode.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No service role credentials used in dashboard overview');
  assert(!dashboardPageCode.includes('REGION'), 'Canonical RBAC scopes preserve ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF without REGION');

  console.log('\n================================================================');
  console.log(`  Phase 31 Step 4 Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error in verify-phase31-dashboard-actions:', err);
  process.exit(1);
});

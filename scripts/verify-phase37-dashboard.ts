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

import { AuthorizationContext } from '../src/types/authorization.types';

function createMockAuthContext(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    userId: 'user-123',
    userEmail: 'test@wsnexa.internal',
    businessId: 'biz-123',
    businessName: 'Test Hospitality Group',
    businessSlug: 'test-hospitality',
    membershipId: 'mem-123',
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
    roleScopePreset: {
      roleKey: 'business_owner',
      customRoleId: null,
      defaultScope: 'ORGANIZATION',
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

async function runAssertions() {
  const { resolveDashboardHomeModel } = await import('../src/server/navigation/dashboard-home-model');
  const { resolveDefaultWorkspaceRoute } = await import('../src/server/tenant/guard');

  console.log('\n================================================================');
  console.log('  WSNexa Phase 37 Step 3: Dashboard Simplification Verification');
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

  // --- 1. Removal of Technical / Advanced Elements from First View ---
  console.log('--- 1. Removal of Technical / Advanced Elements from First View ---');
  const dashboardPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx');
  const dashboardPageCode = fs.readFileSync(dashboardPagePath, 'utf8');

  assert(!dashboardPageCode.includes('RBAC & Scope V2'), 'Technical RBAC & Scope V2 card removed from dashboard first view');
  assert(!dashboardPageCode.includes('Access Control Hub'), 'Access Control Hub hero card removed from dashboard first view');
  assert(!dashboardPageCode.includes('audit_logs'), 'Raw audit logs query removed from dashboard page');
  assert(!dashboardPageCode.includes('Recent System Activity'), 'Recent System Activity table removed from dashboard');
  assert(!dashboardPageCode.includes('Timezone:'), 'Timezone de-emphasized from PageHeader description');

  // --- 2. Compact Operational Shortcuts (Not Giant Hero Cards) ---
  console.log('\n--- 2. Compact Operational Shortcuts ---');
  const shortcutsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-operations-shortcuts.tsx');
  assert(fs.existsSync(shortcutsPath), 'dashboard-operations-shortcuts.tsx component exists');
  const shortcutsCode = fs.readFileSync(shortcutsPath, 'utf8');

  assert(shortcutsCode.includes('Live Operational Terminals'), 'Operations shortcuts header exists');
  assert(shortcutsCode.includes('model.showCashierShortcut'), 'Cashier POS shortcut is permission-gated');
  assert(shortcutsCode.includes('model.showKitchenShortcut'), 'Kitchen Queue shortcut is permission-gated');
  assert(shortcutsCode.includes('model.showWaiterShortcut'), 'Waiter Terminal shortcut is permission-gated');
  assert(shortcutsCode.includes('grid grid-cols-1 gap-3 sm:grid-cols-3'), 'Shortcuts render in compact 3-column chip row');

  // --- 3. Today\'s Performance Metrics & Permission-Aware Gating ---
  console.log('\n--- 3. Today\'s Performance Metrics & Permission-Aware Gating ---');
  const metricsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-today-metrics.tsx');
  assert(fs.existsSync(metricsPath), 'dashboard-today-metrics.tsx component exists');
  const metricsCode = fs.readFileSync(metricsPath, 'utf8');

  assert(metricsCode.includes('Orders Today'), 'Orders Today metric card exists');
  assert(metricsCode.includes('Active Queue'), 'Active Queue live metric card exists');
  assert(metricsCode.includes('Revenue Today'), 'Revenue Today metric card exists');
  assert(metricsCode.includes('Reservations'), 'Reservations Today metric card exists');
  assert(metricsCode.includes('Floor Tables'), 'Floor Tables status card exists');
  assert(metricsCode.includes('formatCurrency'), 'Revenue formatting uses canonical formatCurrency helper');
  assert(metricsCode.includes('No orders yet today'), 'Empty state handled for zero orders');
  assert(metricsCode.includes('No reservations today'), 'Empty state handled for zero reservations');

  // Model-level permission tests
  const ownerCtx = createMockAuthContext({ isBusinessOwner: true, membershipRole: 'business_owner' });
  const ownerModel = await resolveDashboardHomeModel(ownerCtx);
  assert(ownerModel.showOrdersTodayCard, 'Owner has showOrdersTodayCard enabled');
  assert(ownerModel.showRevenueTodayCard, 'Owner has showRevenueTodayCard enabled');
  assert(ownerModel.showReservationsTodayCard, 'Owner has showReservationsTodayCard enabled');
  assert(ownerModel.showTableStatusCard, 'Owner has showTableStatusCard enabled');
  assert(ownerModel.showOperationsShortcuts, 'Owner has showOperationsShortcuts enabled');

  // User without financial permissions
  const noFinanceCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'branch_manager',
    rolePermissions: ['orders.view', 'tables.view', 'reservations.view'], // no reports.financial.view
  });
  const noFinanceModel = await resolveDashboardHomeModel(noFinanceCtx);
  assert(noFinanceModel.showOrdersTodayCard, 'Manager with orders.view sees Orders Today card');
  assert(!noFinanceModel.showRevenueTodayCard, 'Manager WITHOUT reports.financial.view hides Revenue Today card');
  assert(noFinanceModel.showReservationsTodayCard, 'Manager with reservations.view sees Reservations Today card');

  // --- 4. Needs Attention Section (Conditional & Non-Alarmist) ---
  console.log('\n--- 4. Needs Attention Section ---');
  const attentionPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-needs-attention.tsx');
  assert(fs.existsSync(attentionPath), 'dashboard-needs-attention.tsx component exists');
  const attentionCode = fs.readFileSync(attentionPath, 'utf8');

  assert(attentionCode.includes('if (!items || items.length === 0) {\n    return null;\n  }'), 'Needs Attention completely returns null when items array is empty');
  assert(attentionCode.includes('Needs Attention'), 'Needs Attention header rendered when items exist');
  assert(attentionCode.includes('item.actionLabel'), 'Attention cards provide clear action button CTA');

  // --- 5. Quick Actions (Max 4, High-Frequency) ---
  console.log('\n--- 5. Quick Actions (Simplified to High-Frequency Actions) ---');
  const quickActionsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-quick-actions.tsx');
  assert(fs.existsSync(quickActionsPath), 'dashboard-quick-actions.tsx component exists');
  const quickActionsCode = fs.readFileSync(quickActionsPath, 'utf8');

  assert(quickActionsCode.includes('Quick Actions'), 'Quick Actions header exists');
  assert(quickActionsCode.includes('min-h-[44px]'), 'Quick Actions adhere to minimum 44px touch target');
  assert(ownerModel.quickActions.length <= 4, `Owner quick actions capped at <= 4 items (got ${ownerModel.quickActions.length})`);
  assert(ownerModel.quickActions.some(a => a.id === 'menu-item'), 'Quick actions includes Add Menu Item for owner');
  assert(ownerModel.quickActions.some(a => a.id === 'orders'), 'Quick actions includes View Orders for owner');

  // --- 6. Hospitality Setup Progress (Conditional Collapse) ---
  console.log('\n--- 6. Setup Progress (Conditional Behavior) ---');
  const setupPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-setup-progress.tsx');
  assert(fs.existsSync(setupPath), 'dashboard-setup-progress.tsx component exists');
  const setupCode = fs.readFileSync(setupPath, 'utf8');

  assert(setupCode.includes('if (setupComplete) {\n    return null;\n  }'), 'Setup Progress disappears from dashboard once setupComplete is true');
  assert(dashboardPageCode.includes('DashboardSetupProgress'), 'Dashboard page integrates DashboardSetupProgress component');

  // --- 7. Subscription Lifecycle Banner Preservation ---
  console.log('\n--- 7. Subscription Lifecycle Banner Preservation ---');
  assert(dashboardPageCode.includes('OwnerSubscriptionLifecycleBanner'), 'OwnerSubscriptionLifecycleBanner component is preserved in dashboard');

  // --- 8. Custom Restricted Role Behavior & Isolation ---
  console.log('\n--- 8. Custom Restricted Role Behavior & Isolation ---');
  const restrictedCustomCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'cashier', // base compatibility role key
    customRoleId: 'cr-auditor-only',
    rolePermissions: ['business.view'], // ONLY business.view, NO cashier.access, NO orders.create
  });
  const restrictedCustomModel = await resolveDashboardHomeModel(restrictedCustomCtx);

  assert(!restrictedCustomModel.showCashierShortcut, 'Custom restricted role hides Cashier POS shortcut');
  assert(!restrictedCustomModel.showKitchenShortcut, 'Custom restricted role hides Kitchen shortcut');
  assert(!restrictedCustomModel.showWaiterShortcut, 'Custom restricted role hides Waiter shortcut');
  assert(!restrictedCustomModel.showRevenueTodayCard, 'Custom restricted role hides Revenue Today card');
  assert(!restrictedCustomModel.showOrdersTodayCard, 'Custom restricted role without orders.view hides Orders Today card');
  assert(restrictedCustomModel.isFallbackMode, 'Custom restricted role triggers isFallbackMode');
  assert(dashboardPageCode.includes('Active Branch Workspace'), 'Fallback mode renders Active Branch Workspace card with help link');

  // --- 9. Operational Staff Direct Landing Preservation ---
  console.log('\n--- 9. Operational Staff Direct Landing Preservation ---');
  assert(resolveDefaultWorkspaceRoute('cashier', null) === '/dashboard/cashier', 'Built-in Cashier routes to /dashboard/cashier');
  assert(resolveDefaultWorkspaceRoute('kitchen_staff', null) === '/dashboard/kitchen', 'Built-in Kitchen Staff routes to /dashboard/kitchen');
  assert(resolveDefaultWorkspaceRoute('waiter', null) === '/dashboard/waiter', 'Built-in Waiter routes to /dashboard/waiter');
  assert(resolveDefaultWorkspaceRoute('cashier', 'cr-qa-uuid') === '/dashboard', 'Custom role user routes to /dashboard even if base role is cashier');

  // --- 10. Mobile-Safe Layout & Responsive Design ---
  console.log('\n--- 10. Mobile-Safe Layout & Responsive Design ---');
  assert(dashboardPageCode.includes('touch-manipulation'), 'Dashboard actions have touch-manipulation class for mobile responsiveness');
  assert(metricsCode.includes('grid-cols-1') && metricsCode.includes('sm:grid-cols-2') && metricsCode.includes('lg:grid-cols-4'), 'Metrics grid stacks 1-column on mobile and expands responsively');
  assert(shortcutsCode.includes('grid-cols-1') && shortcutsCode.includes('sm:grid-cols-3'), 'Operational shortcuts stack 1-column on mobile');
  assert(attentionCode.includes('grid-cols-1') && attentionCode.includes('sm:grid-cols-2') && attentionCode.includes('lg:grid-cols-3'), 'Attention cards stack 1-column on mobile');

  console.log('\n================================================================');
  console.log(`  Phase 37 Step 3 Dashboard Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAssertions().catch((err) => {
  console.error('Unexpected error running assertions:', err);
  process.exit(1);
});

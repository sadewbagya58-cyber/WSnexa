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
    branchAssignments: [
      {
        id: 'ba-1',
        branchId: 'branch-1',
        branchName: 'Main Branch',
        branchCode: 'MAIN',
        isPrimary: true,
        isDefault: true,
        status: 'active',
        assignedAt: new Date().toISOString(),
      },
    ],
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
  const { resolveDashboardNavigation, hasNavCapability } = await import('../src/server/navigation/navigation-engine');
  const { getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');
  const { can } = await import('../src/server/auth/policy-engine');

  console.log('\n================================================================');
  console.log('  WSNexa Phase 37 Step 3: Dashboard & Restricted Role Verification');
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

  // Common direct branch resource scope for policy engine evaluation
  const branchResource = {
    resourceType: 'branch' as const,
    resourceId: 'branch-1',
    businessId: 'biz-123',
    branchId: 'branch-1',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: null,
    ownerUserId: null,
  };

  // --- 1. Removal of Technical / Advanced Elements from First View ---
  console.log('--- 1. Removal of Technical / Advanced Elements from First View ---');
  const dashboardPagePath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx');
  const dashboardPageCode = fs.readFileSync(dashboardPagePath, 'utf8');

  assert(!dashboardPageCode.includes('RBAC & Scope V2'), 'Technical RBAC & Scope V2 card removed from dashboard first view');
  assert(!dashboardPageCode.includes('Access Control Hub'), 'Access Control Hub hero card removed from dashboard first view');
  assert(!dashboardPageCode.includes('audit_logs'), 'Raw audit logs query removed from dashboard page');
  assert(!dashboardPageCode.includes('Recent System Activity'), 'Recent System Activity table removed from dashboard');
  assert(!dashboardPageCode.includes('Timezone:'), 'Timezone de-emphasized from PageHeader description');

  // --- 2. Dashboard Root Route Guard Invariant ---
  console.log('\n--- 2. Dashboard Root Route Guard ---');
  const dashboardReqPerm = getRequiredPermissionForRoute('/dashboard');
  assert(dashboardReqPerm === null, 'Dashboard root /dashboard has NO restrictive required permission (null)');

  // --- 3. Compact Operational Shortcuts ---
  console.log('\n--- 3. Compact Operational Shortcuts ---');
  const shortcutsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-operations-shortcuts.tsx');
  assert(fs.existsSync(shortcutsPath), 'dashboard-operations-shortcuts.tsx component exists');
  const shortcutsCode = fs.readFileSync(shortcutsPath, 'utf8');

  assert(shortcutsCode.includes('Live Operational Terminals'), 'Operations shortcuts header exists');
  assert(shortcutsCode.includes('model.showCashierShortcut'), 'Cashier POS shortcut is permission-gated');
  assert(shortcutsCode.includes('model.showKitchenShortcut'), 'Kitchen Queue shortcut is permission-gated');
  assert(shortcutsCode.includes('model.showWaiterShortcut'), 'Waiter Terminal shortcut is permission-gated');
  assert(shortcutsCode.includes('grid grid-cols-1 gap-3 sm:grid-cols-3'), 'Shortcuts render in compact 3-column chip row');

  // --- 4. Today\'s Performance Metrics & Permission-Aware Gating ---
  console.log('\n--- 4. Today\'s Performance Metrics & Permission-Aware Gating ---');
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

  // --- 5. Needs Attention Section (Conditional & Non-Alarmist) ---
  console.log('\n--- 5. Needs Attention Section ---');
  const attentionPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-needs-attention.tsx');
  assert(fs.existsSync(attentionPath), 'dashboard-needs-attention.tsx component exists');
  const attentionCode = fs.readFileSync(attentionPath, 'utf8');

  assert(attentionCode.includes('if (!items || items.length === 0) {\n    return null;\n  }'), 'Needs Attention completely returns null when items array is empty');
  assert(attentionCode.includes('Needs Attention'), 'Needs Attention header rendered when items exist');
  assert(attentionCode.includes('item.actionLabel'), 'Attention cards provide clear action button CTA');

  // --- 6. Quick Actions (Max 4, High-Frequency) ---
  console.log('\n--- 6. Quick Actions (Simplified to High-Frequency Actions) ---');
  const quickActionsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-quick-actions.tsx');
  assert(fs.existsSync(quickActionsPath), 'dashboard-quick-actions.tsx component exists');
  const quickActionsCode = fs.readFileSync(quickActionsPath, 'utf8');

  assert(quickActionsCode.includes('Quick Actions'), 'Quick Actions header exists');
  assert(quickActionsCode.includes('min-h-[44px]'), 'Quick Actions adhere to minimum 44px touch target');
  assert(ownerModel.quickActions.length <= 4, `Owner quick actions capped at <= 4 items (got ${ownerModel.quickActions.length})`);
  assert(ownerModel.quickActions.some(a => a.id === 'menu-item'), 'Quick actions includes Add Menu Item for owner');
  assert(ownerModel.quickActions.some(a => a.id === 'orders'), 'Quick actions includes View Orders for owner');

  // --- 7. Hospitality Setup Progress (Conditional Collapse) ---
  console.log('\n--- 7. Setup Progress (Conditional Behavior) ---');
  const setupPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-setup-progress.tsx');
  assert(fs.existsSync(setupPath), 'dashboard-setup-progress.tsx component exists');
  const setupCode = fs.readFileSync(setupPath, 'utf8');

  assert(setupCode.includes('if (setupComplete) {\n    return null;\n  }'), 'Setup Progress disappears from dashboard once setupComplete is true');
  assert(dashboardPageCode.includes('DashboardSetupProgress'), 'Dashboard page integrates DashboardSetupProgress component');

  // --- 8. Generic Restricted-Role Fallback Workspace ---
  console.log('\n--- 8. Generic Restricted-Role Fallback Workspace ---');
  const fallbackPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-fallback-workspace.tsx');
  assert(fs.existsSync(fallbackPath), 'dashboard-fallback-workspace.tsx component exists');
  const fallbackCode = fs.readFileSync(fallbackPath, 'utf8');

  assert(fallbackCode.includes('No Workspace Access'), 'Fallback component renders "No Workspace Access" empty state');
  assert(fallbackCode.includes('Your Workspace'), 'Fallback component renders "Your Workspace" for single destination');
  assert(fallbackCode.includes('Your Workspaces'), 'Fallback component renders "Your Workspaces" for multiple destinations');
  assert(dashboardPageCode.includes('DashboardFallbackWorkspace'), 'Dashboard page integrates DashboardFallbackWorkspace');

  // --- 9. Individual 1-Permission Custom Role Matrix ---
  console.log('\n--- 9. Individual 1-Permission Custom Role Matrix ---');

  // 9A. business.view ONLY
  const bizViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'cashier', // compatibility base key
    customRoleId: 'cr-biz-view-only',
    rolePermissions: ['business.view'],
  });
  const bizViewNav = resolveDashboardNavigation(bizViewCtx);
  const bizViewItems = bizViewNav.flatMap(s => s.items);
  const bizSettingsItem = bizViewItems.find(i => i.id === 'settings');
  assert(Boolean(bizSettingsItem), 'business.view custom role reveals Settings nav item');
  assert(bizSettingsItem?.href === '/dashboard/business', 'Settings href resolves to /dashboard/business for business.view');
  assert(!bizViewItems.some(i => i.id === 'orders'), 'business.view custom role hides Orders hub');
  assert(!bizViewItems.some(i => i.id === 'dining'), 'business.view custom role hides Dining & QR hub');
  const bizRoutePerm = getRequiredPermissionForRoute('/dashboard/business');
  const canAccessBizRoute = Array.isArray(bizRoutePerm)
    ? (await Promise.all(bizRoutePerm.map(p => can({ context: bizViewCtx, permission: p, resource: branchResource })))).some(Boolean)
    : await can({ context: bizViewCtx, permission: bizRoutePerm!, resource: branchResource });
  assert(canAccessBizRoute, '/dashboard/business route is authorized for business.view');

  // 9B. areas.view ONLY
  const areasViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'cashier',
    customRoleId: 'cr-areas-view-only',
    rolePermissions: ['areas.view'],
  });
  const areasViewNav = resolveDashboardNavigation(areasViewCtx);
  const areasViewItems = areasViewNav.flatMap(s => s.items);
  const areasDiningItem = areasViewItems.find(i => i.id === 'dining');
  assert(Boolean(areasDiningItem), 'areas.view custom role reveals Dining & QR nav item');
  assert(areasDiningItem?.href === '/dashboard/areas', 'Dining & QR href resolves to /dashboard/areas for areas.view');
  assert(!areasViewItems.some(i => i.id === 'settings'), 'areas.view custom role hides Settings hub');
  const areasRoutePerm = getRequiredPermissionForRoute('/dashboard/areas');
  const canAccessAreasRoute = Array.isArray(areasRoutePerm)
    ? (await Promise.all(areasRoutePerm.map(p => can({ context: areasViewCtx, permission: p, resource: branchResource })))).some(Boolean)
    : await can({ context: areasViewCtx, permission: areasRoutePerm!, resource: branchResource });
  assert(canAccessAreasRoute, '/dashboard/areas route is authorized for areas.view');
  const canManageAreas = (await can({ context: areasViewCtx, permission: 'areas.manage', resource: branchResource })) ||
                         (await can({ context: areasViewCtx, permission: 'tables.manage', resource: branchResource }));
  assert(!canManageAreas, 'areas.view custom role does NOT have areas.manage capability');

  // 9C. tables.view ONLY
  const tablesViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-tables-view-only',
    rolePermissions: ['tables.view'],
  });
  const tablesViewNav = resolveDashboardNavigation(tablesViewCtx);
  const tablesViewItems = tablesViewNav.flatMap(s => s.items);
  const tablesDiningItem = tablesViewItems.find(i => i.id === 'dining');
  assert(Boolean(tablesDiningItem), 'tables.view custom role reveals Dining & QR nav item');
  assert(tablesDiningItem?.href === '/dashboard/dining', 'Dining & QR href resolves to /dashboard/dining for tables.view');

  // 9D. menu.view ONLY
  const menuViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-menu-view-only',
    rolePermissions: ['menu.view'],
  });
  const menuViewNav = resolveDashboardNavigation(menuViewCtx);
  const menuViewItems = menuViewNav.flatMap(s => s.items);
  assert(menuViewItems.some(i => i.id === 'menu'), 'menu.view custom role reveals Menu nav item');
  assert(!menuViewItems.some(i => i.id === 'orders'), 'menu.view custom role hides Orders nav item');

  // 9E. reservations.view ONLY
  const resViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-res-view-only',
    rolePermissions: ['reservations.view'],
  });
  const resViewNav = resolveDashboardNavigation(resViewCtx);
  const resViewItems = resViewNav.flatMap(s => s.items);
  assert(resViewItems.some(i => i.id === 'reservations'), 'reservations.view custom role reveals Reservations nav item');
  assert(!resViewItems.some(i => i.id === 'operations'), 'reservations.view custom role hides Operations nav item');

  // 9F. customers.view ONLY
  const custViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-cust-view-only',
    rolePermissions: ['customers.view'],
  });
  const custViewNav = resolveDashboardNavigation(custViewCtx);
  const custViewItems = custViewNav.flatMap(s => s.items);
  assert(custViewItems.some(i => i.id === 'customers'), 'customers.view custom role reveals Customers nav item');
  assert(!custViewItems.some(i => i.id === 'team'), 'customers.view custom role hides Team nav item');

  // 9G. inventory.view ONLY
  const invViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-inv-view-only',
    rolePermissions: ['inventory.view'],
  });
  const invViewNav = resolveDashboardNavigation(invViewCtx);
  const invViewItems = invViewNav.flatMap(s => s.items);
  assert(invViewItems.some(i => i.id === 'operations'), 'inventory.view custom role reveals Operations nav item');

  // 9H. reports.view ONLY
  const repViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-rep-view-only',
    rolePermissions: ['reports.view'],
  });
  const repViewNav = resolveDashboardNavigation(repViewCtx);
  const repViewItems = repViewNav.flatMap(s => s.items);
  assert(repViewItems.some(i => i.id === 'reports'), 'reports.view custom role reveals Reports nav item');

  // 9I. staff.view ONLY
  const staffViewCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'custom',
    customRoleId: 'cr-staff-view-only',
    rolePermissions: ['staff.view'],
  });
  const staffViewNav = resolveDashboardNavigation(staffViewCtx);
  const staffViewItems = staffViewNav.flatMap(s => s.items);
  assert(staffViewItems.some(i => i.id === 'team'), 'staff.view custom role reveals Team nav item');

  // 9J. ZERO permissions (Restricted Role)
  const zeroPermCtx = createMockAuthContext({
    isBusinessOwner: false,
    membershipRole: 'cashier',
    customRoleId: 'cr-zero-perm',
    rolePermissions: [],
  });
  const zeroPermNav = resolveDashboardNavigation(zeroPermCtx);
  const zeroPermItems = zeroPermNav.flatMap(s => s.items).filter(i => i.id !== 'dashboard');
  assert(zeroPermItems.length === 0, 'Zero permission custom role has 0 child navigation items');
  const zeroPermModel = await resolveDashboardHomeModel(zeroPermCtx);
  assert(zeroPermModel.isFallbackMode, 'Zero permission custom role triggers isFallbackMode');

  // --- 10. Scope-Aware Gating & Overrides ---
  console.log('\n--- 10. Scope-Aware Gating & Overrides ---');

  // 10A. Resource on unauthorized branch is denied
  const unauthorizedBranchResource = {
    resourceType: 'branch' as const,
    resourceId: 'branch-999-other',
    businessId: 'biz-123',
    branchId: 'branch-999-other',
    departmentId: null,
    organizationUnitId: null,
    serviceAreaId: null,
    ownerUserId: null,
  };
  const authorizedBranchCan = await can({ context: bizViewCtx, permission: 'business.view', resource: branchResource });
  const unauthorizedBranchCan = await can({ context: bizViewCtx, permission: 'business.view', resource: unauthorizedBranchResource });
  assert(authorizedBranchCan, 'Permission granted on authorized branch-1');
  assert(!unauthorizedBranchCan, 'Permission denied on unauthorized branch-999');

  // 10B. Explicit DENY override precedence
  const denyOverrideCtx = createMockAuthContext({
    isBusinessOwner: false,
    rolePermissions: ['menu.view', 'tables.view'],
    permissionOverrides: [
      {
        id: 'ovr-1',
        businessMembershipId: 'mem-123',
        permissionKey: 'menu.view',
        effect: 'deny',
        scopeType: 'PROPERTY',
        branchId: 'branch-1',
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  assert(!hasNavCapability(denyOverrideCtx, 'menu.view'), 'Explicit DENY override revokes menu.view capability in navigation');
  assert(hasNavCapability(denyOverrideCtx, 'tables.view'), 'tables.view remains granted when not overridden');

  // --- 11. Operational Staff Direct Landing Preservation ---
  console.log('\n--- 11. Operational Staff Direct Landing Preservation ---');
  assert(resolveDefaultWorkspaceRoute('cashier', null) === '/dashboard/cashier', 'Built-in Cashier routes to /dashboard/cashier');
  assert(resolveDefaultWorkspaceRoute('kitchen_staff', null) === '/dashboard/kitchen', 'Built-in Kitchen Staff routes to /dashboard/kitchen');
  assert(resolveDefaultWorkspaceRoute('waiter', null) === '/dashboard/waiter', 'Built-in Waiter routes to /dashboard/waiter');
  assert(resolveDefaultWorkspaceRoute('cashier', 'cr-qa-uuid') === '/dashboard', 'Custom role user routes to /dashboard even if base role is cashier');

  // --- 12. Mobile-Safe Layout & Responsive Design ---
  console.log('\n--- 12. Mobile-Safe Layout & Responsive Design ---');
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

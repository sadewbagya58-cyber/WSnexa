import { AuthorizationContext, ResourceScope } from '@/types/authorization.types';
import { can } from '@/server/auth/policy-engine';

export interface DashboardQuickAction {
  id: string;
  label: string;
  href: string;
  icon?: string;
}

export interface DashboardHomeModel {
  isBusinessOwner: boolean;
  isBranchManager: boolean;
  isFallbackMode: boolean;

  // Capability Flags
  canViewReports: boolean;
  canViewFinancials: boolean;
  canViewMenu: boolean;
  canManageMenu: boolean;
  canViewTables: boolean;
  canManageTables: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canManagePurchasing: boolean;
  canViewAccess: boolean;
  canManageAccess: boolean;
  canViewPeople: boolean;
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canViewKitchen: boolean;
  canManageWaiter: boolean;
  canViewReservations: boolean;
  canManageStaff: boolean;
  canViewReviews: boolean;
  canRespondReviews: boolean;

  // Today Metrics — permission-gated cards (Phase 37 Step 3)
  showOrdersTodayCard: boolean;
  showRevenueTodayCard: boolean;
  showReservationsTodayCard: boolean;
  showTableStatusCard: boolean;
  showLowStockCard: boolean;

  // Structural Section Flags
  showAttentionSection: boolean;    // rendered when any attention data may exist
  showOperationsShortcuts: boolean; // compact Cashier/Kitchen/Waiter chip bar
  showCashierShortcut: boolean;
  showKitchenShortcut: boolean;
  showWaiterShortcut: boolean;

  // Preserved & Compatibility Card Flags
  showExecutiveSummary: boolean;
  showMenuStatsCard: boolean;
  showDiningStatsCard: boolean;
  showInventoryCard: boolean;
  showAccessGovernanceCard: boolean;
  showCashierShortcutCard: boolean;
  showKitchenQueueCard: boolean;
  showWaiterQueueCard: boolean;
  showReportsCard: boolean;
  showReviewsCard: boolean;

  // Setup Progress (conditional — collapses once business is operational)
  showSetupChecklist: boolean;
  setupComplete: boolean; // computed in page.tsx after DB fetch

  // Audit log — removed from dashboard display (always false)
  showAuditLogs: false;

  // Dynamically Filtered Quick Actions (max 4 high-frequency)
  quickActions: DashboardQuickAction[];
}

/**
 * Capability-first Dashboard Composition Resolver.
 * Derives daily-operational section visibility, permission-gated metrics,
 * compact operational shortcuts, and quick actions from effective permissions.
 *
 * Phase 37 Step 3: Simplified to show daily metrics instead of
 * module-count and technical administration cards.
 */
export async function resolveDashboardHomeModel(
  authContext: AuthorizationContext
): Promise<DashboardHomeModel> {
  const activeBranchId = authContext.activeBranchId;
  const branchResource: ResourceScope | undefined = activeBranchId
    ? {
        resourceType: 'branch',
        resourceId: activeBranchId,
        businessId: authContext.businessId,
        branchId: activeBranchId,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      }
    : undefined;

  // 1. Evaluate Capability Permissions (parallel batch)
  const [
    canViewReports,
    canViewFinancials,
    canManageMenu,
    canViewMenu,
    canManageTables,
    canViewTables,
    canManageInventory,
    canViewInventory,
    canManagePurchasing,
    canViewAccess,
    canManageAccess,
    canViewPeople,
    canViewOrders,
    canCreateOrdersA,
    canCreateOrdersB,
    canViewKitchenA,
    canViewKitchenB,
    canManageWaiterA,
    canManageWaiterB,
    canViewReservations,
    canManageStaffA,
    canManageStaffB,
    canViewReviews,
    canRespondReviews,
  ] = await Promise.all([
    can({ context: authContext, permission: 'reports.view', resource: branchResource }),
    can({ context: authContext, permission: 'reports.financial.view', resource: branchResource }),
    can({ context: authContext, permission: 'menu.manage', resource: branchResource }),
    can({ context: authContext, permission: 'menu.view', resource: branchResource }),
    can({ context: authContext, permission: 'tables.manage', resource: branchResource }),
    can({ context: authContext, permission: 'tables.view', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.view', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.purchasing.manage', resource: branchResource }),
    can({ context: authContext, permission: 'roles.view', resource: branchResource }),
    can({ context: authContext, permission: 'roles.manage', resource: branchResource }),
    can({ context: authContext, permission: 'people.view', resource: branchResource }),
    can({ context: authContext, permission: 'orders.view', resource: branchResource }),
    can({ context: authContext, permission: 'cashier.access', resource: branchResource }),
    can({ context: authContext, permission: 'orders.create', resource: branchResource }),
    can({ context: authContext, permission: 'kitchen.orders.view', resource: branchResource }),
    can({ context: authContext, permission: 'kitchen.access', resource: branchResource }),
    can({ context: authContext, permission: 'waiter.access', resource: branchResource }),
    can({ context: authContext, permission: 'waiter.requests.manage', resource: branchResource }),
    can({ context: authContext, permission: 'reservations.view', resource: branchResource }),
    can({ context: authContext, permission: 'staff.invite', resource: branchResource }),
    can({ context: authContext, permission: 'staff.manage', resource: branchResource }),
    can({ context: authContext, permission: 'reviews.view', resource: branchResource }),
    can({ context: authContext, permission: 'reviews.respond', resource: branchResource }),
  ]);

  const canCreateOrders = canCreateOrdersA || canCreateOrdersB;
  const canViewKitchen = canViewKitchenA || canViewKitchenB;
  const canManageWaiter = canManageWaiterA || canManageWaiterB;
  const canManageStaff = canManageStaffA || canManageStaffB;

  const isBusinessOwner = authContext.isBusinessOwner;
  const isBranchManager = authContext.membershipRole === 'branch_manager';

  // 2. Today Metric Card Visibility (permission-gated)
  const showOrdersTodayCard = canViewOrders || canCreateOrders || isBusinessOwner || isBranchManager;
  const showRevenueTodayCard = canViewFinancials || isBusinessOwner;
  const showReservationsTodayCard = canViewReservations || isBusinessOwner || isBranchManager;
  const showTableStatusCard = canViewTables || canManageTables || isBusinessOwner || isBranchManager;
  const showLowStockCard = canViewInventory || canManageInventory || isBusinessOwner || isBranchManager;

  // 3. Operational Shortcuts (compact chip bar — not hero cards)
  const showCashierShortcut = canCreateOrders || isBusinessOwner || isBranchManager;
  const showKitchenShortcut = canViewKitchen || isBusinessOwner || isBranchManager;
  const showWaiterShortcut = canManageWaiter || isBusinessOwner || isBranchManager;
  const showOperationsShortcuts = showCashierShortcut || showKitchenShortcut || showWaiterShortcut;

  // 4. Compatibility Card Visibility Flags
  const showMenuStatsCard = canViewMenu || canManageMenu || isBusinessOwner || isBranchManager;
  const showDiningStatsCard = canViewTables || canManageTables || isBusinessOwner || isBranchManager;
  const showInventoryCard = canViewInventory || canManageInventory || isBusinessOwner || isBranchManager;
  const showAccessGovernanceCard = canViewAccess || canManageAccess || isBusinessOwner;
  const showCashierShortcutCard = canCreateOrders || isBusinessOwner;
  const showKitchenQueueCard = canViewKitchen || isBusinessOwner;
  const showWaiterQueueCard = canManageWaiter || isBusinessOwner;
  const showReportsCard = canViewReports || isBusinessOwner;
  const showReviewsCard = canViewReviews || canRespondReviews || isBusinessOwner;
  const showExecutiveSummary = isBusinessOwner || isBranchManager || canViewReports;

  // 5. Attention Section — rendered when there's data worth surfacing to this role
  const showAttentionSection =
    (showReservationsTodayCard && canViewReservations) ||
    (showLowStockCard && (canViewInventory || canManageInventory)) ||
    (showOrdersTodayCard && (canViewOrders || canCreateOrders)) ||
    isBusinessOwner ||
    isBranchManager;

  // 6. Setup Checklist
  const showSetupChecklist = isBusinessOwner || (canManageMenu && canManageTables);
  const setupComplete = false; // page.tsx overrides after DB fetch

  // 7. Quick Actions — max 4, highest-frequency operations
  const rawActions: { action: DashboardQuickAction; condition: boolean }[] = [
    {
      action: { id: 'menu-item', label: '+ Add Menu Item', href: '/dashboard/menu/items' },
      condition: canManageMenu || isBusinessOwner,
    },
    {
      action: { id: 'orders', label: '📋 View Orders', href: '/dashboard/orders' },
      condition: canViewOrders || canCreateOrders || isBusinessOwner || isBranchManager,
    },
    {
      action: { id: 'dining', label: '🍽️ Manage Dining', href: '/dashboard/dining' },
      condition: canManageTables || isBusinessOwner || isBranchManager,
    },
    {
      action: { id: 'invite-staff', label: '👥 Invite Staff', href: '/dashboard/team/invites' },
      condition: canManageStaff || isBusinessOwner,
    },
    {
      // Fallback for analytics-only or limited roles
      action: { id: 'reports', label: '📈 View Reports', href: '/dashboard/reports' },
      condition: canViewReports && !canManageMenu && !canManageTables && !canCreateOrders,
    },
  ];

  const quickActions = rawActions
    .filter((a) => a.condition)
    .map((a) => a.action)
    .slice(0, 4);

  // 8. Fallback Mode — user has no meaningful operational access
  const hasAnyAccess =
    showOrdersTodayCard ||
    showReservationsTodayCard ||
    showTableStatusCard ||
    showOperationsShortcuts ||
    canViewReports;

  const isFallbackMode = !hasAnyAccess && !isBusinessOwner;

  return {
    isBusinessOwner,
    isBranchManager,
    isFallbackMode,

    canViewReports,
    canViewFinancials,
    canViewMenu,
    canManageMenu,
    canViewTables,
    canManageTables,
    canViewInventory,
    canManageInventory,
    canManagePurchasing,
    canViewAccess,
    canManageAccess,
    canViewPeople,
    canViewOrders,
    canCreateOrders,
    canViewKitchen,
    canManageWaiter,
    canViewReservations,
    canManageStaff,
    canViewReviews,
    canRespondReviews,

    showOrdersTodayCard,
    showRevenueTodayCard,
    showReservationsTodayCard,
    showTableStatusCard,
    showLowStockCard,

    showAttentionSection,
    showOperationsShortcuts,
    showCashierShortcut,
    showKitchenShortcut,
    showWaiterShortcut,

    showExecutiveSummary,
    showMenuStatsCard,
    showDiningStatsCard,
    showInventoryCard,
    showAccessGovernanceCard,
    showCashierShortcutCard,
    showKitchenQueueCard,
    showWaiterQueueCard,
    showReportsCard,
    showReviewsCard,

    showSetupChecklist,
    setupComplete,
    showAuditLogs: false,

    quickActions,
  };
}

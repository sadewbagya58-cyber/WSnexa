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
  canCreateOrders: boolean;
  canViewKitchen: boolean;
  canManageWaiter: boolean;
  canViewReviews: boolean;
  canRespondReviews: boolean;

  // Card / Section Visibility Flags
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
  showSetupChecklist: boolean;
  showAuditLogs: boolean;

  // Dynamically Filtered Quick Actions
  quickActions: DashboardQuickAction[];
}

/**
 * Capability-first Dashboard Composition Resolver.
 * Derives dynamic cards, metric visibility, setup checklist, and quick actions
 * from the user's effective permissions, active branch, and scope context.
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

  // 1. Evaluate Capability Permissions
  const [
    canViewReports,
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
    canCreateOrders,
    canViewKitchen,
    canManageWaiter,
    canViewReviews,
    canRespondReviews,
  ] = await Promise.all([
    can({ context: authContext, permission: 'reports.view', resource: branchResource }),
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
    can({ context: authContext, permission: 'cashier.access', resource: branchResource }) ||
      can({ context: authContext, permission: 'orders.create', resource: branchResource }),
    can({ context: authContext, permission: 'kitchen.orders.view', resource: branchResource }) ||
      can({ context: authContext, permission: 'kitchen.access', resource: branchResource }),
    can({ context: authContext, permission: 'waiter.access', resource: branchResource }) ||
      can({ context: authContext, permission: 'waiter.requests.manage', resource: branchResource }),
    can({ context: authContext, permission: 'reviews.view', resource: branchResource }),
    can({ context: authContext, permission: 'reviews.respond', resource: branchResource }),
  ]);

  const isBusinessOwner = authContext.isBusinessOwner;
  const isBranchManager = authContext.membershipRole === 'branch_manager';

  // 2. Card / Section Visibility Gating
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
  const showSetupChecklist = isBusinessOwner || (canManageMenu && canManageTables);
  const showAuditLogs = isBusinessOwner || canViewAccess || canViewPeople;

  // 3. Filter Quick Action Shortcuts
  const rawActions: { action: DashboardQuickAction; condition: boolean }[] = [
    {
      action: { id: 'tables-qr', label: '📱 Manage & Export Table QRs', href: '/dashboard/tables/qr' },
      condition: canManageTables || isBusinessOwner,
    },
    {
      action: { id: 'tables-bulk', label: '⚡ Bulk Generate Tables', href: '/dashboard/tables/bulk' },
      condition: canManageTables || isBusinessOwner,
    },
    {
      action: { id: 'tables-areas', label: '📁 Create Service Area', href: '/dashboard/tables/areas' },
      condition: canManageTables || isBusinessOwner,
    },
    {
      action: { id: 'menu-cat', label: '🏷️ Add Category', href: '/dashboard/menu/categories' },
      condition: canManageMenu || isBusinessOwner,
    },
    {
      action: { id: 'menu-item', label: '🍔 Add Menu Item', href: '/dashboard/menu/items' },
      condition: canManageMenu || isBusinessOwner,
    },
    {
      action: { id: 'inventory-count', label: '📋 Physical Count', href: '/dashboard/inventory/counts' },
      condition: canManageInventory || isBusinessOwner,
    },
    {
      action: { id: 'inventory-po', label: '📦 New Purchase Order', href: '/dashboard/inventory/purchasing' },
      condition: canManagePurchasing || isBusinessOwner,
    },
    {
      action: { id: 'reports-analytics', label: '📈 View Reports', href: '/dashboard/reports' },
      condition: canViewReports || isBusinessOwner,
    },
    {
      action: { id: 'reviews-respond', label: '💬 Guest Reviews', href: '/dashboard/reviews' },
      condition: canViewReviews || isBusinessOwner,
    },
    {
      action: { id: 'access-control', label: '🛡️ Access Control', href: '/dashboard/access' },
      condition: canManageAccess || isBusinessOwner,
    },
  ];

  const quickActions = rawActions.filter((a) => a.condition).map((a) => a.action);

  // 4. Determine Fallback Mode
  const hasAnyOperationalOrAdminCard =
    showMenuStatsCard ||
    showDiningStatsCard ||
    showInventoryCard ||
    showAccessGovernanceCard ||
    showCashierShortcutCard ||
    showKitchenQueueCard ||
    showWaiterQueueCard ||
    showReportsCard ||
    showReviewsCard;

  const isFallbackMode = !hasAnyOperationalOrAdminCard && !isBusinessOwner;

  return {
    isBusinessOwner,
    isBranchManager,
    isFallbackMode,

    canViewReports,
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
    canCreateOrders,
    canViewKitchen,
    canManageWaiter,
    canViewReviews,
    canRespondReviews,

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
    showAuditLogs,

    quickActions,
  };
}

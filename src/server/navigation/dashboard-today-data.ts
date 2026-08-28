import { createAdminClient } from '@/lib/supabase/server';
import { DashboardHomeModel } from './dashboard-home-model';
import { resolveAnalyticsDateRange } from '@/lib/analytics/time-range';

export interface DashboardAttentionItem {
  id: string;
  type: 'reservation' | 'inventory' | 'waiter' | 'setup';
  severity: 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface DashboardTodayData {
  // Key Numbers
  ordersTodayCount: number | null;
  activeOrdersCount: number | null;
  revenueTodayCents: number | null;
  reservationsTodayCount: number | null;
  availableTablesCount: number | null;
  occupiedTablesCount: number | null;
  reservedTablesCount: number | null;
  totalTablesCount: number | null;
  lowStockCount: number | null;
  currency: string;

  // Attention Items
  attentionItems: DashboardAttentionItem[];

  // Setup completion counts (for conditional setup checklist)
  categoriesCount: number;
  menuItemsCount: number;
  serviceAreasCount: number;
  tablesCount: number;
  setupComplete: boolean;
}

interface InventoryBalanceRow {
  current_quantity?: number | null;
  branch_id?: string | null;
}

interface InventoryItemRow {
  id: string;
  min_stock_level?: number | null;
  inventory_balances?: InventoryBalanceRow[];
}

interface DiningTableRow {
  id: string;
  status: string;
}

/**
 * Single-pass Server-Side Data Fetcher for the Daily Dashboard.
 * Efficiently loads today metrics, attention signals, and setup status
 * strictly respecting the user's effective permission model.
 */
export async function fetchDashboardTodayData(
  businessId: string,
  activeBranch: { id: string; name: string; timezone?: string },
  model: DashboardHomeModel,
  currency: string = 'USD'
): Promise<DashboardTodayData> {
  const admin = createAdminClient();
  const tz = activeBranch.timezone || 'Asia/Colombo';
  const dateRange = resolveAnalyticsDateRange({ preset: 'today' }, tz);

  // Local YYYY-MM-DD for date-based table queries (e.g., reservations)
  const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

  // Prepare conditional query promises (only execute for permitted cards)
  const ordersTodayPromise = model.showOrdersTodayCard
    ? admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .gte('created_at', dateRange.startUtc)
        .lt('created_at', dateRange.endUtc)
        .neq('status', 'cancelled')
    : Promise.resolve({ count: null });

  const activeOrdersPromise = model.showOrdersTodayCard
    ? admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
    : Promise.resolve({ count: null });

  const revenuePromise: Promise<{ revenue: number | null }> = model.showRevenueTodayCard
    ? (async () => {
        try {
          const { data, error } = await admin.rpc('get_branch_sales_summary', {
            p_branch_id: activeBranch.id,
            p_start_date: dateRange.startUtc,
            p_end_date: dateRange.endUtc,
          });
          if (error || !data) return { revenue: 0 };
          const res = data as { paid_revenue_cents?: number; gross_sales_cents?: number; paid_revenue?: number; gross_sales?: number };
          const revenue = res.paid_revenue_cents ?? res.paid_revenue ?? res.gross_sales_cents ?? res.gross_sales ?? 0;
          return { revenue: Number(revenue) };
        } catch {
          return { revenue: 0 };
        }
      })()
    : Promise.resolve({ revenue: null });

  const reservationsTodayPromise = model.showReservationsTodayCard
    ? admin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .eq('reservation_date', localDateStr)
        .neq('status', 'CANCELLED')
        .neq('status', 'DECLINED')
    : Promise.resolve({ count: null });

  const pendingReservationsPromise = model.showAttentionSection && model.showReservationsTodayCard
    ? admin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .eq('status', 'PENDING')
        .gte('reservation_date', localDateStr)
    : Promise.resolve({ count: 0 });

  const diningTablesPromise = (model.showTableStatusCard || model.showSetupChecklist)
    ? admin
        .from('dining_tables')
        .select('id, status')
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ data: [] });

  const lowStockPromise: Promise<{ lowStockCount: number | null }> = (model.showLowStockCard || ((model.canViewInventory || model.canManageInventory || model.isBusinessOwner || model.isBranchManager) && model.showAttentionSection))
    ? (async () => {
        try {
          const { data } = await admin
            .from('inventory_items')
            .select('id, min_stock_level, inventory_balances(current_quantity, branch_id)')
            .eq('business_id', businessId)
            .eq('is_active', true);
          if (!data) return { lowStockCount: 0 };
          const items = data as unknown as InventoryItemRow[];
          let count = 0;
          for (const item of items) {
            const balances = (item.inventory_balances || []).filter(
              (b) => !b.branch_id || b.branch_id === activeBranch.id
            );
            const itemStock = balances.reduce((sum, b) => sum + Number(b.current_quantity || 0), 0);
            const minLevel = Number(item.min_stock_level || 0);
            if (minLevel > 0 && itemStock <= minLevel) {
              count++;
            }
          }
          return { lowStockCount: count };
        } catch {
          return { lowStockCount: 0 };
        }
      })()
    : Promise.resolve({ lowStockCount: null });

  const pendingWaiterRequestsPromise = (model.canManageWaiter || model.canViewKitchen || model.isBusinessOwner || model.isBranchManager)
    ? admin
        .from('waiter_requests')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .eq('status', 'pending')
    : Promise.resolve({ count: 0 });

  const menuCategoriesPromise = model.showSetupChecklist
    ? admin
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const menuItemsPromise = model.showSetupChecklist
    ? admin
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const serviceAreasPromise = model.showSetupChecklist
    ? admin
        .from('service_areas')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', activeBranch.id)
        .is('deleted_at', null)
    : Promise.resolve({ count: 0 });

  const [
    { count: ordersTodayCount },
    { count: activeOrdersCount },
    { revenue: revenueTodayCents },
    { count: reservationsTodayCount },
    { count: pendingReservationsCount },
    { data: tablesData },
    { lowStockCount },
    { count: pendingWaiterCount },
    { count: categoriesCountRaw },
    { count: menuItemsCountRaw },
    { count: serviceAreasCountRaw },
  ] = await Promise.all([
    ordersTodayPromise,
    activeOrdersPromise,
    revenuePromise,
    reservationsTodayPromise,
    pendingReservationsPromise,
    diningTablesPromise,
    lowStockPromise,
    pendingWaiterRequestsPromise,
    menuCategoriesPromise,
    menuItemsPromise,
    serviceAreasPromise,
  ]);

  const tables = (tablesData || []) as DiningTableRow[];
  const totalTablesCount = model.showTableStatusCard ? tables.length : null;
  const availableTablesCount = model.showTableStatusCard ? tables.filter((t) => t.status === 'available').length : null;
  const occupiedTablesCount = model.showTableStatusCard ? tables.filter((t) => t.status === 'occupied').length : null;
  const reservedTablesCount = model.showTableStatusCard ? tables.filter((t) => t.status === 'reserved').length : null;

  const categoriesCount = categoriesCountRaw || 0;
  const menuItemsCount = menuItemsCountRaw || 0;
  const serviceAreasCount = serviceAreasCountRaw || 0;
  const tablesCount = tables.length;
  const setupComplete = categoriesCount > 0 && menuItemsCount > 0 && serviceAreasCount > 0 && tablesCount > 0;

  const attentionItems: DashboardAttentionItem[] = [];

  if (
    (model.canViewReservations || model.isBusinessOwner || model.isBranchManager) &&
    pendingReservationsCount &&
    pendingReservationsCount > 0
  ) {
    attentionItems.push({
      id: 'pending-reservations',
      type: 'reservation',
      severity: 'warning',
      title: `${pendingReservationsCount} Pending Reservation${pendingReservationsCount > 1 ? 's' : ''}`,
      description: 'Guest bookings awaiting staff confirmation.',
      href: '/dashboard/reservations',
      actionLabel: 'Review Reservations →',
    });
  }

  if (
    (model.canViewInventory || model.canManageInventory || model.isBusinessOwner || model.isBranchManager) &&
    lowStockCount &&
    lowStockCount > 0
  ) {
    attentionItems.push({
      id: 'low-stock',
      type: 'inventory',
      severity: 'warning',
      title: `${lowStockCount} Item${lowStockCount > 1 ? 's' : ''} Low in Stock`,
      description: 'Inventory items below minimum reorder threshold.',
      href: '/dashboard/inventory',
      actionLabel: 'Check Inventory →',
    });
  }

  if (
    (model.canManageWaiter || model.canViewKitchen || model.isBusinessOwner || model.isBranchManager) &&
    pendingWaiterCount &&
    pendingWaiterCount > 0
  ) {
    attentionItems.push({
      id: 'waiter-requests',
      type: 'waiter',
      severity: 'warning',
      title: `${pendingWaiterCount} Table Call${pendingWaiterCount > 1 ? 's' : ''} Active`,
      description: 'Guests waiting for waiter assistance on the dining floor.',
      href: '/dashboard/waiter',
      actionLabel: 'Open Waiter Queue →',
    });
  }

  if (model.showSetupChecklist && !setupComplete) {
    const missing: string[] = [];
    if (categoriesCount === 0 || menuItemsCount === 0) missing.push('Menu Items');
    if (serviceAreasCount === 0 || tablesCount === 0) missing.push('Dining Tables');

    if (missing.length > 0) {
      attentionItems.push({
        id: 'setup-blocker',
        type: 'setup',
        severity: 'info',
        title: 'Initial Venue Setup Incomplete',
        description: `Finish setting up: ${missing.join(', ')} to start taking orders.`,
        href: categoriesCount === 0 ? '/dashboard/menu' : '/dashboard/tables',
        actionLabel: 'Complete Setup →',
      });
    }
  }

  return {
    ordersTodayCount: ordersTodayCount ?? null,
    activeOrdersCount: activeOrdersCount ?? null,
    revenueTodayCents: revenueTodayCents !== null ? revenueTodayCents : null,
    reservationsTodayCount: reservationsTodayCount ?? null,
    availableTablesCount,
    occupiedTablesCount,
    reservedTablesCount,
    totalTablesCount,
    lowStockCount,
    currency,
    attentionItems,
    categoriesCount,
    menuItemsCount,
    serviceAreasCount,
    tablesCount,
    setupComplete,
  };
}
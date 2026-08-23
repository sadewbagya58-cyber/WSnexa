import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, BreakdownItemDTO, AnalyticsError, DataQualityFlag } from '@/lib/analytics/analytics-types';

export interface MenuPerformanceItem {
  itemName: string;
  quantitySold: number;
  revenueCents: number;
  orderCount: number;
  penetrationRate: number;
  avgPriceCents: number;
}

export interface MenuAnalyticsResult {
  topSellingItems: MenuPerformanceItem[];
  categorySales: BreakdownItemDTO[];
  modifierPerformance: BreakdownItemDTO[];
  estimatedFoodCost: MetricValueDTO;
  contributionMargin: MetricValueDTO;
}

interface RpcMenuItem {
  item_name: string;
  quantity_sold: number;
  total_revenue_cents: number;
  orders_count: number;
  avg_price_cents: number;
}

interface RpcModifierItem {
  group_name: string;
  option_name: string;
  additional_revenue_cents: number;
  selections_count: number;
}

interface CategoryJoinRow {
  quantity: number;
  total_price_cents: number;
  menu_items?: {
    id: string;
    category_id: string;
    menu_categories?: {
      name: string;
    };
  };
}

/**
 * Server data engine for menu performance, sales by item/category, modifier usage,
 * and recipe-cost-derived contribution margins.
 */
export async function getMenuAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string
): Promise<MenuAnalyticsResult> {
  const admin = createAdminClient();
  const primaryBranchId = branchIds[0];

  if (!primaryBranchId) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for menu analytics.');
  }

  // 1. Fetch Menu Analytics RPC
  const { data: menuRes, error: menuErr } = await admin.rpc('get_menu_analytics', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
    p_limit: 20,
  });

  if (menuErr) {
    throw new AnalyticsError('DATABASE_ERROR', `Failed to query menu analytics: ${menuErr.message}`);
  }

  // 2. Fetch Total Completed Orders count for penetration rate
  const { data: summaryRes } = await admin.rpc('get_branch_sales_summary', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });
  const summaryData = summaryRes as { completed_orders?: number; gross_sales_cents?: number } | null;
  const completedOrdersCount = summaryData?.completed_orders || 0;

  const rawItems = (menuRes as { items?: RpcMenuItem[] })?.items || [];
  const topSellingItems: MenuPerformanceItem[] = rawItems.map((item) => ({
    itemName: item.item_name,
    quantitySold: item.quantity_sold || 0,
    revenueCents: item.total_revenue_cents || 0,
    orderCount: item.orders_count || 0,
    penetrationRate: completedOrdersCount > 0 ? Number(((item.orders_count / completedOrdersCount) * 100).toFixed(2)) : 0,
    avgPriceCents: item.avg_price_cents || 0,
  }));

  // 3. Category Sales Aggregation
  const { data: categoryData } = await admin
    .from('order_items')
    .select('quantity, total_price_cents, menu_items!inner(id, category_id, menu_categories!inner(name)), orders!inner(branch_id, created_at, status)')
    .eq('orders.branch_id', primaryBranchId)
    .gte('orders.created_at', dateRange.startUtc)
    .lt('orders.created_at', dateRange.endUtc)
    .neq('orders.status', 'cancelled');

  const catMap = new Map<string, { label: string; revenue: number; qty: number }>();
  const categoryRows = (categoryData || []) as unknown as CategoryJoinRow[];

  categoryRows.forEach((row) => {
    const catName = row.menu_items?.menu_categories?.name || 'Uncategorized';
    const existing = catMap.get(catName) || { label: catName, revenue: 0, qty: 0 };
    existing.revenue += row.total_price_cents || 0;
    existing.qty += row.quantity || 0;
    catMap.set(catName, existing);
  });

  const totalCatRevenue = Array.from(catMap.values()).reduce((sum, c) => sum + c.revenue, 0);

  const categorySales: BreakdownItemDTO[] = Array.from(catMap.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    value: val.revenue,
    subValue: val.qty,
    percentage: totalCatRevenue > 0 ? Number(((val.revenue / totalCatRevenue) * 100).toFixed(2)) : 0,
  }));

  // 4. Modifier Analytics RPC
  const { data: modifierRes } = await admin.rpc('get_modifier_analytics', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
    p_limit: 20,
  });

  const rawModifiers = (modifierRes as { modifiers?: RpcModifierItem[] })?.modifiers || [];
  const modifierPerformance: BreakdownItemDTO[] = rawModifiers.map((m) => ({
    key: `${m.group_name}:${m.option_name}`,
    label: `${m.group_name} - ${m.option_name}`,
    value: m.additional_revenue_cents || 0,
    subValue: m.selections_count || 0,
  }));

  // 5. Recipe BOM Costing & Contribution Margin Calculations
  const { data: recipesData } = await admin
    .from('recipes')
    .select('menu_item_id, cost_per_unit_cents')
    .eq('business_id', businessId);

  const recipeCostMap = new Map<string, number>();
  ((recipesData || []) as { menu_item_id: string | null; cost_per_unit_cents: number | null }[]).forEach((r) => {
    if (r.menu_item_id && r.cost_per_unit_cents !== null) {
      recipeCostMap.set(r.menu_item_id, r.cost_per_unit_cents);
    }
  });

  let totalFoodCostCents = 0;
  let itemsWithCostCount = 0;
  let totalSoldItemsCount = 0;

  categoryRows.forEach((row) => {
    const menuItemId = row.menu_items?.id;
    const qty = row.quantity || 0;
    totalSoldItemsCount += qty;

    if (menuItemId && recipeCostMap.has(menuItemId)) {
      totalFoodCostCents += recipeCostMap.get(menuItemId)! * qty;
      itemsWithCostCount += qty;
    }
  });

  let quality: DataQualityFlag = 'COMPLETE';
  let qualityNote: string | undefined = undefined;

  if (totalSoldItemsCount === 0) {
    quality = 'UNAVAILABLE';
    qualityNote = 'No menu items sold during date range.';
  } else if (itemsWithCostCount === 0) {
    quality = 'UNAVAILABLE';
    qualityNote = 'No recipe costing data available for sold menu items.';
  } else if (itemsWithCostCount < totalSoldItemsCount) {
    quality = 'PARTIAL';
    qualityNote = `Estimated food cost covers ${itemsWithCostCount} of ${totalSoldItemsCount} sold item units.`;
  }

  const grossSalesVal = summaryData?.gross_sales_cents || 0;
  const marginVal = (quality !== 'UNAVAILABLE') ? grossSalesVal - totalFoodCostCents : null;

  return {
    topSellingItems,
    categorySales,
    modifierPerformance,
    estimatedFoodCost: {
      key: 'estimated_food_cost',
      value: quality !== 'UNAVAILABLE' ? totalFoodCostCents : null,
      unit: 'currency',
      currency,
      quality,
      qualityNote,
    },
    contributionMargin: {
      key: 'contribution_margin',
      value: marginVal,
      unit: 'currency',
      currency,
      quality,
      qualityNote,
    },
  };
}

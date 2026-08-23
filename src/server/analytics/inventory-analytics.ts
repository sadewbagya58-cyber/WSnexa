import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, AnalyticsError } from '@/lib/analytics/analytics-types';

export interface InventoryAnalyticsResult {
  currentStock: MetricValueDTO;
  lowStockItemCount: MetricValueDTO;
  outOfStockItemCount: MetricValueDTO;
  wasteQuantity: MetricValueDTO;
  wasteCostCents: MetricValueDTO;
  transferVolume: MetricValueDTO;
}

interface InventoryItemRow {
  id: string;
  min_reorder_level?: number | null;
  inventory_balances?: { quantity?: number | null }[];
}

interface WasteRecordRow {
  quantity?: number | null;
  total_cost_cents?: number | null;
}

interface TransferRow {
  quantity?: number | null;
}

/**
 * Server data engine for inventory stock balances, low/out-of-stock counts, waste tracking, and branch transfers.
 */
export async function getInventoryAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string,
  hasFinancialAccess: boolean = true
): Promise<InventoryAnalyticsResult> {
  const admin = createAdminClient();
  const primaryBranchId = branchIds[0];

  if (!primaryBranchId) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for inventory analytics.');
  }

  // 1. Current Stock Balances & Low/Out-of-Stock Counts
  const { data: itemsData, error: itemsErr } = await admin
    .from('inventory_items')
    .select('id, min_reorder_level, inventory_balances(quantity)')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (itemsErr) {
    throw new AnalyticsError('DATABASE_ERROR', `Failed to query inventory balances: ${itemsErr.message}`);
  }

  let totalStockQty = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const items = (itemsData || []) as unknown as InventoryItemRow[];
  items.forEach((item) => {
    const balances = item.inventory_balances || [];
    const itemStock = balances.reduce((sum: number, b) => sum + Number(b.quantity || 0), 0);
    const minLevel = Number(item.min_reorder_level || 0);

    totalStockQty += itemStock;

    if (itemStock <= 0) {
      outOfStockCount++;
    } else if (itemStock <= minLevel) {
      lowStockCount++;
    }
  });

  // 2. Waste Records
  const { data: wasteData } = await admin
    .from('inventory_waste_records')
    .select('quantity, total_cost_cents')
    .eq('branch_id', primaryBranchId)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc);

  let totalWasteQty = 0;
  let totalWasteCostCents = 0;

  const wasteRows = (wasteData || []) as WasteRecordRow[];
  wasteRows.forEach((w) => {
    totalWasteQty += Number(w.quantity || 0);
    totalWasteCostCents += Number(w.total_cost_cents || 0);
  });

  // 3. Stock Transfers (Received Volume)
  const { data: transferData } = await admin
    .from('inventory_stock_transfers')
    .select('quantity')
    .or(`source_branch_id.eq.${primaryBranchId},destination_branch_id.eq.${primaryBranchId}`)
    .eq('status', 'received')
    .gte('updated_at', dateRange.startUtc)
    .lt('updated_at', dateRange.endUtc);

  const transferRows = (transferData || []) as TransferRow[];
  const totalTransferVolume = transferRows.reduce((sum: number, t) => sum + Number(t.quantity || 0), 0);

  return {
    currentStock: {
      key: 'current_stock',
      value: totalStockQty,
      unit: 'count',
      quality: 'COMPLETE',
    },
    lowStockItemCount: {
      key: 'low_stock_item_count',
      value: lowStockCount,
      unit: 'count',
      quality: 'COMPLETE',
    },
    outOfStockItemCount: {
      key: 'out_of_stock_item_count',
      value: outOfStockCount,
      unit: 'count',
      quality: 'COMPLETE',
    },
    wasteQuantity: {
      key: 'waste_quantity',
      value: totalWasteQty,
      unit: 'count',
      quality: 'COMPLETE',
    },
    wasteCostCents: {
      key: 'waste_cost_cents',
      value: hasFinancialAccess ? totalWasteCostCents : null,
      unit: 'currency',
      currency,
      quality: hasFinancialAccess ? 'COMPLETE' : 'UNAVAILABLE',
      qualityNote: hasFinancialAccess ? undefined : 'Redacted: Financial reporting permission required.',
    },
    transferVolume: {
      key: 'transfer_volume',
      value: totalTransferVolume,
      unit: 'count',
      quality: 'COMPLETE',
    },
  };
}

export interface GroupedInventoryBranchMetrics {
  branchId: string;
  wasteCostCents: number | null;
}

/**
 * Grouped batched analytics retrieval across authorized target branches using DB-side aggregated RPCs.
 * Returns exactly targetBranchIds.length rows aggregated in Postgres.
 */
export async function getGroupedInventoryByBranch(
  businessId: string,
  targetBranchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string,
  hasFinancialAccess: boolean = true
): Promise<Map<string, GroupedInventoryBranchMetrics>> {
  const admin = createAdminClient();
  const map = new Map<string, GroupedInventoryBranchMetrics>();

  if (!targetBranchIds || targetBranchIds.length === 0) return map;

  // 1. DB-side aggregated RPC (returns 1 row per branch)
  const { data: rpcRows, error: rpcErr } = await admin.rpc('get_grouped_branch_inventory_summary', {
    p_business_id: businessId,
    p_branch_ids: targetBranchIds,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    for (const row of rpcRows) {
      const bId = row.branch_id;
      const wasteCents = Number(row.waste_cost_cents || 0);

      map.set(bId, {
        branchId: bId,
        wasteCostCents: hasFinancialAccess ? wasteCents : null,
      });
    }
    return map;
  }

  // 2. Fallback query if RPC is not present
  const { data: wasteData } = await admin
    .from('inventory_waste_records')
    .select('branch_id, total_cost_cents')
    .in('branch_id', targetBranchIds)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc);

  const branchWasteMap = new Map<string, number>();
  for (const bId of targetBranchIds) {
    branchWasteMap.set(bId, 0);
  }

  for (const row of wasteData || []) {
    const cur = branchWasteMap.get(row.branch_id) || 0;
    branchWasteMap.set(row.branch_id, cur + Number(row.total_cost_cents || 0));
  }

  for (const [bId, wasteCents] of branchWasteMap.entries()) {
    map.set(bId, {
      branchId: bId,
      wasteCostCents: hasFinancialAccess ? wasteCents : null,
    });
  }

  return map;
}



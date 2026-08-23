import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, TimeSeriesPointDTO, BreakdownItemDTO, AnalyticsError } from '@/lib/analytics/analytics-types';
import { computeMetricComparison } from '@/lib/analytics/time-range';

export interface SalesAnalyticsResult {
  grossSales: MetricValueDTO;
  netSales: MetricValueDTO;
  completedOrders: MetricValueDTO;
  placedOrders: MetricValueDTO;
  cancelledOrders: MetricValueDTO;
  rejectedOrders: MetricValueDTO;
  aov: MetricValueDTO;
  itemsSold: MetricValueDTO;
  avgItemsPerOrder: MetricValueDTO;
  salesByPaymentMethod: BreakdownItemDTO[];
  salesByHour: TimeSeriesPointDTO[];
  timeSeries: TimeSeriesPointDTO[];
}

interface RpcSalesSummary {
  gross_sales_cents?: number;
  paid_revenue_cents?: number;
  completed_orders?: number;
  total_orders?: number;
  cancelled_orders?: number;
  rejected_orders?: number;
  aov_cents?: number;
}

interface RpcPaymentBreakdown {
  payment_method: string;
  total_cents: number;
  transaction_count: number;
  percentage: number;
}

interface RpcTimeSeriesBucket {
  bucket: string;
  gross_sales_cents: number;
  orders_count: number;
  paid_revenue_cents: number;
}

interface RpcOrdersByHourBucket {
  hour: number;
  revenue_cents: number;
  orders_count: number;
}

/**
 * Server data engine for sales and revenue analytics metrics.
 * Uses RPCs and optimized Postgres aggregated queries scoped by businessId and target branch(es).
 */
export async function getSalesAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string,
  hasFinancialAccess: boolean = true
): Promise<SalesAnalyticsResult> {
  const admin = createAdminClient();
  const primaryBranchId = branchIds[0];

  if (!primaryBranchId) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for sales analytics.');
  }

  // 1. Fetch Current Period Branch Sales Summary
  const { data: currentSummaryData, error: summaryErr } = await admin.rpc('get_branch_sales_summary', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  if (summaryErr) {
    throw new AnalyticsError('DATABASE_ERROR', `Failed to query sales summary: ${summaryErr.message}`);
  }

  const currentSummary = (currentSummaryData as RpcSalesSummary) || {};

  // 2. Fetch Previous Period Branch Sales Summary (for comparison metrics)
  let prevSummary: RpcSalesSummary | null = null;
  if (dateRange.previousRange) {
    const { data: pData } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: primaryBranchId,
      p_start_date: dateRange.previousRange.startUtc,
      p_end_date: dateRange.previousRange.endUtc,
    });
    prevSummary = (pData as RpcSalesSummary) || null;
  }

  // Current values
  const grossSalesCents = currentSummary.gross_sales_cents || 0;
  const netSalesCents = currentSummary.paid_revenue_cents || 0;
  const completedCount = currentSummary.completed_orders || 0;
  const totalCount = currentSummary.total_orders || 0;
  const cancelledCount = currentSummary.cancelled_orders || 0;
  const rejectedCount = currentSummary.rejected_orders || 0;
  const aovCents = currentSummary.aov_cents || 0;

  // Previous values
  const prevGrossSalesCents = prevSummary?.gross_sales_cents ?? null;
  const prevNetSalesCents = prevSummary?.paid_revenue_cents ?? null;
  const prevCompletedCount = prevSummary?.completed_orders ?? null;
  const prevTotalCount = prevSummary?.total_orders ?? null;
  const prevCancelledCount = prevSummary?.cancelled_orders ?? null;
  const prevRejectedCount = prevSummary?.rejected_orders ?? null;
  const prevAovCents = prevSummary?.aov_cents ?? null;

  // Items sold query
  const { data: itemSalesData } = await admin
    .from('order_items')
    .select('quantity, orders!inner(branch_id, created_at, status)')
    .eq('orders.branch_id', primaryBranchId)
    .gte('orders.created_at', dateRange.startUtc)
    .lt('orders.created_at', dateRange.endUtc)
    .neq('orders.status', 'cancelled');

  const itemsSoldVal = (itemSalesData || []).reduce((acc: number, row: { quantity?: number }) => acc + (row.quantity || 0), 0);
  const avgItemsVal = completedCount > 0 ? Number((itemsSoldVal / completedCount).toFixed(2)) : 0;

  // 3. Time series & hourly buckets
  const { data: timeSeriesRes } = await admin.rpc('get_revenue_time_series', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
    p_interval: 'day',
  });

  const { data: hourlyRes } = await admin.rpc('get_orders_by_hour', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  // 4. Payment breakdown
  const { data: paymentRes } = await admin.rpc('get_payment_analytics', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  const rawPayments = (paymentRes as { breakdown?: RpcPaymentBreakdown[] })?.breakdown || [];
  const paymentBreakdown: BreakdownItemDTO[] = rawPayments.map((p) => ({
    key: p.payment_method,
    label: p.payment_method.toUpperCase(),
    value: hasFinancialAccess ? (p.total_cents || 0) : 0,
    subValue: p.transaction_count || 0,
    percentage: p.percentage || 0,
  }));

  const rawSeries = (timeSeriesRes as { series?: RpcTimeSeriesBucket[] })?.series || [];
  const timeSeriesPoints: TimeSeriesPointDTO[] = rawSeries.map((s) => ({
    period: s.bucket,
    value: hasFinancialAccess ? (s.gross_sales_cents || 0) : 0,
    ordersCount: s.orders_count || 0,
    paidRevenueCents: hasFinancialAccess ? (s.paid_revenue_cents || 0) : 0,
  }));

  const rawHours = (hourlyRes as { hours?: RpcOrdersByHourBucket[] })?.hours || [];
  const salesByHourPoints: TimeSeriesPointDTO[] = rawHours.map((h) => ({
    period: `Hour ${h.hour}`,
    value: hasFinancialAccess ? (h.revenue_cents || 0) : 0,
    ordersCount: h.orders_count || 0,
  }));

  const financialNote = hasFinancialAccess ? undefined : 'Redacted: Financial reporting permission required.';

  return {
    grossSales: {
      key: 'gross_sales',
      value: hasFinancialAccess ? grossSalesCents : null,
      unit: 'currency',
      currency,
      previousValue: hasFinancialAccess ? prevGrossSalesCents : null,
      ...(hasFinancialAccess ? computeMetricComparison(grossSalesCents, prevGrossSalesCents) : { absoluteChange: null, percentageChange: null }),
      quality: hasFinancialAccess ? 'COMPLETE' : 'UNAVAILABLE',
      qualityNote: financialNote,
    },
    netSales: {
      key: 'net_sales',
      value: hasFinancialAccess ? netSalesCents : null,
      unit: 'currency',
      currency,
      previousValue: hasFinancialAccess ? prevNetSalesCents : null,
      ...(hasFinancialAccess ? computeMetricComparison(netSalesCents, prevNetSalesCents) : { absoluteChange: null, percentageChange: null }),
      quality: hasFinancialAccess ? 'COMPLETE' : 'UNAVAILABLE',
      qualityNote: financialNote,
    },
    completedOrders: {
      key: 'completed_orders',
      value: completedCount,
      unit: 'count',
      previousValue: prevCompletedCount,
      ...computeMetricComparison(completedCount, prevCompletedCount),
      quality: 'COMPLETE',
    },
    placedOrders: {
      key: 'placed_orders',
      value: totalCount,
      unit: 'count',
      previousValue: prevTotalCount,
      ...computeMetricComparison(totalCount, prevTotalCount),
      quality: 'COMPLETE',
    },
    cancelledOrders: {
      key: 'cancelled_orders',
      value: cancelledCount,
      unit: 'count',
      previousValue: prevCancelledCount,
      ...computeMetricComparison(cancelledCount, prevCancelledCount),
      quality: 'COMPLETE',
    },
    rejectedOrders: {
      key: 'rejected_orders',
      value: rejectedCount,
      unit: 'count',
      previousValue: prevRejectedCount,
      ...computeMetricComparison(rejectedCount, prevRejectedCount),
      quality: 'COMPLETE',
    },
    aov: {
      key: 'aov',
      value: hasFinancialAccess ? aovCents : null,
      unit: 'currency',
      currency,
      previousValue: hasFinancialAccess ? prevAovCents : null,
      ...(hasFinancialAccess ? computeMetricComparison(aovCents, prevAovCents) : { absoluteChange: null, percentageChange: null }),
      quality: hasFinancialAccess ? 'COMPLETE' : 'UNAVAILABLE',
      qualityNote: financialNote,
    },
    itemsSold: {
      key: 'items_sold',
      value: itemsSoldVal,
      unit: 'count',
      quality: 'COMPLETE',
    },
    avgItemsPerOrder: {
      key: 'avg_items_per_order',
      value: avgItemsVal,
      unit: 'count',
      quality: 'COMPLETE',
    },
    salesByPaymentMethod: paymentBreakdown,
    salesByHour: salesByHourPoints,
    timeSeries: timeSeriesPoints,
  };
}

export interface GroupedSalesBranchMetrics {
  branchId: string;
  grossSalesCents: number | null;
  completedOrdersCount: number;
  aovCents: number | null;
}

/**
 * Grouped batched analytics retrieval across authorized target branches using DB-side aggregated RPCs.
 * Returns exactly targetBranchIds.length rows aggregated in Postgres.
 */
export async function getGroupedSalesByBranch(
  businessId: string,
  targetBranchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string,
  hasFinancialAccess: boolean = true
): Promise<Map<string, GroupedSalesBranchMetrics>> {
  const admin = createAdminClient();
  const map = new Map<string, GroupedSalesBranchMetrics>();

  if (!targetBranchIds || targetBranchIds.length === 0) return map;

  // 1. DB-side aggregated RPC (returns 1 row per branch)
  const { data: rpcRows, error: rpcErr } = await admin.rpc('get_grouped_branch_sales_summary', {
    p_business_id: businessId,
    p_branch_ids: targetBranchIds,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    for (const row of rpcRows) {
      const bId = row.branch_id;
      const gross = Number(row.gross_sales_cents || 0);
      const completedCount = Number(row.completed_orders_count || 0);
      const aov = Number(row.aov_cents || 0);

      map.set(bId, {
        branchId: bId,
        grossSalesCents: hasFinancialAccess ? gross : null,
        completedOrdersCount: completedCount,
        aovCents: hasFinancialAccess ? aov : null,
      });
    }
    return map;
  }

  // 2. Fallback query if RPC is not present
  const { data: orderRows, error } = await admin
    .from('orders')
    .select('branch_id, status, total_cents, payment_status')
    .in('branch_id', targetBranchIds)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc);

  if (error || !orderRows) {
    return map;
  }

  const branchAggs = new Map<string, { grossCents: number; completedCount: number }>();
  for (const bId of targetBranchIds) {
    branchAggs.set(bId, { grossCents: 0, completedCount: 0 });
  }

  for (const row of orderRows) {
    const agg = branchAggs.get(row.branch_id);
    if (!agg) continue;

    if (row.status === 'completed' || row.payment_status === 'paid') {
      agg.grossCents += row.total_cents || 0;
    }
    if (row.status === 'completed') {
      agg.completedCount += 1;
    }
  }

  for (const [bId, agg] of branchAggs.entries()) {
    const grossSalesCents = hasFinancialAccess ? agg.grossCents : null;
    const aovCents = hasFinancialAccess
      ? (agg.completedCount > 0 ? Math.round(agg.grossCents / agg.completedCount) : 0)
      : null;

    map.set(bId, {
      branchId: bId,
      grossSalesCents,
      completedOrdersCount: agg.completedCount,
      aovCents,
    });
  }

  return map;
}



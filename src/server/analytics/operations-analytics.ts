import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, AnalyticsError } from '@/lib/analytics/analytics-types';

export interface OperationsAnalyticsResult {
  avgOrderAcceptanceTime: MetricValueDTO;
  avgKitchenPreparationTime: MetricValueDTO;
  avgFulfillmentTime: MetricValueDTO;
  pendingOrderCount: MetricValueDTO;
  completionRate: MetricValueDTO;
  cancellationRate: MetricValueDTO;
  rejectionRate: MetricValueDTO;
}

/**
 * Server data engine for operational speed, kitchen performance, queue depth, and completion rates.
 */
export async function getOperationsAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange
): Promise<OperationsAnalyticsResult> {
  const admin = createAdminClient();
  const primaryBranchId = branchIds[0];

  if (!primaryBranchId) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for operations analytics.');
  }

  // 1. Fetch Kitchen Performance RPC
  const { data: kitchenRes } = await admin.rpc('get_kitchen_analytics', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  // 2. Fetch Sales Summary for Order Status Counts
  const { data: summaryRes } = await admin.rpc('get_branch_sales_summary', {
    p_branch_id: primaryBranchId,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  const totalOrders = summaryRes?.total_orders || 0;
  const completedOrders = summaryRes?.completed_orders || 0;
  const cancelledOrders = summaryRes?.cancelled_orders || 0;
  const pendingOrders = summaryRes?.pending_orders || 0;

  // Rejection count
  const { count: rejectedCount } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', primaryBranchId)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc)
    .eq('status', 'rejected');

  const rejectedOrdersVal = rejectedCount || 0;

  // Rate calculations with 0-denominator safety
  const completionRateVal = totalOrders > 0 ? Number(((completedOrders / totalOrders) * 100).toFixed(2)) : 0;
  const cancellationRateVal = totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(2)) : 0;
  const rejectionRateVal = totalOrders > 0 ? Number(((rejectedOrdersVal / totalOrders) * 100).toFixed(2)) : 0;

  // Active Pending Queue Count (snapshot across active branch orders)
  const { count: livePendingCount } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', primaryBranchId)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready']);

  const avgAcceptanceSecs = kitchenRes?.avg_confirmation_seconds || 0;
  const avgPrepSecs = kitchenRes?.avg_preparation_seconds || 0;
  const avgFulfillmentSecs = avgAcceptanceSecs + avgPrepSecs + (kitchenRes?.avg_ready_seconds || 0);

  return {
    avgOrderAcceptanceTime: {
      key: 'avg_order_acceptance_time',
      value: avgAcceptanceSecs,
      unit: 'duration',
      quality: 'COMPLETE',
    },
    avgKitchenPreparationTime: {
      key: 'avg_kitchen_preparation_time',
      value: avgPrepSecs,
      unit: 'duration',
      quality: 'COMPLETE',
    },
    avgFulfillmentTime: {
      key: 'avg_fulfillment_time',
      value: avgFulfillmentSecs,
      unit: 'duration',
      quality: 'COMPLETE',
    },
    pendingOrderCount: {
      key: 'pending_order_count',
      value: livePendingCount !== null ? livePendingCount : pendingOrders,
      unit: 'count',
      quality: 'COMPLETE',
    },
    completionRate: {
      key: 'completion_rate',
      value: completionRateVal,
      unit: 'percentage',
      quality: 'COMPLETE',
    },
    cancellationRate: {
      key: 'cancellation_rate',
      value: cancellationRateVal,
      unit: 'percentage',
      quality: 'COMPLETE',
    },
    rejectionRate: {
      key: 'rejection_rate',
      value: rejectionRateVal,
      unit: 'percentage',
      quality: 'COMPLETE',
    },
  };
}

import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, BreakdownItemDTO, AnalyticsError } from '@/lib/analytics/analytics-types';
import { computeMetricComparison } from '@/lib/analytics/time-range';

export interface DailyCancellationTrendDTO {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Sep 10"
  totalOrders: number;
  cancelledOrders: number;
  cancellationRate: number; // 0 - 100
  cancelledValueCents: number | null;
}

export interface CancellationBreakdownItemDTO {
  key: string;
  label: string;
  count: number;
  percentage: number;
  valueCents: number | null;
}

export interface CancellationFinancialImpactDTO {
  cancelledOrderValueCents: number | null;
  cancelledItemValueCents: number | null;
  totalRefundedCents: number | null;
  totalWasteCostCents: number | null;
  estimatedFinancialLossCents: number | null;
}

export interface CancellationAnalyticsResult {
  totalOrders: number;
  cancelledOrders: number;
  cancellationRate: number; // percentage (0 - 100)
  dailyTrend: DailyCancellationTrendDTO[];
  actorBreakdown: CancellationBreakdownItemDTO[];
  stageBreakdown: CancellationBreakdownItemDTO[];
  reasonBreakdown: CancellationBreakdownItemDTO[];
  financialImpact: CancellationFinancialImpactDTO;
  summary: {
    cancelledOrdersMetric: MetricValueDTO;
    cancellationRateMetric: MetricValueDTO;
    financialLossMetric: MetricValueDTO;
  };
  currency: string;
  hasFinancialAccess: boolean;
}

interface OrderRow {
  id: string;
  branch_id: string;
  status: string;
  total_cents: number;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_eligibility: string | null;
  payment_status: string | null;
}

interface OrderCancellationRow {
  id: string;
  order_id: string;
  branch_id: string;
  cancellation_scope: string;
  channel: string;
  requested_by_type: string;
  reason_category: string;
  reason_notes: string | null;
  approval_status: string;
  inventory_disposition: string;
  refund_required: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface OrderCancellationItemRow {
  id: string;
  cancellation_id: string;
  quantity_cancelled: number;
  line_subtotal_cancelled_cents: number;
  inventory_disposition: string;
  cost_cents_reversed: number;
}

interface WasteRecordRow {
  id: string;
  total_cost_cents: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

interface RefundEventRow {
  id: string;
  order_id: string;
  amount_cents: number;
  created_at: string;
}

interface StatusHistoryRow {
  order_id: string;
  previous_status: string;
  new_status: string;
  created_at: string;
}

/**
 * Normalizes actor key into a user-friendly label.
 */
function resolveActorDetails(row: OrderCancellationRow): { key: string; label: string } {
  if (row.requested_by_type === 'customer') {
    return { key: 'customer', label: 'Customer (Self-service QR)' };
  }
  if (row.channel === 'waiter_menu') {
    return { key: 'waiter', label: 'Waiter / Floor Staff' };
  }
  if (row.channel === 'kitchen_kds') {
    return { key: 'kitchen', label: 'Kitchen (KDS)' };
  }
  if (row.channel === 'cashier_pos') {
    return { key: 'cashier', label: 'Cashier (Counter POS)' };
  }
  if (row.channel === 'manager_workflow') {
    return { key: 'manager', label: 'Manager Workflow' };
  }
  if (row.requested_by_type === 'system') {
    return { key: 'system', label: 'System / Automated' };
  }
  if (row.requested_by_type === 'staff') {
    return { key: 'staff', label: 'Staff Member' };
  }
  return { key: 'other', label: 'Other' };
}

/**
 * Normalizes stage key into a user-friendly label.
 */
function resolveStageDetails(stageKey: string): { key: string; label: string } {
  switch (stageKey) {
    case 'pending':
      return { key: 'pending', label: 'Pending Confirmation' };
    case 'confirmed':
      return { key: 'confirmed', label: 'Confirmed (Pre-Prep)' };
    case 'preparing':
      return { key: 'preparing', label: 'In Kitchen Preparation' };
    case 'ready':
      return { key: 'ready', label: 'Ready for Service / Pickup' };
    case 'delivered':
    case 'completed':
      return { key: 'delivered', label: 'Served / Delivered' };
    default:
      return { key: 'pre_prep', label: 'Pre-Preparation' };
  }
}

/**
 * Normalizes reason category into a user-friendly label.
 */
function resolveReasonDetails(category: string): { key: string; label: string } {
  switch (category) {
    case 'customer_request':
    case 'guest_request':
      return { key: 'customer_request', label: 'Customer Changed Mind' };
    case 'kitchen_out_of_stock':
    case 'out_of_stock':
      return { key: 'out_of_stock', label: 'Item Out of Stock' };
    case 'kitchen_delay':
    case 'delay':
      return { key: 'kitchen_delay', label: 'Long Wait / Kitchen Delay' };
    case 'order_mistake':
    case 'accidental_order':
      return { key: 'order_mistake', label: 'Accidental / Wrong Order' };
    case 'payment_failed':
    case 'payment_issue':
      return { key: 'payment_failed', label: 'Payment Problem' };
    case 'duplicate_order':
      return { key: 'duplicate_order', label: 'Duplicate Order' };
    default:
      return { key: 'other', label: category ? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other / Unspecified' };
  }
}

/**
 * Server analytics engine for Order Cancellations, Refunds, and Waste Cost impact.
 */
export async function getCancellationAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange,
  currency: string,
  hasFinancialAccess: boolean = true
): Promise<CancellationAnalyticsResult> {
  const admin = createAdminClient();

  if (!branchIds || branchIds.length === 0) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for cancellation analytics.');
  }

  // 1. Fetch primary data in parallel
  const [ordersRes, cancellationsRes, itemsRes, wasteRes, refundsRes, historyRes] = await Promise.all([
    // All orders in current period
    admin
      .from('orders')
      .select('id, branch_id, status, total_cents, created_at, cancelled_at, cancellation_reason, refund_eligibility, payment_status')
      .eq('business_id', businessId)
      .in('branch_id', branchIds)
      .gte('created_at', dateRange.startUtc)
      .lt('created_at', dateRange.endUtc),

    // All formal cancellation records in current period
    admin
      .from('order_cancellations')
      .select('id, order_id, branch_id, cancellation_scope, channel, requested_by_type, reason_category, reason_notes, approval_status, inventory_disposition, refund_required, metadata, created_at')
      .eq('business_id', businessId)
      .in('branch_id', branchIds)
      .gte('created_at', dateRange.startUtc)
      .lt('created_at', dateRange.endUtc),

    // Cancellation items in current period
    admin
      .from('order_cancellation_items')
      .select(`
        id,
        cancellation_id,
        quantity_cancelled,
        line_subtotal_cancelled_cents,
        inventory_disposition,
        cost_cents_reversed,
        order_cancellations!inner (
          business_id,
          branch_id,
          created_at
        )
      `)
      .eq('order_cancellations.business_id', businessId)
      .in('order_cancellations.branch_id', branchIds)
      .gte('order_cancellations.created_at', dateRange.startUtc)
      .lt('order_cancellations.created_at', dateRange.endUtc),

    // Waste records attributable to cancellations
    admin
      .from('inventory_waste_records')
      .select('id, total_cost_cents, reason, notes, created_at')
      .eq('business_id', businessId)
      .in('branch_id', branchIds)
      .or('reason.ilike.%cancellation%,notes.ilike.%cancellation%')
      .gte('created_at', dateRange.startUtc)
      .lt('created_at', dateRange.endUtc),

    // Refunds issued in current period
    admin
      .from('payment_events')
      .select('id, order_id, amount_cents, created_at, orders!inner(business_id, branch_id)')
      .eq('orders.business_id', businessId)
      .in('orders.branch_id', branchIds)
      .eq('event_type', 'refund_issued')
      .gte('created_at', dateRange.startUtc)
      .lt('created_at', dateRange.endUtc),

    // Status history for cancelled orders
    admin
      .from('order_status_history')
      .select('order_id, previous_status, new_status, created_at')
      .eq('new_status', 'cancelled')
      .gte('created_at', dateRange.startUtc)
      .lt('created_at', dateRange.endUtc),
  ]);

  if (ordersRes.error) {
    throw new AnalyticsError('DATABASE_ERROR', `Failed to query orders for cancellation analytics: ${ordersRes.error.message}`);
  }

  const allOrders: OrderRow[] = (ordersRes.data as OrderRow[]) || [];
  const cancellationRecords: OrderCancellationRow[] = (cancellationsRes.data as OrderCancellationRow[]) || [];
  const cancellationItems: OrderCancellationItemRow[] = (itemsRes.data as unknown as OrderCancellationItemRow[]) || [];
  const wasteRecords: WasteRecordRow[] = (wasteRes.data as WasteRecordRow[]) || [];
  const refundEvents: RefundEventRow[] = (refundsRes.data as RefundEventRow[]) || [];
  const statusHistory: StatusHistoryRow[] = (historyRes.data as StatusHistoryRow[]) || [];

  // Map order history by order_id
  const historyByOrderId = new Map<string, string>();
  for (const h of statusHistory) {
    if (h.previous_status && !historyByOrderId.has(h.order_id)) {
      historyByOrderId.set(h.order_id, h.previous_status);
    }
  }

  // 2. Compute Core Counts & Rates
  const totalOrdersCount = allOrders.length;
  const cancelledOrdersList = allOrders.filter((o) => o.status === 'cancelled');
  const cancelledOrdersCount = cancelledOrdersList.length;
  const cancellationRateVal = totalOrdersCount > 0
    ? Number(((cancelledOrdersCount / totalOrdersCount) * 100).toFixed(1))
    : 0;

  // 3. Compute Financials
  const cancelledOrderValueCents = cancelledOrdersList.reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const cancelledItemValueCents = cancellationItems.reduce((sum, item) => sum + (item.line_subtotal_cancelled_cents || 0), 0);
  const totalRefundedCents = refundEvents.reduce((sum, r) => sum + (r.amount_cents || 0), 0);
  const totalWasteCostCents = wasteRecords.reduce((sum, w) => sum + (w.total_cost_cents || 0), 0);
  const estimatedLossCents = totalRefundedCents + totalWasteCostCents;

  // 4. Compute Daily Trend
  // Construct daily buckets across [startUtc, endUtc)
  const startTime = new Date(dateRange.startUtc).getTime();
  const endTime = new Date(dateRange.endUtc).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  // Group orders by local date YYYY-MM-DD
  const dailyBuckets = new Map<string, { total: number; cancelled: number; valueCents: number }>();

  // Helper date formatter in branch timezone
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: dateRange.timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const displayDateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: dateRange.timezone || 'UTC',
    month: 'short',
    day: 'numeric',
  });

  // Pre-populate daily buckets so zero-cancellation days are still represented
  for (let t = startTime; t < endTime; t += msPerDay) {
    const curDate = new Date(t);
    const key = dateFmt.format(curDate);
    if (!dailyBuckets.has(key)) {
      dailyBuckets.set(key, { total: 0, cancelled: 0, valueCents: 0 });
    }
  }

  // Populate order counts into daily buckets
  for (const o of allOrders) {
    const oDate = new Date(o.created_at);
    const key = dateFmt.format(oDate);
    const bucket = dailyBuckets.get(key) || { total: 0, cancelled: 0, valueCents: 0 };
    bucket.total += 1;
    if (o.status === 'cancelled') {
      bucket.cancelled += 1;
      bucket.valueCents += o.total_cents || 0;
    }
    dailyBuckets.set(key, bucket);
  }

  const dailyTrend: DailyCancellationTrendDTO[] = Array.from(dailyBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, stats]) => {
      // Parse YYYY-MM-DD to display string
      const [y, m, d] = dateKey.split('-').map(Number);
      const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const formattedDate = displayDateFmt.format(utcDate);
      const rate = stats.total > 0 ? Number(((stats.cancelled / stats.total) * 100).toFixed(1)) : 0;

      return {
        date: dateKey,
        formattedDate,
        totalOrders: stats.total,
        cancelledOrders: stats.cancelled,
        cancellationRate: rate,
        cancelledValueCents: hasFinancialAccess ? stats.valueCents : null,
      };
    });

  // 5. Compute Actor Breakdown
  const actorMap = new Map<string, { label: string; count: number; valueCents: number }>();

  // Map cancellation records
  const orderIdsWithRecord = new Set<string>();

  for (const cr of cancellationRecords) {
    orderIdsWithRecord.add(cr.order_id);
    const actor = resolveActorDetails(cr);
    const entry = actorMap.get(actor.key) || { label: actor.label, count: 0, valueCents: 0 };
    entry.count += 1;

    const matchedOrder = allOrders.find((o) => o.id === cr.order_id);
    if (matchedOrder) {
      entry.valueCents += matchedOrder.total_cents || 0;
    }
    actorMap.set(actor.key, entry);
  }

  // If there are cancelled orders without explicit order_cancellations record, bucket as 'other'
  for (const o of cancelledOrdersList) {
    if (!orderIdsWithRecord.has(o.id)) {
      const entry = actorMap.get('other') || { label: 'Other Staff / POS', count: 0, valueCents: 0 };
      entry.count += 1;
      entry.valueCents += o.total_cents || 0;
      actorMap.set('other', entry);
    }
  }

  const totalCancellations = cancelledOrdersCount;

  const actorBreakdown: CancellationBreakdownItemDTO[] = Array.from(actorMap.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      percentage: totalCancellations > 0 ? Number(((data.count / totalCancellations) * 100).toFixed(1)) : 0,
      valueCents: hasFinancialAccess ? data.valueCents : null,
    }))
    .sort((a, b) => b.count - a.count);

  // 6. Compute Stage Breakdown
  const stageMap = new Map<string, { label: string; count: number; valueCents: number }>();

  for (const cr of cancellationRecords) {
    const metaStage = cr.metadata && typeof cr.metadata.previous_status === 'string'
      ? cr.metadata.previous_status
      : historyByOrderId.get(cr.order_id) || 'pending';

    const stage = resolveStageDetails(metaStage);
    const entry = stageMap.get(stage.key) || { label: stage.label, count: 0, valueCents: 0 };
    entry.count += 1;

    const matchedOrder = allOrders.find((o) => o.id === cr.order_id);
    if (matchedOrder) {
      entry.valueCents += matchedOrder.total_cents || 0;
    }
    stageMap.set(stage.key, entry);
  }

  // Handle cancelled orders without explicit cancellation record
  for (const o of cancelledOrdersList) {
    if (!orderIdsWithRecord.has(o.id)) {
      const histStage = historyByOrderId.get(o.id) || 'pending';
      const stage = resolveStageDetails(histStage);
      const entry = stageMap.get(stage.key) || { label: stage.label, count: 0, valueCents: 0 };
      entry.count += 1;
      entry.valueCents += o.total_cents || 0;
      stageMap.set(stage.key, entry);
    }
  }

  const stageBreakdown: CancellationBreakdownItemDTO[] = Array.from(stageMap.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      percentage: totalCancellations > 0 ? Number(((data.count / totalCancellations) * 100).toFixed(1)) : 0,
      valueCents: hasFinancialAccess ? data.valueCents : null,
    }))
    .sort((a, b) => b.count - a.count);

  // 7. Compute Reason Breakdown
  const reasonMap = new Map<string, { label: string; count: number; valueCents: number }>();

  for (const cr of cancellationRecords) {
    const reason = resolveReasonDetails(cr.reason_category);
    const entry = reasonMap.get(reason.key) || { label: reason.label, count: 0, valueCents: 0 };
    entry.count += 1;

    const matchedOrder = allOrders.find((o) => o.id === cr.order_id);
    if (matchedOrder) {
      entry.valueCents += matchedOrder.total_cents || 0;
    }
    reasonMap.set(reason.key, entry);
  }

  // Fallback for orders without cancellation record
  for (const o of cancelledOrdersList) {
    if (!orderIdsWithRecord.has(o.id)) {
      const reasonCategory = o.cancellation_reason || 'other';
      const reason = resolveReasonDetails(reasonCategory);
      const entry = reasonMap.get(reason.key) || { label: reason.label, count: 0, valueCents: 0 };
      entry.count += 1;
      entry.valueCents += o.total_cents || 0;
      reasonMap.set(reason.key, entry);
    }
  }

  const reasonBreakdown: CancellationBreakdownItemDTO[] = Array.from(reasonMap.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      percentage: totalCancellations > 0 ? Number(((data.count / totalCancellations) * 100).toFixed(1)) : 0,
      valueCents: hasFinancialAccess ? data.valueCents : null,
    }))
    .sort((a, b) => b.count - a.count);

  // 8. Previous Period Comparison (if present)
  let prevCancelledCount: number | null = null;
  let prevTotalCount: number | null = null;
  let prevRate: number | null = null;

  if (dateRange.previousRange) {
    const { count: prevTotal } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('branch_id', branchIds)
      .gte('created_at', dateRange.previousRange.startUtc)
      .lt('created_at', dateRange.previousRange.endUtc);

    const { count: prevCancelled } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('branch_id', branchIds)
      .eq('status', 'cancelled')
      .gte('created_at', dateRange.previousRange.startUtc)
      .lt('created_at', dateRange.previousRange.endUtc);

    prevTotalCount = prevTotal ?? null;
    prevCancelledCount = prevCancelled ?? null;
    if (prevTotalCount && prevTotalCount > 0 && prevCancelledCount !== null) {
      prevRate = Number(((prevCancelledCount / prevTotalCount) * 100).toFixed(1));
    }
  }

  const financialNote = hasFinancialAccess ? undefined : 'Redacted: Financial reporting permission required.';

  return {
    totalOrders: totalOrdersCount,
    cancelledOrders: cancelledOrdersCount,
    cancellationRate: cancellationRateVal,
    dailyTrend,
    actorBreakdown,
    stageBreakdown,
    reasonBreakdown,
    financialImpact: {
      cancelledOrderValueCents: hasFinancialAccess ? cancelledOrderValueCents : null,
      cancelledItemValueCents: hasFinancialAccess ? cancelledItemValueCents : null,
      totalRefundedCents: hasFinancialAccess ? totalRefundedCents : null,
      totalWasteCostCents: hasFinancialAccess ? totalWasteCostCents : null,
      estimatedFinancialLossCents: hasFinancialAccess ? estimatedLossCents : null,
    },
    summary: {
      cancelledOrdersMetric: {
        key: 'cancelled_orders',
        value: cancelledOrdersCount,
        unit: 'count',
        previousValue: prevCancelledCount,
        ...computeMetricComparison(cancelledOrdersCount, prevCancelledCount),
        quality: 'COMPLETE',
      },
      cancellationRateMetric: {
        key: 'cancellation_rate',
        value: cancellationRateVal,
        unit: 'percentage',
        previousValue: prevRate,
        ...computeMetricComparison(cancellationRateVal, prevRate),
        quality: 'COMPLETE',
      },
      financialLossMetric: {
        key: 'waste_cost_cents',
        value: hasFinancialAccess ? estimatedLossCents : null,
        unit: 'currency',
        currency,
        quality: hasFinancialAccess ? 'COMPLETE' : 'UNAVAILABLE',
        qualityNote: financialNote,
      },
    },
    currency,
    hasFinancialAccess,
  };
}

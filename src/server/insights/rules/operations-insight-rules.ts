import { OperationalInsightDTO, InsightSeverity } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_THRESHOLDS } from '@/lib/insights/insight-thresholds';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';

export function evaluateOperationsInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, sales, operations } = dto;

  // A. Kitchen Prep Time Deterioration
  const prepMetric = operations.avgKitchenPreparationTime;
  const placedMetric = sales.placedOrders;
  const orderCount = placedMetric?.value ?? 0;

  if (
    prepMetric &&
    prepMetric.quality !== 'UNAVAILABLE' &&
    prepMetric.value !== null &&
    orderCount >= INSIGHT_THRESHOLDS.OPERATIONS.MIN_ORDER_SAMPLE_SIZE
  ) {
    const prepMinutes = Number((prepMetric.value / 60).toFixed(1));
    const prevPrepMinutes = (prepMetric.previousValue !== undefined && prepMetric.previousValue !== null)
      ? Number((prepMetric.previousValue / 60).toFixed(1))
      : null;

    if (prepMinutes >= INSIGHT_THRESHOLDS.OPERATIONS.PREP_TIME_WARNING_MINUTES) {
      const severity: InsightSeverity =
        prepMinutes >= INSIGHT_THRESHOLDS.OPERATIONS.PREP_TIME_CRITICAL_MINUTES ? 'CRITICAL' : 'WARNING';

      insights.push({
        id: `ops-prep-time-${summary.tenantId}`,
        ruleKey: 'ops.prep_time_deterioration',
        fingerprint: `ops.prep_time_deterioration:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'OPERATIONS',
        severity,
        title: `Kitchen Prep Time Averaging ${prepMinutes} Minutes`,
        summary: `Kitchen ticket preparation speed averaged ${prepMinutes} min across ${orderCount} orders analyzed.`,
        metricKeys: ['avg_kitchen_preparation_time', 'placed_orders'],
        evidence: [
          {
            label: 'Avg Prep Time',
            currentValue: `${prepMinutes} min`,
            previousValue: prevPrepMinutes !== null ? `${prevPrepMinutes} min` : undefined,
            sampleSize: orderCount,
            quality: prepMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['ops.prep_time_deterioration'].recommendationTemplate,
        detectedAt,
        dataQuality: prepMetric.quality,
        status: 'ACTIVE',
      });
    }
  }

  // B. Low Completion Rate
  const completionMetric = operations.completionRate;
  if (
    completionMetric &&
    completionMetric.quality !== 'UNAVAILABLE' &&
    completionMetric.value !== null &&
    orderCount >= INSIGHT_THRESHOLDS.OPERATIONS.MIN_ORDER_SAMPLE_SIZE
  ) {
    const rate = completionMetric.value;
    if (rate <= INSIGHT_THRESHOLDS.OPERATIONS.COMPLETION_RATE_WARNING_PERCENT) {
      const severity: InsightSeverity =
        rate <= INSIGHT_THRESHOLDS.OPERATIONS.COMPLETION_RATE_CRITICAL_PERCENT ? 'CRITICAL' : 'WARNING';

      insights.push({
        id: `ops-completion-rate-${summary.tenantId}`,
        ruleKey: 'ops.low_completion_rate',
        fingerprint: `ops.low_completion_rate:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'OPERATIONS',
        severity,
        title: `Order Completion Rate Dropped to ${rate.toFixed(1)}%`,
        summary: `Only ${rate.toFixed(1)}% of placed orders were completed successfully during this period.`,
        metricKeys: ['completion_rate', 'placed_orders'],
        evidence: [
          {
            label: 'Completion Rate',
            currentValue: `${rate.toFixed(1)}%`,
            sampleSize: orderCount,
            quality: completionMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['ops.low_completion_rate'].recommendationTemplate,
        detectedAt,
        dataQuality: completionMetric.quality,
        status: 'ACTIVE',
      });
    }
  }

  // C. High Pending Order Backlog
  const pendingMetric = operations.pendingOrderCount;
  if (
    pendingMetric &&
    pendingMetric.quality !== 'UNAVAILABLE' &&
    pendingMetric.value !== null &&
    pendingMetric.value >= INSIGHT_THRESHOLDS.OPERATIONS.PENDING_QUEUE_WARNING_COUNT
  ) {
    insights.push({
      id: `ops-pending-queue-${summary.tenantId}`,
      ruleKey: 'ops.high_pending_queue',
      fingerprint: `ops.high_pending_queue:${summary.tenantId}`,
      category: 'OPERATIONS',
      severity: 'WARNING',
      title: `High Pending Queue Backlog (${pendingMetric.value} Orders)`,
      summary: `There are currently ${pendingMetric.value} active pending tickets waiting in the kitchen/fulfillment queue.`,
      metricKeys: ['pending_order_count'],
      evidence: [
        {
          label: 'Pending Order Backlog',
          currentValue: `${pendingMetric.value} orders`,
          quality: pendingMetric.quality,
        },
      ],
      recommendation: INSIGHT_RULES['ops.high_pending_queue'].recommendationTemplate,
      detectedAt,
      dataQuality: pendingMetric.quality,
      status: 'ACTIVE',
    });
  }

  return insights;
}

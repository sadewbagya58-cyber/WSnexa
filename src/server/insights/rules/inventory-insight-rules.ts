import { OperationalInsightDTO } from '@/lib/insights/insight-types';

import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_THRESHOLDS } from '@/lib/insights/insight-thresholds';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';
import { formatCurrency } from '@/features/cart/cart-calculations';

export function evaluateInventoryInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, inventory } = dto;
  const currency = summary.currency;

  // A. Out of Stock Critical Alert
  const outOfStockMetric = inventory.outOfStockItemCount;
  if (
    outOfStockMetric &&
    outOfStockMetric.quality !== 'UNAVAILABLE' &&
    outOfStockMetric.value !== null &&
    outOfStockMetric.value >= INSIGHT_THRESHOLDS.INVENTORY.OUT_OF_STOCK_CRITICAL_COUNT
  ) {
    insights.push({
      id: `inv-out-of-stock-${summary.tenantId}`,
      ruleKey: 'inventory.out_of_stock_critical',
      fingerprint: `inventory.out_of_stock_critical:${summary.tenantId}`,
      category: 'INVENTORY',
      severity: 'CRITICAL',
      title: `Critical Stockout (${outOfStockMetric.value} Items Depleted)`,
      summary: `There are currently ${outOfStockMetric.value} active catalog items completely out of stock.`,
      metricKeys: ['out_of_stock_item_count'],
      evidence: [
        {
          label: 'Out of Stock Count',
          currentValue: `${outOfStockMetric.value} items`,
          quality: outOfStockMetric.quality,
        },
      ],
      recommendation: INSIGHT_RULES['inventory.out_of_stock_critical'].recommendationTemplate,
      detectedAt,
      dataQuality: outOfStockMetric.quality,
      status: 'ACTIVE',
    });
  }

  // B. Low Stock Warning Alert
  const lowStockMetric = inventory.lowStockItemCount;
  if (
    lowStockMetric &&
    lowStockMetric.quality !== 'UNAVAILABLE' &&
    lowStockMetric.value !== null &&
    lowStockMetric.value >= INSIGHT_THRESHOLDS.INVENTORY.LOW_STOCK_WARNING_COUNT
  ) {
    insights.push({
      id: `inv-low-stock-${summary.tenantId}`,
      ruleKey: 'inventory.low_stock_warning',
      fingerprint: `inventory.low_stock_warning:${summary.tenantId}`,
      category: 'INVENTORY',
      severity: 'WARNING',
      title: `Low Stock Level Warning (${lowStockMetric.value} Items Low)`,
      summary: `${lowStockMetric.value} inventory items are below minimum reorder thresholds.`,
      metricKeys: ['low_stock_item_count'],
      evidence: [
        {
          label: 'Low Stock Count',
          currentValue: `${lowStockMetric.value} items`,
          quality: lowStockMetric.quality,
        },
      ],
      recommendation: INSIGHT_RULES['inventory.low_stock_warning'].recommendationTemplate,
      detectedAt,
      dataQuality: lowStockMetric.quality,
      status: 'ACTIVE',
    });
  }

  // C. Ingredient Waste Cost (Server-gated by financial permission)
  const wasteCostMetric = inventory.wasteCostCents;
  if (
    summary.hasFinancialAccess &&
    wasteCostMetric &&
    wasteCostMetric.quality !== 'UNAVAILABLE' &&
    wasteCostMetric.value !== null &&
    wasteCostMetric.value > 0
  ) {
    const wasteCents = wasteCostMetric.value;
    insights.push({
      id: `inv-waste-cost-${summary.tenantId}`,
      ruleKey: 'inventory.high_waste',
      fingerprint: `inventory.high_waste:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
      category: 'INVENTORY',
      severity: 'WARNING',
      title: `Recorded Ingredient Waste: ${formatCurrency(wasteCents, currency)}`,
      summary: `Ingredient waste cost reached ${formatCurrency(wasteCents, currency)} for the selected date range.`,
      metricKeys: ['waste_cost_cents'],
      evidence: [
        {
          label: 'Total Waste Cost',
          currentValue: formatCurrency(wasteCents, currency),
          quality: wasteCostMetric.quality,
        },
      ],
      recommendation: INSIGHT_RULES['inventory.high_waste'].recommendationTemplate,
      detectedAt,
      dataQuality: wasteCostMetric.quality,
      status: 'ACTIVE',
    });
  }

  return insights;
}

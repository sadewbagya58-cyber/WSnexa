import { OperationalInsightDTO, InsightSeverity } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_THRESHOLDS } from '@/lib/insights/insight-thresholds';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';
import { formatCurrency } from '@/features/cart/cart-calculations';

export function evaluateSalesInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, sales } = dto;
  const currency = summary.currency;

  if (!summary.hasFinancialAccess) {
    return insights;
  }

  // A. Gross Sales Growth / Decline
  const grossSalesMetric = sales.grossSales;
  if (
    grossSalesMetric &&
    grossSalesMetric.quality !== 'UNAVAILABLE' &&
    grossSalesMetric.value !== null &&
    grossSalesMetric.value !== undefined &&
    grossSalesMetric.previousValue !== null &&
    grossSalesMetric.previousValue !== undefined &&
    grossSalesMetric.percentageChange !== undefined &&
    grossSalesMetric.percentageChange !== null
  ) {
    const pct = grossSalesMetric.percentageChange;
    const currentCents = grossSalesMetric.value;
    const prevCents = grossSalesMetric.previousValue;

    if (pct <= -INSIGHT_THRESHOLDS.SALES.DECLINE_WARNING_PERCENT) {
      const severity: InsightSeverity =
        pct <= -INSIGHT_THRESHOLDS.SALES.DECLINE_CRITICAL_PERCENT ? 'CRITICAL' : 'WARNING';
      const absPct = Math.abs(pct);

      insights.push({
        id: `sales-decline-${summary.tenantId}`,
        ruleKey: 'sales.decline',
        fingerprint: `sales.decline:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'SALES',
        severity,
        title: `Gross Sales Decreased by ${absPct.toFixed(1)}%`,
        summary: `Period gross sales contracted from ${formatCurrency(prevCents, currency)} to ${formatCurrency(currentCents, currency)}.`,
        metricKeys: ['gross_sales'],
        evidence: [
          {
            label: 'Current Gross Sales',
            currentValue: formatCurrency(currentCents, currency),
            previousValue: formatCurrency(prevCents, currency),
            changeFormatted: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
            quality: grossSalesMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['sales.decline'].recommendationTemplate,
        detectedAt,
        dataQuality: grossSalesMetric.quality,
        status: 'ACTIVE',
      });
    } else if (pct >= INSIGHT_THRESHOLDS.SALES.GROWTH_SUCCESS_PERCENT) {
      insights.push({
        id: `sales-growth-${summary.tenantId}`,
        ruleKey: 'sales.growth',
        fingerprint: `sales.growth:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'SALES',
        severity: 'SUCCESS',
        title: `Gross Sales Increased by ${pct.toFixed(1)}%`,
        summary: `Gross sales grew to ${formatCurrency(currentCents, currency)} compared with ${formatCurrency(prevCents, currency)} in the prior period.`,
        metricKeys: ['gross_sales'],
        evidence: [
          {
            label: 'Current Gross Sales',
            currentValue: formatCurrency(currentCents, currency),
            previousValue: formatCurrency(prevCents, currency),
            changeFormatted: `+${pct.toFixed(1)}%`,
            quality: grossSalesMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['sales.growth'].recommendationTemplate,
        detectedAt,
        dataQuality: grossSalesMetric.quality,
        status: 'ACTIVE',
      });
    }
  }

  // B. Average Order Value (AOV) Decline
  const aovMetric = sales.aov;
  if (
    aovMetric &&
    aovMetric.quality !== 'UNAVAILABLE' &&
    aovMetric.value !== null &&
    aovMetric.value !== undefined &&
    aovMetric.previousValue !== null &&
    aovMetric.previousValue !== undefined &&
    aovMetric.percentageChange !== undefined &&
    aovMetric.percentageChange !== null
  ) {
    const pct = aovMetric.percentageChange;
    const currentAov = aovMetric.value;
    const prevAov = aovMetric.previousValue;

    if (pct <= -INSIGHT_THRESHOLDS.SALES.AOV_DECLINE_PERCENT) {
      const absPct = Math.abs(pct);
      insights.push({
        id: `sales-aov-decline-${summary.tenantId}`,
        ruleKey: 'sales.aov_decline',
        fingerprint: `sales.aov_decline:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'SALES',
        severity: 'WARNING',
        title: `Average Order Value Contracted ${absPct.toFixed(1)}%`,
        summary: `Average basket size fell to ${formatCurrency(currentAov, currency)} per order from ${formatCurrency(prevAov, currency)}.`,
        metricKeys: ['aov'],
        evidence: [
          {
            label: 'Average Order Value (AOV)',
            currentValue: formatCurrency(currentAov, currency),
            previousValue: formatCurrency(prevAov, currency),
            changeFormatted: `${pct.toFixed(1)}%`,
            quality: aovMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['sales.aov_decline'].recommendationTemplate,
        detectedAt,
        dataQuality: aovMetric.quality,
        status: 'ACTIVE',
      });
    }
  }

  return insights;
}

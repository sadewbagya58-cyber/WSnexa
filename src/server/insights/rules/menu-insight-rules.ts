import { OperationalInsightDTO } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';
import { formatCurrency } from '@/features/cart/cart-calculations';

export function evaluateMenuInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, menu } = dto;
  const currency = summary.currency;

  const topItems = menu.topSellingItems || [];
  if (topItems.length > 0) {
    const top = topItems[0];
    const itemQty = top.quantitySold;
    const itemRevCents = top.revenueCents ?? 0;

    if (itemQty >= 5) {
      const summaryText = summary.hasFinancialAccess
        ? `Top seller "${top.itemName}" generated ${itemQty} sales (${formatCurrency(itemRevCents, currency)}).`
        : `Top seller "${top.itemName}" generated ${itemQty} item sales during this period.`;

      insights.push({
        id: `menu-top-item-${summary.tenantId}`,
        ruleKey: 'menu.top_performer',
        fingerprint: `menu.top_performer:${summary.tenantId}:${summary.resolvedDateRange.preset}:${encodeURIComponent(top.itemName)}`,
        category: 'MENU',
        severity: 'INFO',
        title: `Leading Item: "${top.itemName}" (${itemQty} Sold)`,
        summary: summaryText,
        metricKeys: ['quantity_sold_by_item'],
        evidence: [
          {
            label: 'Item Volume',
            currentValue: `${itemQty} units`,
            quality: 'COMPLETE',
          },
        ],
        recommendation: INSIGHT_RULES['menu.top_performer'].recommendationTemplate,
        detectedAt,
        dataQuality: 'COMPLETE',
        status: 'ACTIVE',
      });
    }
  }

  return insights;
}

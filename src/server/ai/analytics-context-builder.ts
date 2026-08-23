import { AIContextSnapshot } from '@/lib/ai/ai-types';
import { OperationalInsightDTO } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';

export class AnalyticsContextBuilder {
  /**
   * Sanitizes authorized ExecutiveOverviewDTO and insights into a safe AIContextSnapshot.
   * Strips all staff/customer PII, secrets, auth tokens, and raw DB metadata.
   */
  static buildSnapshot(
    overview: ExecutiveOverviewDTO,
    insights: OperationalInsightDTO[]
  ): AIContextSnapshot {
    const { summary, sales, operations, inventory, reviews } = overview;

    return {
      business: {
        id: summary.tenantId,
        currency: summary.currency,
        timezone: summary.resolvedDateRange.timezone,
      },
      scope: {
        targetBranchIds: summary.branchIds,
        isMultiBranch: overview.isMultiBranchAuthorized,
      },
      period: {
        preset: summary.resolvedDateRange.preset,
        startUtc: summary.resolvedDateRange.startUtc,
        endUtc: summary.resolvedDateRange.endUtc,
        label: summary.resolvedDateRange.label,
      },
      metrics: {
        grossSalesCents: sales.grossSales.value,
        netSalesCents: sales.netSales.value,
        completedOrders: sales.completedOrders.value || 0,
        placedOrders: sales.placedOrders.value || 0,
        aovCents: sales.aov.value,
        avgKitchenPrepTimeSeconds: operations.avgKitchenPreparationTime.value,
        completionRate: operations.completionRate.value,
        outOfStockCount: inventory.outOfStockItemCount.value || 0,
        lowStockCount: inventory.lowStockItemCount.value || 0,
        wasteCostCents: inventory.wasteCostCents.value,
        avgRating: reviews.avgRating.value,
        reviewCount: reviews.reviewCount.value || 0,
      },
      activeInsights: insights.filter((i) => i.status === 'ACTIVE'),
      dataQuality: summary.dataQuality,
      hasFinancialAccess: summary.hasFinancialAccess,
    };
  }
}

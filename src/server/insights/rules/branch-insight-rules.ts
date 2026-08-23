import { OperationalInsightDTO } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';
import { formatCurrency } from '@/features/cart/cart-calculations';

export function evaluateBranchInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, branchComparison } = dto;
  const currency = summary.currency;

  if (!branchComparison || branchComparison.length < 2) {
    return insights;
  }

  // Find branch with highest revenue (if financial access)
  if (summary.hasFinancialAccess) {
    const validRevBranches = branchComparison
      .filter((b) => b.grossSalesCents !== null)
      .sort((a, b) => (b.grossSalesCents || 0) - (a.grossSalesCents || 0));

    if (validRevBranches.length >= 2) {
      const top = validRevBranches[0];
      const lowest = validRevBranches[validRevBranches.length - 1];

      insights.push({
        id: `branch-revenue-variance-${summary.tenantId}`,
        ruleKey: 'branch.performance_variance',
        fingerprint: `branch.performance_variance:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'BRANCH',
        severity: 'INFO',
        title: `Branch Revenue Variance: ${top.branchName} Leading`,
        summary: `Top branch "${top.branchName}" generated ${formatCurrency(top.grossSalesCents || 0, currency)}, while "${lowest.branchName}" recorded ${formatCurrency(lowest.grossSalesCents || 0, currency)}.`,
        branchId: top.branchId,
        branchName: top.branchName,
        metricKeys: ['revenue_per_branch'],
        evidence: [
          {
            label: `Top Branch (${top.branchName})`,
            currentValue: formatCurrency(top.grossSalesCents || 0, currency),
          },
          {
            label: `Lowest Branch (${lowest.branchName})`,
            currentValue: formatCurrency(lowest.grossSalesCents || 0, currency),
          },
        ],
        recommendation: INSIGHT_RULES['branch.performance_variance'].recommendationTemplate,
        detectedAt,
        dataQuality: 'COMPLETE',
        status: 'ACTIVE',
      });
    }
  }

  return insights;
}

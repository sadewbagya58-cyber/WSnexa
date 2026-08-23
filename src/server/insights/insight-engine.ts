import { OperationalInsightDTO, InsightSeverity } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { createAdminClient } from '@/lib/supabase/server';
import { evaluateSalesInsightRules } from './rules/sales-insight-rules';
import { evaluateOperationsInsightRules } from './rules/operations-insight-rules';
import { evaluateMenuInsightRules } from './rules/menu-insight-rules';
import { evaluateInventoryInsightRules } from './rules/inventory-insight-rules';
import { evaluateReputationInsightRules } from './rules/reputation-insight-rules';
import { evaluateBranchInsightRules } from './rules/branch-insight-rules';

export class InsightEngine {
  /**
   * Deterministically evaluates operational insights over an authorized ExecutiveOverviewDTO in-memory.
   * Zero per-rule database queries.
   */
  static async evaluate(dto: ExecutiveOverviewDTO): Promise<OperationalInsightDTO[]> {
    const detectedAt = new Date().toISOString();

    // 1. In-memory rule evaluation across all rule domains
    const rawInsights: OperationalInsightDTO[] = [
      ...evaluateSalesInsightRules(dto, detectedAt),
      ...evaluateOperationsInsightRules(dto, detectedAt),
      ...evaluateMenuInsightRules(dto, detectedAt),
      ...evaluateInventoryInsightRules(dto, detectedAt),
      ...evaluateReputationInsightRules(dto, detectedAt),
      ...evaluateBranchInsightRules(dto, detectedAt),
    ];

    if (rawInsights.length === 0) {
      return [];
    }

    // 2. Fetch dismissed states from analytics_insight_states table
    const fingerprints = rawInsights.map((i) => i.fingerprint);
    const dismissedFingerprints = new Set<string>();

    try {
      const admin = createAdminClient();
      const { data: stateRows } = await admin
        .from('analytics_insight_states')
        .select('fingerprint, status')
        .eq('business_id', dto.summary.tenantId)
        .in('fingerprint', fingerprints)
        .eq('status', 'DISMISSED');

      (stateRows || []).forEach((row) => {
        if (row.fingerprint) {
          dismissedFingerprints.add(row.fingerprint);
        }
      });
    } catch (err) {
      console.error('[InsightEngine state lookup warning]:', err);
    }

    // 3. Attach dismissal status
    const mappedInsights = rawInsights.map((insight) => {
      if (dismissedFingerprints.has(insight.fingerprint)) {
        return { ...insight, status: 'DISMISSED' as const };
      }
      return insight;
    });

    // 4. Deduplicate and prioritize insights
    return this.prioritizeAndDedupe(mappedInsights);
  }

  /**
   * Priority sorting: CRITICAL > WARNING > SUCCESS > INFO.
   * Deduplication: Ensures maximum 1 non-critical insight per category to avoid clutter.
   */
  private static prioritizeAndDedupe(insights: OperationalInsightDTO[]): OperationalInsightDTO[] {
    const severityMap: Record<InsightSeverity, number> = {
      CRITICAL: 1,
      WARNING: 2,
      SUCCESS: 3,
      INFO: 4,
    };

    // Sort by severity rank, then title
    insights.sort((a, b) => {
      const rankA = severityMap[a.severity] || 5;
      const rankB = severityMap[b.severity] || 5;
      if (rankA !== rankB) return rankA - rankB;
      return a.title.localeCompare(b.title);
    });

    const categoryCountMap = new Map<string, number>();
    const filtered: OperationalInsightDTO[] = [];

    for (const insight of insights) {
      const count = categoryCountMap.get(insight.category) || 0;
      // Allow all CRITICAL insights, but cap non-critical at 2 per category
      if (insight.severity === 'CRITICAL' || count < 2) {
        filtered.push(insight);
        categoryCountMap.set(insight.category, count + 1);
      }
    }

    return filtered;
  }
}

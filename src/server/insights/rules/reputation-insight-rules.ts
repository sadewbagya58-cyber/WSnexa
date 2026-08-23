import { OperationalInsightDTO, InsightSeverity } from '@/lib/insights/insight-types';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { INSIGHT_THRESHOLDS } from '@/lib/insights/insight-thresholds';
import { INSIGHT_RULES } from '@/lib/insights/insight-rule-registry';

export function evaluateReputationInsightRules(
  dto: ExecutiveOverviewDTO,
  detectedAt: string
): OperationalInsightDTO[] {
  const insights: OperationalInsightDTO[] = [];
  const { summary, reviews } = dto;

  // A. Average Rating Contraction
  const ratingMetric = reviews.avgRating;
  const countMetric = reviews.reviewCount;
  const reviewCount = countMetric?.value ?? 0;

  if (
    ratingMetric &&
    ratingMetric.quality !== 'UNAVAILABLE' &&
    ratingMetric.value !== null &&
    reviewCount >= INSIGHT_THRESHOLDS.REPUTATION.MIN_REVIEW_SAMPLE_SIZE
  ) {
    const rating = ratingMetric.value;
    const prevRating = ratingMetric.previousValue;

    if (rating <= INSIGHT_THRESHOLDS.REPUTATION.RATING_LOW_WARNING) {
      const severity: InsightSeverity =
        rating <= INSIGHT_THRESHOLDS.REPUTATION.RATING_LOW_CRITICAL ? 'CRITICAL' : 'WARNING';

      insights.push({
        id: `rep-rating-decline-${summary.tenantId}`,
        ruleKey: 'reputation.rating_decline',
        fingerprint: `reputation.rating_decline:${summary.tenantId}:${summary.resolvedDateRange.preset}`,
        category: 'REPUTATION',
        severity,
        title: `Average Customer Rating at ${rating.toFixed(1)} ★`,
        summary: `Average guest satisfaction rating is ${rating.toFixed(1)} ★ based on ${reviewCount} reviews.`,
        metricKeys: ['avg_rating', 'review_count'],
        evidence: [
          {
            label: 'Average Rating',
            currentValue: `${rating.toFixed(1)} / 5.0 ★`,
            previousValue: prevRating !== null ? `${prevRating?.toFixed(1)} ★` : undefined,
            sampleSize: reviewCount,
            quality: ratingMetric.quality,
          },
        ],
        recommendation: INSIGHT_RULES['reputation.rating_decline'].recommendationTemplate,
        detectedAt,
        dataQuality: ratingMetric.quality,
        status: 'ACTIVE',
      });
    }
  }

  // B. Unresponded Reviews Backlog
  const unrespondedMetric = reviews.unrespondedReviewCount;
  if (
    unrespondedMetric &&
    unrespondedMetric.quality !== 'UNAVAILABLE' &&
    unrespondedMetric.value !== null &&
    unrespondedMetric.value >= INSIGHT_THRESHOLDS.REPUTATION.UNRESPONDED_REVIEWS_WARNING_COUNT
  ) {
    insights.push({
      id: `rep-unresponded-${summary.tenantId}`,
      ruleKey: 'reputation.unresponded_reviews',
      fingerprint: `reputation.unresponded_reviews:${summary.tenantId}`,
      category: 'REPUTATION',
      severity: 'INFO',
      title: `${unrespondedMetric.value} Unresponded Guest Reviews`,
      summary: `There are ${unrespondedMetric.value} customer reviews awaiting staff response.`,
      metricKeys: ['unresponded_review_count', 'response_rate'],
      evidence: [
        {
          label: 'Unresponded Reviews',
          currentValue: `${unrespondedMetric.value} pending`,
          quality: unrespondedMetric.quality,
        },
      ],
      recommendation: INSIGHT_RULES['reputation.unresponded_reviews'].recommendationTemplate,
      detectedAt,
      dataQuality: unrespondedMetric.quality,
      status: 'ACTIVE',
    });
  }

  return insights;
}

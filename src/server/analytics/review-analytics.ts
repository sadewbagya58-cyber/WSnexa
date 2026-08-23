import { createAdminClient } from '@/lib/supabase/server';
import { ResolvedDateRange, MetricValueDTO, BreakdownItemDTO, AnalyticsError } from '@/lib/analytics/analytics-types';

export interface ReviewAnalyticsResult {
  avgRating: MetricValueDTO;
  reviewCount: MetricValueDTO;
  ratingDistribution: BreakdownItemDTO[];
  responseRate: MetricValueDTO;
  unrespondedReviewCount: MetricValueDTO;
}

interface VenueReviewRow {
  rating?: number | null;
  owner_response?: string | null;
}

/**
 * Server data engine for customer reviews, average star ratings, and response rate analytics.
 */
export async function getReviewAnalytics(
  businessId: string,
  branchIds: string[],
  dateRange: ResolvedDateRange
): Promise<ReviewAnalyticsResult> {
  const admin = createAdminClient();
  const primaryBranchId = branchIds[0];

  if (!primaryBranchId) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No target branch specified for review analytics.');
  }

  // Fetch reviews for branch within date range
  const { data: reviewsData, error: reviewErr } = await admin
    .from('venue_reviews')
    .select('rating, owner_response')
    .eq('branch_id', primaryBranchId)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc);

  if (reviewErr) {
    // If table is absent or empty, return clean empty result
    return {
      avgRating: { key: 'avg_rating', value: null, unit: 'rating', quality: 'UNAVAILABLE', qualityNote: 'No review records found.' },
      reviewCount: { key: 'review_count', value: 0, unit: 'count', quality: 'COMPLETE' },
      ratingDistribution: [],
      responseRate: { key: 'response_rate', value: null, unit: 'percentage', quality: 'UNAVAILABLE' },
      unrespondedReviewCount: { key: 'unresponded_review_count', value: 0, unit: 'count', quality: 'COMPLETE' },
    };
  }

  const reviews = (reviewsData || []) as VenueReviewRow[];
  const totalReviews = reviews.length;
  let totalRatingSum = 0;
  let respondedCount = 0;
  const ratingDistMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  reviews.forEach((r) => {
    const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating || 0))));
    totalRatingSum += Number(r.rating || 0);
    ratingDistMap[rating] = (ratingDistMap[rating] || 0) + 1;

    if (r.owner_response && String(r.owner_response).trim().length > 0) {
      respondedCount++;
    }
  });

  const avgRatingVal = totalReviews > 0 ? Number((totalRatingSum / totalReviews).toFixed(2)) : null;
  const responseRateVal = totalReviews > 0 ? Number(((respondedCount / totalReviews) * 100).toFixed(2)) : null;
  const unrespondedVal = totalReviews - respondedCount;

  const ratingDistribution: BreakdownItemDTO[] = [1, 2, 3, 4, 5].map((star) => ({
    key: `${star}_star`,
    label: `${star} Star`,
    value: ratingDistMap[star] || 0,
    percentage: totalReviews > 0 ? Number((((ratingDistMap[star] || 0) / totalReviews) * 100).toFixed(2)) : 0,
  }));

  return {
    avgRating: {
      key: 'avg_rating',
      value: avgRatingVal,
      unit: 'rating',
      quality: totalReviews > 0 ? 'COMPLETE' : 'UNAVAILABLE',
    },
    reviewCount: {
      key: 'review_count',
      value: totalReviews,
      unit: 'count',
      quality: 'COMPLETE',
    },
    ratingDistribution,
    responseRate: {
      key: 'response_rate',
      value: responseRateVal,
      unit: 'percentage',
      quality: totalReviews > 0 ? 'COMPLETE' : 'UNAVAILABLE',
    },
    unrespondedReviewCount: {
      key: 'unresponded_review_count',
      value: unrespondedVal,
      unit: 'count',
      quality: 'COMPLETE',
    },
  };
}

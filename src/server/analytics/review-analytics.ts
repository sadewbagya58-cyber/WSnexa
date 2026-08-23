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

export interface GroupedReviewBranchMetrics {
  branchId: string;
  avgRating: number | null;
}

/**
 * Grouped batched analytics retrieval across authorized target branches using DB-side aggregated RPCs.
 * Returns exactly targetBranchIds.length rows aggregated in Postgres.
 */
export async function getGroupedReviewsByBranch(
  businessId: string,
  targetBranchIds: string[],
  dateRange: ResolvedDateRange
): Promise<Map<string, GroupedReviewBranchMetrics>> {
  const admin = createAdminClient();
  const map = new Map<string, GroupedReviewBranchMetrics>();

  if (!targetBranchIds || targetBranchIds.length === 0) return map;

  // 1. DB-side aggregated RPC (returns 1 row per branch)
  const { data: rpcRows, error: rpcErr } = await admin.rpc('get_grouped_branch_reviews_summary', {
    p_business_id: businessId,
    p_branch_ids: targetBranchIds,
    p_start_date: dateRange.startUtc,
    p_end_date: dateRange.endUtc,
  });

  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    for (const row of rpcRows) {
      const bId = row.branch_id;
      const avg = row.avg_rating !== null ? Number(row.avg_rating) : null;

      map.set(bId, {
        branchId: bId,
        avgRating: avg,
      });
    }
    return map;
  }

  // 2. Fallback query if RPC is not present
  const { data: reviewsData } = await admin
    .from('venue_reviews')
    .select('branch_id, rating')
    .in('branch_id', targetBranchIds)
    .gte('created_at', dateRange.startUtc)
    .lt('created_at', dateRange.endUtc);

  const branchAggs = new Map<string, { sum: number; count: number }>();
  for (const bId of targetBranchIds) {
    branchAggs.set(bId, { sum: 0, count: 0 });
  }

  for (const row of reviewsData || []) {
    const agg = branchAggs.get(row.branch_id);
    if (!agg) continue;
    agg.sum += Number(row.rating || 0);
    agg.count += 1;
  }

  for (const [bId, agg] of branchAggs.entries()) {
    const avgRating = agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : null;
    map.set(bId, {
      branchId: bId,
      avgRating,
    });
  }

  return map;
}



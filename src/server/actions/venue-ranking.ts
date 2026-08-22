'use server';

import { createClient } from '@/lib/supabase/server';
import { VenueRankingService } from '@/server/services/venue-ranking.service';
import { RankingMode, VenueRankingMetrics } from '@/lib/validation/ranking';

/**
 * Public action: Fetch ranked venues by mode.
 */
export async function getRankedVenuesAction(mode: RankingMode, limit = 12): Promise<VenueRankingMetrics[]> {
  return VenueRankingService.getRankedVenues(mode, limit);
}

/**
 * Customer action: Fetch personalized recommendations for authenticated user.
 */
export async function getPersonalizedRecommendationsAction(limit = 10): Promise<VenueRankingMetrics[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return VenueRankingService.getPersonalizedRecommendations(user?.id || null, limit);
}

/**
 * Customer action: Fetch personal retention insights.
 */
export async function getCustomerRetentionInsightsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return VenueRankingService.getCustomerRetentionInsights(user.id);
}

/**
 * B2B action: Fetch business reputation metrics (`/dashboard/reputation`).
 */
export async function getBusinessReputationAction() {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Active business context required.' };
  }

  const hasPerm = await can({
    context: authContext,
    permission: 'reputation.view',
  });

  if (!hasPerm) {
    return { success: false, message: 'Forbidden: You do not have permission to view business reputation.' };
  }

  const metrics = await VenueRankingService.getBusinessReputationMetrics(authContext.businessId);
  return { success: true, metrics };
}

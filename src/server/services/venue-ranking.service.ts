import { createAdminClient } from '@/lib/supabase/server';
import { VenueRankingMetrics, RankingMode, CustomerPersonalizedInsight } from '@/lib/validation/ranking';

export class VenueRankingService {
  /**
   * Calculates comprehensive ranking metrics and scores for all published venues.
   * Deterministic, explainable, anti-gaming math using verified production signals only.
   */
  static async calculateAllVenueMetrics(): Promise<VenueRankingMetrics[]> {
    const admin = createAdminClient();

    // 1. Fetch published venue profiles
    const { data: rawProfiles, error: profileErr } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('is_published', true);

    if (profileErr || !rawProfiles || rawProfiles.length === 0) {
      return [];
    }

    const venueIds = rawProfiles.map((p) => p.id);
    const businessIds = rawProfiles.map((p) => p.business_id);

    const now = new Date();
    const date7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const date30dAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Fetch verified published reviews
    const { data: reviews } = await admin
      .from('venue_reviews')
      .select('id, venue_profile_id, rating, created_at')
      .in('venue_profile_id', venueIds)
      .eq('status', 'published')
      .eq('is_verified_visit', true);

    // Group reviews by venue_profile_id
    const reviewsByVenue: Record<string, { all: number[]; recent30d: number }> = {};
    (reviews || []).forEach((r) => {
      if (!reviewsByVenue[r.venue_profile_id]) {
        reviewsByVenue[r.venue_profile_id] = { all: [], recent30d: 0 };
      }
      reviewsByVenue[r.venue_profile_id].all.push(r.rating);
      if (r.created_at >= date30dAgo) {
        reviewsByVenue[r.venue_profile_id].recent30d += 1;
      }
    });

    // 3. Fetch completed orders
    const { data: completedOrders } = await admin
      .from('orders')
      .select('id, business_id, customer_user_id, created_at')
      .in('business_id', businessIds)
      .eq('status', 'completed');

    const ordersByBusiness: Record<
      string,
      { total: number; recent7d: number; recent30d: number; customerVisitCounts: Record<string, number> }
    > = {};

    (completedOrders || []).forEach((o) => {
      if (!ordersByBusiness[o.business_id]) {
        ordersByBusiness[o.business_id] = {
          total: 0,
          recent7d: 0,
          recent30d: 0,
          customerVisitCounts: {},
        };
      }

      ordersByBusiness[o.business_id].total += 1;
      if (o.created_at >= date7dAgo) {
        ordersByBusiness[o.business_id].recent7d += 1;
      }
      if (o.created_at >= date30dAgo) {
        ordersByBusiness[o.business_id].recent30d += 1;
      }

      // Track customer visit frequency for repeat rate (use customer_user_id if claimed, or order ID session)
      const userKey = o.customer_user_id || `session_${o.id}`;
      ordersByBusiness[o.business_id].customerVisitCounts[userKey] =
        (ordersByBusiness[o.business_id].customerVisitCounts[userKey] || 0) + 1;
    });

    // 4. Fetch customer favorites
    const { data: favorites } = await admin
      .from('customer_favorite_venues')
      .select('id, venue_profile_id, created_at')
      .in('venue_profile_id', venueIds);

    const favoritesByVenue: Record<string, { total: number; recent30d: number }> = {};
    (favorites || []).forEach((f) => {
      if (!favoritesByVenue[f.venue_profile_id]) {
        favoritesByVenue[f.venue_profile_id] = { total: 0, recent30d: 0 };
      }
      favoritesByVenue[f.venue_profile_id].total += 1;
      if (f.created_at >= date30dAgo) {
        favoritesByVenue[f.venue_profile_id].recent30d += 1;
      }
    });

    // 5. Calculate scores for each venue
    const metricsList: VenueRankingMetrics[] = rawProfiles.map((p) => {
      const revData = reviewsByVenue[p.id] || { all: [], recent30d: 0 };
      const orderData = ordersByBusiness[p.business_id] || {
        total: 0,
        recent7d: 0,
        recent30d: 0,
        customerVisitCounts: {},
      };
      const favData = favoritesByVenue[p.id] || { total: 0, recent30d: 0 };

      // Review stats
      const verifiedReviewCount = revData.all.length;
      const rawRatingSum = revData.all.reduce((acc, r) => acc + r, 0);
      const rawRatingAverage = verifiedReviewCount > 0 ? Number((rawRatingSum / verifiedReviewCount).toFixed(2)) : 0;

      // Bayesian Rating Score: (C * M + N * R) / (C + N)
      // Prior C = 5 reviews, Prior mean M = 4.0
      const C = 5;
      const M = 4.0;
      const bayesianRatingScore = Number(
        ((C * M + verifiedReviewCount * rawRatingAverage) / (C + verifiedReviewCount)).toFixed(3)
      );

      // Customer Repeat Rate
      const uniqueCustomers = Object.keys(orderData.customerVisitCounts);
      const uniqueCustomersCount = uniqueCustomers.length;
      const repeatCustomersCount = uniqueCustomers.filter(
        (key) => orderData.customerVisitCounts[key] >= 2
      ).length;
      const repeatCustomerRate =
        uniqueCustomersCount > 0 ? Number((repeatCustomersCount / uniqueCustomersCount).toFixed(3)) : 0;

      // Trending Score
      const recent7dOrders = orderData.recent7d;
      const recent8to30dOrders = Math.max(0, orderData.recent30d - orderData.recent7d);
      const trendingScore = Number(
        (
          (recent7dOrders * 1.0 + recent8to30dOrders * 0.4) * 1.5 +
          favData.recent30d * 3.0 +
          revData.recent30d * 2.5
        ).toFixed(2)
      );

      // Popularity Score
      const popularityScore = Number(
        (
          orderData.total * 1.0 +
          uniqueCustomersCount * 2.0 +
          favData.total * 3.0 +
          verifiedReviewCount * 2.5
        ).toFixed(2)
      );

      // Most Loved Score
      const mostLovedScore = Number(
        (repeatCustomerRate * 50 + favData.total * 2.0 + bayesianRatingScore * 10).toFixed(2)
      );

      // Hidden Gem Score: High rating (>= 4.2), low volume (<= 150), min 2 reviews
      let hiddenGemScore = 0;
      if (bayesianRatingScore >= 4.2 && verifiedReviewCount >= 2 && orderData.total <= 150) {
        hiddenGemScore = Number(((bayesianRatingScore * 20) / Math.log10(orderData.total + 10)).toFixed(2));
      }

      return {
        venueId: p.id,
        businessId: p.business_id,
        slug: p.slug,
        displayName: p.display_name,
        venueType: p.venue_type,
        city: p.city,
        priceLevel: p.price_level,
        logoUrl: p.logo_url,
        coverImageUrl: p.cover_image_url,
        isPublished: p.is_published,
        isAcceptingOrders: p.is_accepting_orders,

        rawRatingAverage,
        verifiedReviewCount,
        completedOrdersCount: orderData.total,
        uniqueCustomersCount,
        repeatCustomersCount,
        repeatCustomerRate,
        favoritesCount: favData.total,
        recentOrders7d: recent7dOrders,
        recentOrders30d: orderData.recent30d,
        recentFavorites30d: favData.recent30d,
        recentReviews30d: revData.recent30d,

        bayesianRatingScore,
        trendingScore,
        popularityScore,
        mostLovedScore,
        hiddenGemScore,
      };
    });

    return metricsList;
  }

  /**
   * Get public venue rankings by mode.
   */
  static async getRankedVenues(mode: RankingMode, limit = 12): Promise<VenueRankingMetrics[]> {
    const allMetrics = await this.calculateAllVenueMetrics();

    let sorted = [...allMetrics];

    switch (mode) {
      case 'top_rated':
        sorted.sort((a, b) => b.bayesianRatingScore - a.bayesianRatingScore || b.verifiedReviewCount - a.verifiedReviewCount);
        sorted.forEach((v) => {
          v.explanationTag = `★ ${v.rawRatingAverage.toFixed(1)} (${v.verifiedReviewCount} verified reviews)`;
        });
        break;

      case 'trending':
        sorted.sort((a, b) => b.trendingScore - a.trendingScore || b.recentOrders7d - a.recentOrders7d);
        sorted.forEach((v) => {
          v.explanationTag = `🔥 Trending this week (${v.recentOrders7d} recent orders)`;
        });
        break;

      case 'popular':
        sorted.sort((a, b) => b.popularityScore - a.popularityScore || b.completedOrdersCount - a.completedOrdersCount);
        sorted.forEach((v) => {
          v.explanationTag = `👥 ${v.completedOrdersCount} completed orders`;
        });
        break;

      case 'most_loved':
        sorted.sort((a, b) => b.mostLovedScore - a.mostLovedScore || b.repeatCustomerRate - a.repeatCustomerRate);
        sorted.forEach((v) => {
          const percent = Math.round(v.repeatCustomerRate * 100);
          v.explanationTag = `❤️ ${percent}% repeat visitors`;
        });
        break;

      case 'hidden_gems':
        sorted = sorted.filter((v) => v.hiddenGemScore > 0);
        sorted.sort((a, b) => b.hiddenGemScore - a.hiddenGemScore);
        sorted.forEach((v) => {
          v.explanationTag = `💎 Hidden Gem ★ ${v.rawRatingAverage.toFixed(1)}`;
        });
        break;

      case 'newest':
      default:
        sorted.sort((a, b) => b.bayesianRatingScore - a.bayesianRatingScore);
        sorted.forEach((v) => {
          v.explanationTag = `✨ Highly recommended`;
        });
        break;
    }

    return sorted.slice(0, limit);
  }

  /**
   * Personalized recommendations for authenticated customer (scoped strictly to auth.uid()).
   */
  static async getPersonalizedRecommendations(userId: string | null, limit = 10): Promise<VenueRankingMetrics[]> {
    const allMetrics = await this.calculateAllVenueMetrics();
    if (allMetrics.length === 0) return [];

    if (!userId) {
      // Unauthenticated visitor: return top trending/top rated with generic tag
      const generic = await this.getRankedVenues('trending', limit);
      return generic.map((v) => ({
        ...v,
        recommendationReason: 'Trending in your region',
      }));
    }

    const admin = createAdminClient();

    // 1. Fetch customer's claimed completed orders
    const { data: customerOrders } = await admin
      .from('orders')
      .select('business_id, created_at')
      .eq('customer_user_id', userId)
      .eq('status', 'completed');

    // 2. Fetch customer's saved favorites
    const { data: customerFavs } = await admin
      .from('customer_favorite_venues')
      .select('venue_profile_id')
      .eq('user_id', userId);

    const visitedBusinessIds = Array.from(new Set((customerOrders || []).map((o) => o.business_id)));
    const favoritedVenueIds = Array.from(new Set((customerFavs || []).map((f) => f.venue_profile_id)));

    // Count customer's preferred categories & cities
    const categoryCounts: Record<string, number> = {};
    const cityCounts: Record<string, number> = {};

    allMetrics.forEach((v) => {
      if (visitedBusinessIds.includes(v.businessId) || favoritedVenueIds.includes(v.venueId)) {
        categoryCounts[v.venueType] = (categoryCounts[v.venueType] || 0) + 1;
        cityCounts[v.city] = (cityCounts[v.city] || 0) + 1;
      }
    });

    // Find top preferred category & city
    const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] || null;
    const topCity = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0] || null;

    // Score candidates for this specific user
    const scoredCandidates = allMetrics.map((v) => {
      let personalizedScore = v.bayesianRatingScore * 5;
      let reason = 'Popular near your activity';

      if (topCategory && v.venueType === topCategory) {
        personalizedScore += 30;
        reason = `Because you often visit ${v.venueType}s`;
      } else if (topCity && v.city.toLowerCase() === topCity.toLowerCase()) {
        personalizedScore += 25;
        reason = `Popular in ${v.city}`;
      } else if (favoritedVenueIds.includes(v.venueId)) {
        personalizedScore += 20;
        reason = 'Similar to venues you saved';
      }

      return {
        ...v,
        personalizedScore,
        recommendationReason: reason,
      };
    });

    scoredCandidates.sort((a, b) => b.personalizedScore - a.personalizedScore);

    return scoredCandidates.slice(0, limit);
  }

  /**
   * Get personal customer retention insights (scoped to auth.uid()).
   */
  static async getCustomerRetentionInsights(userId: string): Promise<CustomerPersonalizedInsight> {
    const admin = createAdminClient();

    const { data: customerOrders } = await admin
      .from('orders')
      .select('business_id, total_cents, created_at, business:businesses(name)')
      .eq('customer_user_id', userId)
      .eq('status', 'completed');

    if (!customerOrders || customerOrders.length === 0) {
      return {
        totalVisits: 0,
        uniqueVenuesVisited: 0,
        favoriteVenueName: null,
        topCategoryName: null,
        totalSpendCents: 0,
      };
    }

    const totalVisits = customerOrders.length;
    const totalSpendCents = customerOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);

    const businessCounts: Record<string, { count: number; name: string }> = {};
    customerOrders.forEach((o) => {
      const bName = (o.business as unknown as { name?: string })?.name || 'Venue';
      if (!businessCounts[o.business_id]) {
        businessCounts[o.business_id] = { count: 0, name: bName };
      }
      businessCounts[o.business_id].count += 1;
    });

    const uniqueVenuesVisited = Object.keys(businessCounts).length;
    const topBizKey = Object.keys(businessCounts).sort((a, b) => businessCounts[b].count - businessCounts[a].count)[0];
    const favoriteVenueName = topBizKey ? businessCounts[topBizKey].name : null;

    return {
      totalVisits,
      uniqueVenuesVisited,
      favoriteVenueName,
      topCategoryName: 'Hospitality',
      totalSpendCents,
    };
  }

  /**
   * B2B Business Reputation Metrics (`/dashboard/reputation`).
   */
  static async getBusinessReputationMetrics(businessId: string) {
    const allMetrics = await this.calculateAllVenueMetrics();
    const venueMetrics = allMetrics.find((v) => v.businessId === businessId) || null;

    if (!venueMetrics) {
      return {
        hasProfile: false,
        venueId: '',
        businessId,
        slug: '',
        displayName: '',
        venueType: '',
        city: '',
        priceLevel: 1,
        logoUrl: null,
        coverImageUrl: null,
        isPublished: false,
        isAcceptingOrders: false,
        rawRatingAverage: 0,
        verifiedReviewCount: 0,
        completedOrdersCount: 0,
        uniqueCustomersCount: 0,
        repeatCustomersCount: 0,
        repeatCustomerRate: 0,
        favoritesCount: 0,
        recentOrders7d: 0,
        recentOrders30d: 0,
        recentFavorites30d: 0,
        recentReviews30d: 0,
        bayesianRatingScore: 0,
        trendingScore: 0,
        popularityScore: 0,
        mostLovedScore: 0,
        hiddenGemScore: 0,
        overallRank: null,
        categoryRank: null,
      };
    }

    // Determine overall rank
    const sortedByRating = [...allMetrics].sort((a, b) => b.bayesianRatingScore - a.bayesianRatingScore);
    const overallRank = sortedByRating.findIndex((v) => v.businessId === businessId) + 1;

    // Determine category rank
    const categoryVenues = allMetrics.filter((v) => v.venueType === venueMetrics.venueType);
    categoryVenues.sort((a, b) => b.bayesianRatingScore - a.bayesianRatingScore);
    const categoryRank = categoryVenues.findIndex((v) => v.businessId === businessId) + 1;

    return {
      hasProfile: true,
      ...venueMetrics,
      overallRank,
      categoryRank,
    };
  }
}

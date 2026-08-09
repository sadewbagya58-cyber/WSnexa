import { z } from 'zod';

export const rankingModeEnum = z.enum([
  'top_rated',
  'trending',
  'popular',
  'most_loved',
  'hidden_gems',
  'newest',
]);

export type RankingMode = z.infer<typeof rankingModeEnum>;

export interface VenueRankingMetrics {
  venueId: string;
  businessId: string;
  slug: string;
  displayName: string;
  venueType: string;
  city: string;
  priceLevel: number;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  isAcceptingOrders: boolean;
  
  // Raw Data Signals
  rawRatingAverage: number;
  verifiedReviewCount: number;
  completedOrdersCount: number;
  uniqueCustomersCount: number;
  repeatCustomersCount: number;
  repeatCustomerRate: number; // 0.0 to 1.0
  favoritesCount: number;
  recentOrders7d: number;
  recentOrders30d: number;
  recentFavorites30d: number;
  recentReviews30d: number;

  // Calculated Scores
  bayesianRatingScore: number;
  trendingScore: number;
  popularityScore: number;
  mostLovedScore: number;
  hiddenGemScore: number;

  // Explanation Tag
  explanationTag?: string;
  recommendationReason?: string;
}

export interface CustomerPersonalizedInsight {
  totalVisits: number;
  uniqueVenuesVisited: number;
  favoriteVenueName: string | null;
  topCategoryName: string | null;
  totalSpendCents: number;
}

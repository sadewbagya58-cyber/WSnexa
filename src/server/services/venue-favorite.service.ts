import { createAdminClient } from '@/lib/supabase/server';
import { VenuePublicProfileRecord } from './venue-discovery.service';

export interface SavedVenueItem extends VenuePublicProfileRecord {
  favorite_id: string;
  favorited_at: string;
  last_visit_at?: string | null;
}

export class VenueFavoriteService {
  /**
   * Toggle favorite status for a venue profile by customer user.
   */
  static async toggleFavorite(
    userId: string,
    venueProfileId: string
  ): Promise<{ success: boolean; isFavorite: boolean; message: string }> {
    const admin = createAdminClient();

    // Check existing favorite
    const { data: existing } = await admin
      .from('customer_favorite_venues')
      .select('id')
      .eq('user_id', userId)
      .eq('venue_profile_id', venueProfileId)
      .maybeSingle();

    if (existing) {
      // Remove favorite
      const { error } = await admin
        .from('customer_favorite_venues')
        .delete()
        .eq('id', existing.id);

      if (error) {
        return { success: false, isFavorite: true, message: 'Failed to remove favorite.' };
      }
      return { success: true, isFavorite: false, message: 'Removed from your saved favorites.' };
    } else {
      // Add favorite
      const { error } = await admin
        .from('customer_favorite_venues')
        .insert({
          user_id: userId,
          venue_profile_id: venueProfileId,
        });

      if (error) {
        return { success: false, isFavorite: false, message: 'Failed to save venue favorite.' };
      }
      return { success: true, isFavorite: true, message: 'Saved to your favorite venues!' };
    }
  }

  /**
   * Check if customer has saved a specific venue.
   */
  static async isFavorite(userId: string, venueProfileId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('customer_favorite_venues')
      .select('id')
      .eq('user_id', userId)
      .eq('venue_profile_id', venueProfileId)
      .maybeSingle();

    return !!data;
  }

  /**
   * Get all saved favorite venues for a customer.
   */
  static async getCustomerFavorites(userId: string): Promise<SavedVenueItem[]> {
    const admin = createAdminClient();

    const { data: favs } = await admin
      .from('customer_favorite_venues')
      .select(`
        id,
        created_at,
        venue:venue_public_profiles(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!favs) return [];

    interface FavoriteRow {
      id: string;
      created_at: string;
      venue?: VenuePublicProfileRecord | null;
    }

    const typedFavs = favs as unknown as FavoriteRow[];
    const venueIds = typedFavs.map((f) => f.venue?.id).filter(Boolean) as string[];

    // Get DB aggregated ratings
    const { data: reviews } = await admin
      .from('venue_reviews')
      .select('venue_profile_id, rating')
      .in('venue_profile_id', venueIds.length > 0 ? venueIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'published');

    const ratingMap: Record<string, { sum: number; count: number }> = {};
    (reviews || []).forEach((r) => {
      if (!ratingMap[r.venue_profile_id]) {
        ratingMap[r.venue_profile_id] = { sum: 0, count: 0 };
      }
      ratingMap[r.venue_profile_id].sum += r.rating;
      ratingMap[r.venue_profile_id].count += 1;
    });

    // Get user's last completed order date for each venue
    const businessIds = typedFavs.map((f) => f.venue?.business_id).filter(Boolean) as string[];
    const { data: orders } = await admin
      .from('orders')
      .select('business_id, created_at')
      .eq('customer_user_id', userId)
      .in('business_id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: false });

    const visitMap: Record<string, string> = {};
    (orders || []).forEach((o) => {
      if (!visitMap[o.business_id]) {
        visitMap[o.business_id] = o.created_at;
      }
    });

    return typedFavs
      .filter((f): f is FavoriteRow & { venue: VenuePublicProfileRecord } => Boolean(f.venue && f.venue.is_published))
      .map((f) => {
        const v = f.venue;
        const stats = ratingMap[v.id];
        const count = stats ? stats.count : 0;
        const average_rating = stats && count > 0 ? Number((stats.sum / count).toFixed(1)) : 0;

        return {
          ...(v as VenuePublicProfileRecord),
          favorite_id: f.id,
          favorited_at: f.created_at,
          average_rating,
          review_count: count,
          last_visit_at: visitMap[v.business_id] || null,
        };
      });
  }
}

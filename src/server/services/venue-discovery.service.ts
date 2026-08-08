import { createAdminClient } from '@/lib/supabase/server';
import { VenueSearchQuery } from '@/lib/validation/venue';

export interface VenuePublicProfileRecord {
  id: string;
  business_id: string;
  slug: string;
  display_name: string;
  short_description: string | null;
  description: string | null;
  venue_type: string;
  logo_url: string | null;
  cover_image_url: string | null;
  phone_public: string | null;
  email_public: string | null;
  website_url: string | null;
  address_public: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  price_level: number;
  is_published: boolean;
  is_accepting_orders: boolean;
  featured_branch_id: string | null;
  created_at: string;
  updated_at: string;
  average_rating?: number;
  review_count?: number;
  qr_token?: string | null;
}

export interface PublicMenuPreviewItem {
  id: string;
  category_name: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  availability_status: string;
}

export class VenueDiscoveryService {
  /**
   * Search published venues with filters, pagination, and DB-aggregated ratings.
   */
  static async searchVenues(params: VenueSearchQuery) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 12;
    const offset = (page - 1) * limit;

    let query = admin
      .from('venue_public_profiles')
      .select('*', { count: 'exact' })
      .eq('is_published', true);

    if (params.query && params.query.trim().length > 0) {
      const q = `%${params.query.trim()}%`;
      query = query.or(
        `display_name.ilike.${q},city.ilike.${q},short_description.ilike.${q},venue_type.ilike.${q}`
      );
    }

    if (params.category && params.category !== 'all') {
      query = query.eq('venue_type', params.category);
    }

    if (params.priceLevel) {
      query = query.eq('price_level', params.priceLevel);
    }

    if (params.city && params.city.trim().length > 0) {
      query = query.ilike('city', `%${params.city.trim()}%`);
    }

    if (params.acceptingOrdersOnly) {
      query = query.eq('is_accepting_orders', true);
    }

    // Default sorting
    if (params.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: rawVenues, count, error } = await query;
    if (error || !rawVenues) {
      return { venues: [], total: 0, page, limit, totalPages: 0 };
    }

    // Attach DB aggregated ratings for returned venues
    const venueIds = rawVenues.map((v) => v.id);
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

    const venues: VenuePublicProfileRecord[] = rawVenues.map((v) => {
      const stats = ratingMap[v.id];
      const count = stats ? stats.count : 0;
      const average_rating = stats && count > 0 ? Number((stats.sum / count).toFixed(1)) : 0;
      return {
        ...(v as VenuePublicProfileRecord),
        average_rating,
        review_count: count,
      };
    });

    // Filter minRating in memory if requested
    let filteredVenues = venues;
    if (params.minRating && params.minRating > 0) {
      filteredVenues = venues.filter((v) => (v.average_rating || 0) >= params.minRating!);
    }

    // Apply sorting in memory if rating/reviews sort selected
    if (params.sort === 'rating') {
      filteredVenues.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
    } else if (params.sort === 'reviews') {
      filteredVenues.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      venues: filteredVenues,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single public venue profile by slug. Returns null if missing or unpublished (unless includeUnpublished is true for preview).
   */
  static async getVenueBySlug(slug: string, includeUnpublished = false): Promise<VenuePublicProfileRecord | null> {
    const admin = createAdminClient();

    let query = admin.from('venue_public_profiles').select('*').eq('slug', slug);

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    const { data: profile, error } = await query.maybeSingle();
    if (error || !profile) return null;

    // Attach DB aggregate ratings
    const { data: reviews } = await admin
      .from('venue_reviews')
      .select('rating')
      .eq('venue_profile_id', profile.id)
      .eq('status', 'published');

    const review_count = reviews?.length || 0;
    const sum = (reviews || []).reduce((acc, r) => acc + r.rating, 0);
    const average_rating = review_count > 0 ? Number((sum / review_count).toFixed(1)) : 0;

    // Fetch active branch QR token for handoff ordering link
    let qr_token: string | null = null;
    const targetBranchId = profile.featured_branch_id;
    let branchQuery = admin.from('branch_qr_codes').select('token_hash').eq('is_active', true);

    if (targetBranchId) {
      branchQuery = branchQuery.eq('branch_id', targetBranchId);
    } else {
      branchQuery = branchQuery.eq('business_id', profile.business_id);
    }

    const { data: qrData } = await branchQuery.limit(1).maybeSingle();
    if (qrData) {
      qr_token = qrData.token_hash;
    }

    return {
      ...(profile as VenuePublicProfileRecord),
      average_rating,
      review_count,
      qr_token,
    };
  }

  /**
   * Fetch public safe menu preview items for featured branch.
   */
  static async getVenueMenuPreview(businessId: string, featuredBranchId?: string | null): Promise<PublicMenuPreviewItem[]> {
    const admin = createAdminClient();

    let branchId = featuredBranchId;

    if (!branchId) {
      const { data: defaultBranch } = await admin
        .from('branches')
        .select('id')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (defaultBranch) {
        branchId = defaultBranch.id;
      }
    }

    if (!branchId) return [];

    const { data: items } = await admin
      .from('menu_items')
      .select(`
        id,
        name,
        description,
        price_cents,
        image_url,
        availability_status,
        category:menu_categories(name)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('price_cents', { ascending: false })
      .limit(12);

    if (!items) return [];

    return (items as Array<{
      id: string;
      name: string;
      description: string | null;
      price_cents: number;
      image_url: string | null;
      availability_status: string;
      category?: { name?: string } | null;
    }>).map((item) => ({
      id: item.id,
      category_name: item.category?.name || 'General Menu',
      name: item.name,
      description: item.description,
      price_cents: item.price_cents,
      image_url: item.image_url,
      availability_status: item.availability_status,
    }));
  }
}

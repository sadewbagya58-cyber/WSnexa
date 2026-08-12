import { createAdminClient } from '@/lib/supabase/server';
import { VenueSearchQuery } from '@/lib/validation/venue';

export interface BranchLocationInfo {
  id: string;
  name: string;
  address_line_1: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

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
  booking_url?: string | null;
  agoda_url?: string | null;
  external_booking_url?: string | null;
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
  has_wsnexa_ordering?: boolean;
  has_public_menu?: boolean;
  distance_km?: number | null;
  distance_text?: string | null;
  branches?: BranchLocationInfo[];
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

/**
 * Server-side Haversine distance calculation in kilometers.
 * Source of truth: database latitude/longitude coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export class VenueDiscoveryService {
  /**
   * Search published venues with location awareness, filters, pagination, and DB-aggregated ratings.
   */
  static async searchVenues(params: Partial<VenueSearchQuery>) {
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

    if (params.acceptingOrdersOnly || params.orderingAvailableOnly) {
      query = query.eq('is_accepting_orders', true);
    }

    // Default DB fetch order
    if (params.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: rawVenues, error } = await query;
    if (error || !rawVenues) {
      return { venues: [], total: 0, page, limit, totalPages: 0 };
    }

    const venueIds = rawVenues.map((v) => v.id);
    const businessIds = rawVenues.map((v) => v.business_id);

    // Concurrent DB fetches for reviews, active branches, menu availability, and active QR tokens
    const [{ data: reviews }, { data: branchesData }, { data: menuItems }, { data: qrTokens }] = await Promise.all([
      admin
        .from('venue_reviews')
        .select('venue_profile_id, rating')
        .in('venue_profile_id', venueIds.length > 0 ? venueIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'published'),
      admin
        .from('branches')
        .select('id, business_id, name, address_line_1, city, latitude, longitude')
        .in('business_id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('status', 'active'),
      admin
        .from('menu_items')
        .select('business_id')
        .in('business_id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_active', true)
        .is('deleted_at', null),
      admin
        .from('branch_qr_codes')
        .select('business_id, token_hash')
        .in('business_id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_active', true),
    ]);

    // Map reviews
    const ratingMap: Record<string, { sum: number; count: number }> = {};
    (reviews || []).forEach((r) => {
      if (!ratingMap[r.venue_profile_id]) {
        ratingMap[r.venue_profile_id] = { sum: 0, count: 0 };
      }
      ratingMap[r.venue_profile_id].sum += r.rating;
      ratingMap[r.venue_profile_id].count += 1;
    });

    // Map branches by business
    const branchMap: Record<string, BranchLocationInfo[]> = {};
    (branchesData || []).forEach((b) => {
      if (!branchMap[b.business_id]) {
        branchMap[b.business_id] = [];
      }
      branchMap[b.business_id].push({
        id: b.id,
        name: b.name,
        address_line_1: b.address_line_1 || null,
        city: b.city || null,
        latitude: b.latitude != null ? Number(b.latitude) : null,
        longitude: b.longitude != null ? Number(b.longitude) : null,
      });
    });

    // Map public menu items availability
    const businessMenuMap = new Set((menuItems || []).map((m) => m.business_id));

    // Map active QR tokens
    const qrMap: Record<string, string> = {};
    (qrTokens || []).forEach((q) => {
      if (q.business_id && q.token_hash && !qrMap[q.business_id]) {
        qrMap[q.business_id] = q.token_hash;
      }
    });

    // Process venue records with distance and ordering badge calculation
    let venues: VenuePublicProfileRecord[] = rawVenues.map((v) => {
      const stats = ratingMap[v.id];
      const countVal = stats ? stats.count : 0;
      const average_rating = stats && countVal > 0 ? Number((stats.sum / countVal).toFixed(1)) : 0;
      const venueBranches = branchMap[v.business_id] || [];

      // Calculate distance if user location supplied
      let minDistance: number | null = null;
      if (params.userLat != null && params.userLng != null) {
        const candidateCoords: Array<{ lat: number; lng: number }> = [];

        // Add main profile coordinates if available
        if (v.latitude != null && v.longitude != null) {
          candidateCoords.push({ lat: Number(v.latitude), lng: Number(v.longitude) });
        }

        // Add branch-specific coordinates to support multi-branch location accuracy
        venueBranches.forEach((br) => {
          if (br.latitude != null && br.longitude != null) {
            candidateCoords.push({ lat: br.latitude, lng: br.longitude });
          }
        });

        if (candidateCoords.length > 0) {
          const distances = candidateCoords.map((c) =>
            calculateHaversineDistanceKm(params.userLat!, params.userLng!, c.lat, c.lng)
          );
          minDistance = Math.min(...distances);
        }
      }

      const has_wsnexa_ordering = Boolean(v.is_accepting_orders && qrMap[v.business_id]);
      const has_public_menu = businessMenuMap.has(v.business_id);

      return {
        ...(v as VenuePublicProfileRecord),
        average_rating,
        review_count: countVal,
        qr_token: qrMap[v.business_id] || null,
        has_wsnexa_ordering,
        has_public_menu,
        distance_km: minDistance,
        distance_text: minDistance != null ? `${minDistance.toFixed(1)} km` : null,
        branches: venueBranches,
      };
    });

    // Filter by radius if user Lat/Lng provided and radius specified
    if (params.userLat != null && params.userLng != null && params.radiusKm) {
      venues = venues.filter((v) => v.distance_km != null && v.distance_km <= params.radiusKm!);
    }

    // Filter by hasPublicMenuOnly if requested
    if (params.hasPublicMenuOnly) {
      venues = venues.filter((v) => v.has_public_menu);
    }

    // Filter minRating in memory if requested
    if (params.minRating && params.minRating > 0) {
      venues = venues.filter((v) => (v.average_rating || 0) >= params.minRating!);
    }

    // Apply sorting in memory
    if (params.sort === 'nearest') {
      venues.sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1; // missing coordinates placed last
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
    } else if (params.sort === 'rating') {
      venues.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
    } else if (params.sort === 'reviews') {
      venues.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    }

    // Paginate in memory if location/distance filters altered the list
    const filteredTotal = venues.length;
    const paginatedVenues = venues.slice(offset, offset + limit);
    const totalPages = Math.ceil(filteredTotal / limit);

    return {
      venues: paginatedVenues,
      total: filteredTotal,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single public venue profile by slug.
   */
  static async getVenueBySlug(slug: string, includeUnpublished = false): Promise<VenuePublicProfileRecord | null> {
    const admin = createAdminClient();

    let query = admin.from('venue_public_profiles').select('*').eq('slug', slug);

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    const { data: profile, error } = await query.maybeSingle();
    if (error || !profile) return null;

    // Attach DB aggregate ratings, active branches, menu availability, and QR token
    const [{ data: reviews }, { data: branchesData }, { data: menuItems }, { data: qrData }] = await Promise.all([
      admin
        .from('venue_reviews')
        .select('rating')
        .eq('venue_profile_id', profile.id)
        .eq('status', 'published'),
      admin
        .from('branches')
        .select('id, name, address_line_1, city, latitude, longitude')
        .eq('business_id', profile.business_id)
        .eq('status', 'active'),
      admin
        .from('menu_items')
        .select('id')
        .eq('business_id', profile.business_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(1),
      admin
        .from('branch_qr_codes')
        .select('token_hash')
        .eq('business_id', profile.business_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ]);

    const review_count = reviews?.length || 0;
    const sum = (reviews || []).reduce((acc, r) => acc + r.rating, 0);
    const average_rating = review_count > 0 ? Number((sum / review_count).toFixed(1)) : 0;

    const branches: BranchLocationInfo[] = (branchesData || []).map((b) => ({
      id: b.id,
      name: b.name,
      address_line_1: b.address_line_1 || null,
      city: b.city || null,
      latitude: b.latitude != null ? Number(b.latitude) : null,
      longitude: b.longitude != null ? Number(b.longitude) : null,
    }));

    const qr_token = qrData?.token_hash || null;
    const has_wsnexa_ordering = Boolean(profile.is_accepting_orders && qr_token);
    const has_public_menu = Boolean(menuItems && menuItems.length > 0);

    return {
      ...(profile as VenuePublicProfileRecord),
      average_rating,
      review_count,
      qr_token,
      has_wsnexa_ordering,
      has_public_menu,
      branches,
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

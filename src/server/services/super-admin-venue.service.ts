import { createAdminClient } from '@/lib/supabase/admin';
import { isVenueLocationComplete, normalizeVenueSlug, VenueProfileInput } from '@/lib/validation/venue';

export interface AdminVenueListItem {
  id: string;
  businessId: string;
  businessName: string;
  displayName: string;
  slug: string;
  venueType: string;
  city: string;
  country: string;
  isPublished: boolean;
  isAcceptingOrders: boolean;
  hasWsnexaOrdering: boolean;
  isLocationComplete: boolean;
  latitude: number | null;
  longitude: number | null;
  addressPublic: string | null;
  featuredBranchId: string | null;
  createdAt: string;
}

export interface AdminCreateVenueInput extends VenueProfileInput {
  businessId?: string;
  newBusinessName?: string;
}

export class SuperAdminVenueService {
  /**
   * Authoritative server-side verification of Super Admin role.
   */
  static async verifySuperAdminAuthority(userId: string): Promise<boolean> {
    if (!userId) return false;
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('is_super_admin')
      .eq('id', userId)
      .maybeSingle();

    return Boolean(profile?.is_super_admin);
  }

  /**
   * List all venues in system for Super Admin management dashboard.
   */
  static async listAllVenues(searchQuery?: string): Promise<AdminVenueListItem[]> {
    const admin = createAdminClient();

    let query = admin
      .from('venue_public_profiles')
      .select('*, businesses(id, name), branches(id, name, latitude, longitude)');

    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim().toLowerCase()}%`;
      query = query.or(`display_name.ilike.${q},city.ilike.${q},slug.ilike.${q}`);
    }

    const { data: profiles, error } = await query.order('created_at', { ascending: false });

    if (error || !profiles) {
      console.error('[SuperAdminVenueService.listAllVenues] Query error:', error);
      return [];
    }

    // Fetch active QR tokens to determine WSNexa ordering support
    const businessIds = profiles.map((p) => p.business_id);
    const { data: qrTokens } = await admin
      .from('branch_qr_codes')
      .select('business_id')
      .in('business_id', businessIds.length > 0 ? businessIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('is_active', true);

    const qrMap = new Set((qrTokens || []).map((q) => q.business_id));

    return profiles.map((p) => {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: p.address_public,
        city: p.city,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
      });

      const bizName = p.businesses?.name || 'Unnamed Business';
      const hasOrdering = Boolean(p.is_accepting_orders && qrMap.has(p.business_id));

      return {
        id: p.id,
        businessId: p.business_id,
        businessName: bizName,
        displayName: p.display_name,
        slug: p.slug,
        venueType: p.venue_type,
        city: p.city,
        country: p.country || 'US',
        isPublished: p.is_published,
        isAcceptingOrders: p.is_accepting_orders,
        hasWsnexaOrdering: hasOrdering,
        isLocationComplete: isLocComplete,
        latitude: p.latitude != null ? Number(p.latitude) : null,
        longitude: p.longitude != null ? Number(p.longitude) : null,
        addressPublic: p.address_public || null,
        featuredBranchId: p.featured_branch_id || null,
        createdAt: p.created_at,
      };
    });
  }

  /**
   * Super Admin Create Venue flow.
   */
  static async createVenueAsAdmin(
    input: AdminCreateVenueInput,
    adminUserId: string
  ): Promise<{ success: boolean; message: string; venueId?: string; slug?: string }> {
    const isSuperAdmin = await this.verifySuperAdminAuthority(adminUserId);
    if (!isSuperAdmin) {
      return { success: false, message: 'Forbidden: Super Admin authority required.' };
    }

    const admin = createAdminClient();
    let targetBusinessId = input.businessId;

    // Create business if newBusinessName specified
    if (!targetBusinessId && input.newBusinessName) {
      const bizSlug = normalizeVenueSlug(input.newBusinessName.trim()) + '-' + Date.now();
      const { data: newBiz, error: bizErr } = await admin
        .from('businesses')
        .insert({
          name: input.newBusinessName.trim(),
          slug: bizSlug,
          created_by: adminUserId,
        })
        .select('id')
        .single();

      if (bizErr || !newBiz) {
        return { success: false, message: `Failed to create business: ${bizErr?.message || 'Unknown error'}` };
      }
      targetBusinessId = newBiz.id;

      await admin.from('business_memberships').insert({
        business_id: targetBusinessId,
        user_id: adminUserId,
        role: 'business_owner',
      });

      // Create default branch
      const { data: newBranch } = await admin
        .from('branches')
        .insert({
          business_id: targetBusinessId,
          name: 'Main Branch',
          code: 'MAIN',
          is_default: true,
          address_line_1: input.addressPublic || null,
          city: input.city || null,
          latitude: input.latitude || null,
          longitude: input.longitude || null,
        })
        .select('id')
        .single();

      if (newBranch && !input.featuredBranchId) {
        input.featuredBranchId = newBranch.id;
      }
    }

    if (!targetBusinessId) {
      return { success: false, message: 'Business selection or business creation name is required.' };
    }

    // Server-side location publication gate
    if (input.isPublished) {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: input.addressPublic,
        city: input.city,
        country: input.country,
        latitude: input.latitude,
        longitude: input.longitude,
      });

      if (!isLocComplete) {
        return { success: false, message: 'Please configure a valid venue location before publishing.' };
      }
    }

    const normalizedSlug = normalizeVenueSlug(input.slug || input.displayName);
    if (!normalizedSlug || normalizedSlug.length < 2) {
      return { success: false, message: 'Please enter a valid venue URL slug.' };
    }

    const { data: existingSlug } = await admin
      .from('venue_public_profiles')
      .select('id, business_id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (existingSlug && existingSlug.business_id !== targetBusinessId) {
      return { success: false, message: 'This venue URL slug is already in use.' };
    }

    const payload = {
      business_id: targetBusinessId,
      slug: normalizedSlug,
      display_name: input.displayName,
      short_description: input.shortDescription || null,
      description: input.description || null,
      venue_type: input.venueType || 'restaurant',
      logo_url: input.logoUrl || null,
      cover_image_url: input.coverImageUrl || null,
      phone_public: input.phonePublic || null,
      email_public: input.emailPublic || null,
      website_url: input.websiteUrl || null,
      address_public: input.addressPublic || null,
      city: input.city,
      country: input.country || 'US',
      latitude: input.latitude != null ? input.latitude : null,
      longitude: input.longitude != null ? input.longitude : null,
      price_level: input.priceLevel || 2,
      is_published: input.isPublished || false,
      is_accepting_orders: input.isAcceptingOrders ?? true,
      featured_branch_id: input.featuredBranchId || null,
      booking_url: input.bookingUrl || null,
      agoda_url: input.agodaUrl || null,
      external_booking_url: input.externalBookingUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error } = await admin
      .from('venue_public_profiles')
      .upsert(payload, { onConflict: 'business_id' })
      .select('id, slug')
      .single();

    if (error || !upserted) {
      return { success: false, message: `Failed to save venue: ${error?.message || 'Database error'}` };
    }

    return {
      success: true,
      message: input.isPublished ? 'Venue created & published live successfully!' : 'Venue draft saved successfully!',
      venueId: upserted.id,
      slug: upserted.slug,
    };
  }

  /**
   * Super Admin Publication Toggle.
   */
  static async togglePublishAsAdmin(
    venueProfileId: string,
    isPublished: boolean,
    adminUserId: string
  ): Promise<{ success: boolean; message: string }> {
    const isSuperAdmin = await this.verifySuperAdminAuthority(adminUserId);
    if (!isSuperAdmin) {
      return { success: false, message: 'Forbidden: Super Admin authority required.' };
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', venueProfileId)
      .single();

    if (!profile) {
      return { success: false, message: 'Venue profile not found.' };
    }

    if (isPublished) {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: profile.address_public,
        city: profile.city,
        country: profile.country,
        latitude: profile.latitude,
        longitude: profile.longitude,
      });

      if (!isLocComplete) {
        return { success: false, message: 'Please configure a valid venue location before publishing.' };
      }
    }

    const { error } = await admin
      .from('venue_public_profiles')
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq('id', venueProfileId);

    if (error) {
      return { success: false, message: `Failed to update status: ${error.message}` };
    }

    return {
      success: true,
      message: isPublished ? 'Venue published live successfully!' : 'Venue unpublished to draft status.',
    };
  }
}

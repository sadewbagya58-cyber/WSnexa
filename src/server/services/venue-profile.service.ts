import { createAdminClient } from '@/lib/supabase/server';
import { VenueProfileInput, normalizeVenueSlug, isValidVenueSlug } from '@/lib/validation/venue';
import { VenuePublicProfileRecord } from './venue-discovery.service';

export class VenueProfileService {
  /**
   * Get business public profile by business_id (for B2B dashboard edit).
   */
  static async getProfileByBusinessId(businessId: string): Promise<VenuePublicProfileRecord | null> {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (error || !data) return null;
    return data as unknown as VenuePublicProfileRecord;
  }

  /**
   * Create or update venue public profile draft.
   */
  static async upsertProfile(
    businessId: string,
    input: VenueProfileInput
  ): Promise<{ success: boolean; message: string; data?: VenuePublicProfileRecord }> {
    const admin = createAdminClient();

    const targetSlug = normalizeVenueSlug(input.slug?.trim() || input.displayName);

    if (!isValidVenueSlug(targetSlug)) {
      return {
        success: false,
        message: 'Please enter a valid venue URL (letters, numbers, single hyphens only).',
      };
    }

    // Check slug uniqueness across other businesses
    const { data: existingSlug } = await admin
      .from('venue_public_profiles')
      .select('id, business_id')
      .eq('slug', targetSlug)
      .maybeSingle();

    if (existingSlug && existingSlug.business_id !== businessId) {
      return {
        success: false,
        message: 'This venue URL is already in use. Please choose another one.',
      };
    }

    // Fetch existing profile to preserve existing fields if omitted in partial updates
    const { data: existingProfile } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    // Validation for publish status: require minimum mandatory fields & location coordinates
    if (input.isPublished) {
      if (!input.displayName || input.displayName.trim().length === 0) {
        return { success: false, message: 'Display Name is required to publish venue profile.' };
      }
      if (!input.venueType) {
        return { success: false, message: 'Venue Type is required to publish venue profile.' };
      }
      if (!input.city || input.city.trim().length === 0) {
        return { success: false, message: 'City is required to publish venue profile.' };
      }
      if (!input.addressPublic || input.addressPublic.trim().length === 0) {
        return { success: false, message: 'Public Address is required to publish venue profile.' };
      }

      // Resolve coordinates from featured branch if set or from direct input
      let hasValidCoords = false;
      if (
        input.latitude != null &&
        input.longitude != null &&
        input.latitude >= -90 &&
        input.latitude <= 90 &&
        input.longitude >= -180 &&
        input.longitude <= 180
      ) {
        hasValidCoords = true;
      } else if (input.featuredBranchId) {
        const { data: branchData } = await admin
          .from('branches')
          .select('latitude, longitude')
          .eq('id', input.featuredBranchId)
          .maybeSingle();

        if (
          branchData &&
          branchData.latitude != null &&
          branchData.longitude != null &&
          branchData.latitude >= -90 &&
          branchData.latitude <= 90 &&
          branchData.longitude >= -180 &&
          branchData.longitude <= 180
        ) {
          hasValidCoords = true;
        }
      }

      if (!hasValidCoords) {
        return { success: false, message: 'Please configure a valid venue location before publishing.' };
      }
    }

    const payload = {
      business_id: businessId,
      slug: targetSlug,
      display_name: input.displayName,
      short_description: input.shortDescription !== undefined ? (input.shortDescription || null) : (existingProfile?.short_description ?? null),
      description: input.description !== undefined ? (input.description || null) : (existingProfile?.description ?? null),
      venue_type: input.venueType || existingProfile?.venue_type || 'restaurant',
      logo_url: input.logoUrl !== undefined ? (input.logoUrl || null) : (existingProfile?.logo_url ?? null),
      cover_image_url: input.coverImageUrl !== undefined ? (input.coverImageUrl || null) : (existingProfile?.cover_image_url ?? null),
      phone_public: input.phonePublic !== undefined ? (input.phonePublic ? input.phonePublic.trim() : null) : (existingProfile?.phone_public ?? null),
      email_public: input.emailPublic !== undefined ? (input.emailPublic ? input.emailPublic.trim() : null) : (existingProfile?.email_public ?? null),
      website_url: input.websiteUrl !== undefined ? (input.websiteUrl || null) : (existingProfile?.website_url ?? null),
      address_public: input.addressPublic !== undefined ? (input.addressPublic || null) : (existingProfile?.address_public ?? null),
      city: input.city || existingProfile?.city,
      country: input.country || existingProfile?.country || 'US',
      latitude: input.latitude !== undefined ? input.latitude : (existingProfile?.latitude ?? null),
      longitude: input.longitude !== undefined ? input.longitude : (existingProfile?.longitude ?? null),
      price_level: input.priceLevel || existingProfile?.price_level || 2,
      is_published: input.isPublished !== undefined ? input.isPublished : (existingProfile?.is_published ?? false),
      is_accepting_orders: input.isAcceptingOrders !== undefined ? input.isAcceptingOrders : (existingProfile?.is_accepting_orders ?? true),
      public_reservations_enabled: input.publicReservationsEnabled !== undefined ? input.publicReservationsEnabled : (existingProfile?.public_reservations_enabled ?? true),
      public_menu_enabled: input.publicMenuEnabled !== undefined ? input.publicMenuEnabled : (existingProfile?.public_menu_enabled ?? true),
      featured_branch_id: input.featuredBranchId !== undefined ? (input.featuredBranchId || null) : (existingProfile?.featured_branch_id ?? null),
      booking_url: input.bookingUrl !== undefined ? (input.bookingUrl || null) : (existingProfile?.booking_url ?? null),
      agoda_url: input.agodaUrl !== undefined ? (input.agodaUrl || null) : (existingProfile?.agoda_url ?? null),
      external_booking_url: input.externalBookingUrl !== undefined ? (input.externalBookingUrl || null) : (existingProfile?.external_booking_url ?? null),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('venue_public_profiles')
      .upsert(payload, { onConflict: 'business_id' })
      .select()
      .single();

    if (error || !data) {
      console.error('[VenueProfileService.upsertProfile] Database error:', error);
      const code = error?.code;
      const msg = error?.message || '';

      if (code === '23505' || msg.includes('unique constraint') || msg.includes('already exists')) {
        return {
          success: false,
          message: 'This venue URL is already in use. Please choose another one.',
        };
      }

      if (msg.includes('venue_public_profiles_slug_check') || msg.includes('slug')) {
        return {
          success: false,
          message: 'Please enter a valid venue URL (letters, numbers, single hyphens only).',
        };
      }

      if (msg.includes('country') || msg.includes('venue_public_profiles_country_check')) {
        return {
          success: false,
          message: 'Country code must be 2 uppercase letters (e.g. LK, US).',
        };
      }

      if (msg.includes('price_level')) {
        return {
          success: false,
          message: 'Price level must be between 1 and 4.',
        };
      }

      if (msg.includes('latitude') || msg.includes('longitude')) {
        return {
          success: false,
          message: 'Coordinates must be valid latitude (-90 to 90) and longitude (-180 to 180).',
        };
      }

      return { success: false, message: error?.message || 'Unable to save venue profile. Please check your information and try again.' };
    }

    return {
      success: true,
      message: input.isPublished ? 'Venue profile published successfully!' : 'Venue profile draft saved successfully!',
      data: data as unknown as VenuePublicProfileRecord,
    };
  }

  /**
   * Quick toggle publication status (Publish / Unpublish).
   */
  static async setPublishedStatus(
    businessId: string,
    isPublished: boolean
  ): Promise<{ success: boolean; message: string }> {
    const profile = await this.getProfileByBusinessId(businessId);
    if (!profile) {
      return { success: false, message: 'Venue profile must be created before publishing.' };
    }

    if (isPublished) {
      if (!profile.display_name || !profile.city || !profile.address_public) {
        return {
          success: false,
          message: 'Minimum profile information (Display Name, City, Public Address) is required before publishing.',
        };
      }
      if (!profile.featured_branch_id) {
        return {
          success: false,
          message: 'Please select a Featured Menu Branch before publishing your venue.',
        };
      }
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('venue_public_profiles')
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq('business_id', businessId);

    if (error) {
      return { success: false, message: 'Failed to update publication status.' };
    }

    return {
      success: true,
      message: isPublished ? 'Venue is now live and publicly visible!' : 'Venue profile unpublished and hidden from discovery.',
    };
  }
}

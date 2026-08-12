import { createAdminClient } from '@/lib/supabase/server';
import { VenueProfileInput, normalizeVenueSlug } from '@/lib/validation/venue';
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

    // Always normalize slug server-side regardless of client input
    const normalizedSlug = normalizeVenueSlug(input.slug || input.displayName);

    if (!normalizedSlug || normalizedSlug.length < 2) {
      return {
        success: false,
        message: 'Please enter a valid venue URL (letters, numbers, single hyphens only).',
      };
    }

    // Check slug uniqueness across other businesses
    const { data: existingSlug } = await admin
      .from('venue_public_profiles')
      .select('id, business_id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (existingSlug && existingSlug.business_id !== businessId) {
      return {
        success: false,
        message: 'This venue URL is already in use. Please choose another one.',
      };
    }

    // Validation for publish status: require minimum mandatory fields
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
    }

    const payload = {
      business_id: businessId,
      slug: normalizedSlug,
      display_name: input.displayName,
      short_description: input.shortDescription || null,
      description: input.description || null,
      venue_type: input.venueType,
      logo_url: input.logoUrl || null,
      cover_image_url: input.coverImageUrl || null,
      phone_public: input.phonePublic || null,
      email_public: input.emailPublic || null,
      website_url: input.websiteUrl || null,
      address_public: input.addressPublic || null,
      city: input.city,
      country: input.country || 'US',
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      price_level: input.priceLevel || 2,
      is_published: input.isPublished || false,
      is_accepting_orders: input.isAcceptingOrders ?? true,
      featured_branch_id: input.featuredBranchId || null,
      booking_url: input.bookingUrl || null,
      agoda_url: input.agodaUrl || null,
      external_booking_url: input.externalBookingUrl || null,
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

      if (code === '23514' || msg.includes('check constraint') || msg.includes('venue_public_profiles_slug_check')) {
        return {
          success: false,
          message: 'Please enter a valid venue URL (letters, numbers, single hyphens only).',
        };
      }

      return { success: false, message: 'Unable to save venue profile. Please check your information and try again.' };
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

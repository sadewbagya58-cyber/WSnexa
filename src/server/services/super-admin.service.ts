import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { isVenueLocationComplete, normalizeVenueSlug, VenueType } from '@/lib/validation/venue';
import { PilotOnboardingService } from './pilot-onboarding.service';

export interface AdminOverviewData {
  metrics: {
    totalBusinesses: number;
    totalBranches: number;
    activeBranches: number;
    publishedVenues: number;
    draftVenues: number;
    suspendedVenues: number;
    orderingVenues: number;
    pilotVenues: number;
    totalCustomers: number;
    totalStaff: number;
    totalOrders: number;
    superAdminsCount: number;
  };
  recentVenues: Array<{
    id: string;
    displayName: string;
    businessName: string;
    city: string;
    isPublished: boolean;
    isSuspended: boolean;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    actorEmail?: string;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
  healthScore: number;
  healthStatus: 'READY_FOR_LAUNCH' | 'NEEDS_ATTENTION' | 'NOT_READY';
}

export interface AdminVenueFilterParams {
  query?: string;
  status?: 'all' | 'published' | 'draft' | 'suspended' | 'ordering' | 'pilot' | 'missing_location';
  city?: string;
  page?: number;
  limit?: number;
}

export interface AdminVenueDetail {
  id: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  isPilotDemo: boolean;
  displayName: string;
  slug: string;
  venueType: string;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  phonePublic: string | null;
  emailPublic: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  agodaUrl: string | null;
  externalBookingUrl: string | null;
  addressPublic: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  priceLevel: number;
  isPublished: boolean;
  isAcceptingOrders: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  featuredBranchId: string | null;
  isLocationComplete: boolean;
  hasWsnexaOrdering: boolean;
  createdAt: string;
  updatedAt: string;
  branches: Array<{
    id: string;
    name: string;
    code: string;
    city: string | null;
    status: string;
    isDefault: boolean;
    latitude: number | null;
    longitude: number | null;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail?: string;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
}

export interface CreateAdminVenuePayload {
  businessId?: string;
  newBusinessName?: string;
  displayName: string;
  slug?: string;
  venueType: VenueType;
  shortDescription?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  phonePublic?: string;
  emailPublic?: string;
  websiteUrl?: string;
  addressPublic?: string;
  city: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  priceLevel?: number;
  isPublished?: boolean;
  isAcceptingOrders?: boolean;
  isPilotDemo?: boolean;
  featuredBranchId?: string;
  bookingUrl?: string;
  agodaUrl?: string;
  externalBookingUrl?: string;
}

export class SuperAdminService {
  /**
   * Platform Overview Dashboard Metrics & Recent Activity.
   */
  static async getPlatformOverview(): Promise<AdminOverviewData> {
    const admin = createAdminClient();

    const [
      { count: bizCount },
      { count: suspendedBizCount },
      { count: pilotBizCount },
      { count: allBranchesCount },
      { count: activeBranchesCount },
      { count: publishedVenuesCount },
      { count: draftVenuesCount },
      { count: ordersCount },
      { count: superAdminCount },
      { count: customerCount },
      { count: staffCount },
      { data: rawVenues },
      { data: recentLogs },
      { data: qrTokens },
    ] = await Promise.all([
      admin.from('businesses').select('*', { count: 'exact', head: true }),
      admin.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      admin.from('businesses').select('*', { count: 'exact', head: true }).eq('is_pilot_demo', true),
      admin.from('branches').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      admin.from('branches').select('*', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null),
      admin.from('venue_public_profiles').select('*', { count: 'exact', head: true }).eq('is_published', true),
      admin.from('venue_public_profiles').select('*', { count: 'exact', head: true }).eq('is_published', false),
      admin.from('orders').select('*', { count: 'exact', head: true }),
      admin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_super_admin', true),
      admin.from('user_profiles').select('*', { count: 'exact', head: true }).eq('onboarding_intent', 'customer'),
      admin.from('business_memberships').select('*', { count: 'exact', head: true }).eq('membership_status', 'active'),
      admin.from('venue_public_profiles').select('*, businesses(name)').order('created_at', { ascending: false }).limit(6),
      admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(6),
      admin.from('branch_qr_codes').select('business_id').eq('is_active', true),
    ]);

    const activeQrBizIds = new Set((qrTokens || []).map((q) => q.business_id));

    const recentVenues = (rawVenues || []).map((v) => ({
      id: v.id,
      displayName: v.display_name,
      businessName: v.businesses?.name || 'Business',
      city: v.city,
      isPublished: Boolean(v.is_published),
      isSuspended: Boolean((v as { is_suspended?: boolean }).is_suspended),
      createdAt: v.created_at,
    }));

    // Fetch actor emails for recent audit logs
    const actorIds = Array.from(new Set((recentLogs || []).map((l) => l.actor_id).filter(Boolean))) as string[];
    const actorEmailMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: actorProfiles } = await admin.from('user_profiles').select('id, first_name, last_name').in('id', actorIds);
      (actorProfiles || []).forEach((p) => {
        actorEmailMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Admin User';
      });
    }

    const recentAuditLogs = (recentLogs || []).map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.target_type,
      targetId: l.target_id,
      actorEmail: (l.actor_id && actorEmailMap[l.actor_id]) || 'System / Platform Admin',
      createdAt: l.created_at,
      payload: (l.payload as Record<string, unknown>) || undefined,
    }));

    const publishedCount = publishedVenuesCount || 0;
    const totalVenues = (publishedCount + (draftVenuesCount || 0));
    const orderingCount = (rawVenues || []).filter((v) => v.is_accepting_orders && activeQrBizIds.has(v.business_id)).length;

    const healthScore = totalVenues > 0 && (superAdminCount || 0) > 0 ? 100 : 85;
    const healthStatus: AdminOverviewData['healthStatus'] = healthScore >= 90 ? 'READY_FOR_LAUNCH' : 'NEEDS_ATTENTION';

    return {
      metrics: {
        totalBusinesses: bizCount || 0,
        totalBranches: allBranchesCount || 0,
        activeBranches: activeBranchesCount || 0,
        publishedVenues: publishedCount,
        draftVenues: draftVenuesCount || 0,
        suspendedVenues: suspendedBizCount || 0,
        orderingVenues: orderingCount,
        pilotVenues: pilotBizCount || 0,
        totalCustomers: customerCount || 0,
        totalStaff: staffCount || 0,
        totalOrders: ordersCount || 0,
        superAdminsCount: superAdminCount || 0,
      },
      recentVenues,
      recentAuditLogs,
      healthScore,
      healthStatus,
    };
  }

  /**
   * List Venues with filtering, search, and location status.
   */
  static async listVenues(params: AdminVenueFilterParams = {}) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 15;
    const offset = (page - 1) * limit;

    let query = admin
      .from('venue_public_profiles')
      .select('*, businesses!inner(id, name, status, is_pilot_demo), branches(id, name, latitude, longitude)', { count: 'exact' });

    if (params.query && params.query.trim()) {
      const q = `%${params.query.trim().toLowerCase()}%`;
      query = query.or(`display_name.ilike.${q},city.ilike.${q},slug.ilike.${q}`);
    }

    if (params.status === 'published') {
      query = query.eq('is_published', true);
    } else if (params.status === 'draft') {
      query = query.eq('is_published', false);
    } else if (params.status === 'suspended') {
      query = query.or('is_suspended.eq.true,businesses.status.eq.suspended');
    } else if (params.status === 'pilot') {
      query = query.eq('businesses.is_pilot_demo', true);
    }

    const { data: profiles, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !profiles) {
      console.error('[SuperAdminService.listVenues] Error:', error);
      return { venues: [], total: 0, page, limit, totalPages: 0 };
    }

    // Fetch active QR codes for ordering status
    const businessIds = profiles.map((p) => p.business_id);
    const { data: qrTokens } = await admin
      .from('table_qr_codes')
      .select('business_id')
      .in('business_id', businessIds.length > 0 ? businessIds : ['none'])
      .eq('status', 'active');

    const qrMap = new Set((qrTokens || []).map((q) => q.business_id));

    let venues = profiles.map((p) => {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: p.address_public,
        city: p.city,
        country: p.country,
        latitude: p.latitude,
        longitude: p.longitude,
      });

      const bizName = p.businesses?.name || 'Unnamed Business';
      const bizStatus = p.businesses?.status || 'active';
      const isPilot = Boolean(p.businesses?.is_pilot_demo);
      const isSuspended = Boolean((p as { is_suspended?: boolean }).is_suspended || bizStatus === 'suspended');
      const hasOrdering = Boolean(p.is_accepting_orders && qrMap.has(p.business_id));

      return {
        id: p.id,
        businessId: p.business_id,
        businessName: bizName,
        businessStatus: bizStatus,
        isPilotDemo: isPilot,
        displayName: p.display_name,
        slug: p.slug,
        venueType: p.venue_type,
        city: p.city,
        country: p.country || 'US',
        isPublished: Boolean(p.is_published),
        isAcceptingOrders: Boolean(p.is_accepting_orders),
        hasWsnexaOrdering: hasOrdering,
        isLocationComplete: isLocComplete,
        isSuspended,
        suspensionReason: (p as { suspension_reason?: string }).suspension_reason || null,
        latitude: p.latitude != null ? Number(p.latitude) : null,
        longitude: p.longitude != null ? Number(p.longitude) : null,
        addressPublic: p.address_public || null,
        featuredBranchId: p.featured_branch_id || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    // In-memory filters for flags not fully indexed
    if (params.status === 'ordering') {
      venues = venues.filter((v) => v.hasWsnexaOrdering);
    } else if (params.status === 'missing_location') {
      venues = venues.filter((v) => !v.isLocationComplete);
    }

    const total = count || venues.length;
    const totalPages = Math.ceil(total / limit);

    return {
      venues,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single venue details for Super Admin inspection and management.
   */
  static async getVenueById(venueId: string): Promise<AdminVenueDetail | null> {
    const admin = createAdminClient();

    const { data: p, error } = await admin
      .from('venue_public_profiles')
      .select('*, businesses(*)')
      .eq('id', venueId)
      .maybeSingle();

    if (error || !p) return null;

    // Fetch branches of the parent business
    const { data: branchesData } = await admin
      .from('branches')
      .select('*')
      .eq('business_id', p.business_id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false });

    // Fetch active QR codes for ordering status
    const { data: qrTokens } = await admin
      .from('table_qr_codes')
      .select('id')
      .eq('business_id', p.business_id)
      .eq('status', 'active')
      .limit(1);

    // Fetch recent audit logs for this venue / business
    const { data: logs } = await admin
      .from('audit_logs')
      .select('*')
      .or(`target_id.eq.${p.id},business_id.eq.${p.business_id}`)
      .order('created_at', { ascending: false })
      .limit(10);

    const isLocComplete = isVenueLocationComplete({
      addressPublic: p.address_public,
      city: p.city,
      country: p.country,
      latitude: p.latitude,
      longitude: p.longitude,
    });

    const biz = p.businesses as unknown as { name?: string; status?: string; is_pilot_demo?: boolean } | null;
    const isSuspended = Boolean((p as { is_suspended?: boolean }).is_suspended || biz?.status === 'suspended');

    return {
      id: p.id,
      businessId: p.business_id,
      businessName: biz?.name || 'Business',
      businessStatus: biz?.status || 'active',
      isPilotDemo: Boolean(biz?.is_pilot_demo),
      displayName: p.display_name,
      slug: p.slug,
      venueType: p.venue_type,
      shortDescription: p.short_description,
      description: p.description,
      logoUrl: p.logo_url,
      coverImageUrl: p.cover_image_url,
      phonePublic: p.phone_public,
      emailPublic: p.email_public,
      websiteUrl: p.website_url,
      bookingUrl: p.booking_url || null,
      agodaUrl: p.agoda_url || null,
      externalBookingUrl: p.external_booking_url || null,
      addressPublic: p.address_public,
      city: p.city,
      country: p.country || 'US',
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      priceLevel: p.price_level || 2,
      isPublished: Boolean(p.is_published),
      isAcceptingOrders: Boolean(p.is_accepting_orders),
      isSuspended,
      suspensionReason: (p as { suspension_reason?: string }).suspension_reason || null,
      suspendedAt: (p as { suspended_at?: string }).suspended_at || null,
      featuredBranchId: p.featured_branch_id,
      isLocationComplete: isLocComplete,
      hasWsnexaOrdering: Boolean(p.is_accepting_orders && qrTokens && qrTokens.length > 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      branches: (branchesData || []).map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        city: b.city,
        status: b.status,
        isDefault: Boolean(b.is_default),
        latitude: b.latitude != null ? Number(b.latitude) : null,
        longitude: b.longitude != null ? Number(b.longitude) : null,
      })),
      recentAuditLogs: (logs || []).map((l) => ({
        id: l.id,
        action: l.action,
        actorEmail: l.actor_id ? 'Super Admin' : 'System',
        createdAt: l.created_at,
        payload: (l.payload as Record<string, unknown>) || undefined,
      })),
    };
  }

  /**
   * Super Admin Create Venue flow (with optional business creation and location gate).
   */
  static async createVenue(
    input: CreateAdminVenuePayload,
    actorId: string
  ): Promise<{ success: boolean; message: string; venueId?: string; slug?: string }> {
    const admin = createAdminClient();
    let targetBusinessId = input.businessId;

    // 1. Create new Business & Branch if newBusinessName supplied
    if (!targetBusinessId && input.newBusinessName) {
      const bizSlug = normalizeVenueSlug(input.newBusinessName.trim()) + '-' + Date.now().toString().slice(-4);
      const { data: newBiz, error: bizErr } = await admin
        .from('businesses')
        .insert({
          name: input.newBusinessName.trim(),
          slug: bizSlug,
          created_by: actorId,
          is_pilot_demo: Boolean(input.isPilotDemo),
          status: 'active',
        })
        .select('id')
        .single();

      if (bizErr || !newBiz) {
        return { success: false, message: `Failed to create business: ${bizErr?.message || 'Database error'}` };
      }
      targetBusinessId = newBiz.id;

      // Add actor membership as owner
      await admin.from('business_memberships').insert({
        business_id: targetBusinessId,
        user_id: actorId,
        role: 'business_owner',
        membership_status: 'active',
      });

      // Create default branch with initial coordinates
      const { data: newBranch } = await admin
        .from('branches')
        .insert({
          business_id: targetBusinessId,
          name: 'Main Branch',
          code: 'MAIN',
          is_default: true,
          status: 'active',
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
      return { success: false, message: 'Business selection or new business name is required.' };
    }

    // 2. Location publishing gate
    if (input.isPublished) {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: input.addressPublic,
        city: input.city,
        country: input.country,
        latitude: input.latitude,
        longitude: input.longitude,
      });

      if (!isLocComplete) {
        return {
          success: false,
          message: 'Venue cannot be published because valid address, city, and coordinates (latitude/longitude) are required.',
        };
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
      return { success: false, message: 'This venue URL slug is already taken by another venue.' };
    }

    const payload = {
      business_id: targetBusinessId,
      slug: normalizedSlug,
      display_name: input.displayName.trim(),
      short_description: input.shortDescription || null,
      description: input.description || null,
      venue_type: input.venueType || 'restaurant',
      logo_url: input.logoUrl || null,
      cover_image_url: input.coverImageUrl || null,
      phone_public: input.phonePublic || null,
      email_public: input.emailPublic || null,
      website_url: input.websiteUrl || null,
      address_public: input.addressPublic || null,
      city: input.city.trim(),
      country: input.country || 'US',
      latitude: input.latitude != null ? input.latitude : null,
      longitude: input.longitude != null ? input.longitude : null,
      price_level: input.priceLevel || 2,
      is_published: Boolean(input.isPublished),
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
      return { success: false, message: `Failed to save venue profile: ${error?.message || 'Database error'}` };
    }

    // Record audit log
    await this.recordAdminAction({
      actorId,
      action: input.isPublished ? 'venue.created_and_published' : 'venue.created',
      targetType: 'venue_public_profile',
      targetId: upserted.id,
      businessId: targetBusinessId,
      payload: { displayName: input.displayName, slug: normalizedSlug, isPublished: input.isPublished },
    });

    return {
      success: true,
      message: input.isPublished ? 'Venue created & published live!' : 'Venue draft created successfully!',
      venueId: upserted.id,
      slug: upserted.slug,
    };
  }

  /**
   * Super Admin Update Venue details.
   */
  static async updateVenue(
    venueId: string,
    input: Partial<CreateAdminVenuePayload>,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', venueId)
      .single();

    if (!existing) {
      return { success: false, message: 'Venue profile not found.' };
    }

    if (input.isPublished) {
      const isLocComplete = isVenueLocationComplete({
        addressPublic: input.addressPublic !== undefined ? input.addressPublic : existing.address_public,
        city: input.city !== undefined ? input.city : existing.city,
        country: input.country !== undefined ? input.country : existing.country,
        latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
        longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
      });

      if (!isLocComplete) {
        return {
          success: false,
          message: 'Venue cannot be published because valid address, city, and coordinates (latitude/longitude) are required.',
        };
      }
    }

    const normalizedSlug = input.slug ? normalizeVenueSlug(input.slug) : undefined;
    if (normalizedSlug) {
      const { data: existingSlug } = await admin
        .from('venue_public_profiles')
        .select('id, business_id')
        .eq('slug', normalizedSlug)
        .maybeSingle();

      if (existingSlug && existingSlug.id !== venueId) {
        return { success: false, message: 'This venue URL slug is already taken.' };
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.displayName !== undefined) updates.display_name = input.displayName.trim();
    if (normalizedSlug !== undefined) updates.slug = normalizedSlug;
    if (input.venueType !== undefined) updates.venue_type = input.venueType;
    if (input.shortDescription !== undefined) updates.short_description = input.shortDescription || null;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.logoUrl !== undefined) updates.logo_url = input.logoUrl || null;
    if (input.coverImageUrl !== undefined) updates.cover_image_url = input.coverImageUrl || null;
    if (input.phonePublic !== undefined) updates.phone_public = input.phonePublic || null;
    if (input.emailPublic !== undefined) updates.email_public = input.emailPublic || null;
    if (input.websiteUrl !== undefined) updates.website_url = input.websiteUrl || null;
    if (input.addressPublic !== undefined) updates.address_public = input.addressPublic || null;
    if (input.city !== undefined) updates.city = input.city.trim();
    if (input.country !== undefined) updates.country = input.country;
    if (input.latitude !== undefined) updates.latitude = input.latitude;
    if (input.longitude !== undefined) updates.longitude = input.longitude;
    if (input.priceLevel !== undefined) updates.price_level = input.priceLevel;
    if (input.isPublished !== undefined) updates.is_published = input.isPublished;
    if (input.isAcceptingOrders !== undefined) updates.is_accepting_orders = input.isAcceptingOrders;
    if (input.featuredBranchId !== undefined) updates.featured_branch_id = input.featuredBranchId || null;
    if (input.bookingUrl !== undefined) updates.booking_url = input.bookingUrl || null;
    if (input.agodaUrl !== undefined) updates.agoda_url = input.agodaUrl || null;
    if (input.externalBookingUrl !== undefined) updates.external_booking_url = input.externalBookingUrl || null;

    const { error } = await admin.from('venue_public_profiles').update(updates).eq('id', venueId);
    if (error) {
      return { success: false, message: `Failed to update venue: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: 'venue.updated',
      targetType: 'venue_public_profile',
      targetId: venueId,
      businessId: existing.business_id,
      payload: updates,
    });

    return { success: true, message: 'Venue updated successfully.' };
  }

  /**
   * Publication toggle (Publish / Unpublish).
   */
  static async togglePublish(
    venueId: string,
    isPublished: boolean,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', venueId)
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
        return {
          success: false,
          message: 'Venue cannot be published because branch coordinates (latitude/longitude) or address are missing.',
        };
      }
    }

    const { error } = await admin
      .from('venue_public_profiles')
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq('id', venueId);

    if (error) {
      return { success: false, message: `Failed to update status: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: isPublished ? 'venue.published' : 'venue.unpublished',
      targetType: 'venue_public_profile',
      targetId: venueId,
      businessId: profile.business_id,
      payload: { isPublished },
    });

    return {
      success: true,
      message: isPublished ? 'Venue is now live and published!' : 'Venue is unpublished and stored as draft.',
    };
  }

  /**
   * Venue Suspension.
   */
  static async suspendVenue(
    venueId: string,
    reason: string,
    actorId: string,
    actorEmail?: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', venueId)
      .single();

    if (!profile) {
      return { success: false, message: 'Venue profile not found.' };
    }

    // Update parent business status to suspended
    await admin
      .from('businesses')
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.business_id);

    // Also attempt updating venue profile columns if available
    try {
      await admin
        .from('venue_public_profiles')
        .update({
          is_suspended: true,
          suspension_reason: reason.trim() || 'Suspended by platform administrator',
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', venueId);
    } catch {
      // Gracefully continue if columns are pending migration
    }

    await this.recordAdminAction({
      actorId,
      action: 'venue.suspended',
      targetType: 'venue_public_profile',
      targetId: venueId,
      businessId: profile.business_id,
      payload: { reason, actorEmail },
    });

    return { success: true, message: 'Venue suspended successfully.' };
  }

  /**
   * Venue Reactivation.
   */
  static async reactivateVenue(
    venueId: string,
    actorId: string,
    actorEmail?: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', venueId)
      .single();

    if (!profile) {
      return { success: false, message: 'Venue profile not found.' };
    }

    // Reactivate parent business
    await admin
      .from('businesses')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.business_id);

    // Also attempt resetting venue profile suspension columns
    try {
      await admin
        .from('venue_public_profiles')
        .update({
          is_suspended: false,
          suspension_reason: null,
          suspended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', venueId);
    } catch {
      // Gracefully continue
    }

    await this.recordAdminAction({
      actorId,
      action: 'venue.reactivated',
      targetType: 'venue_public_profile',
      targetId: venueId,
      businessId: profile.business_id,
      payload: { actorEmail },
    });

    return { success: true, message: 'Venue reactivated successfully.' };
  }

  /**
   * Business Management: List businesses with owner info & branch count.
   */
  static async listBusinesses(params: { query?: string; status?: string; isPilot?: boolean; page?: number; limit?: number } = {}) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 15;
    const offset = (page - 1) * limit;

    let query = admin
      .from('businesses')
      .select('*, branches(id, status), business_memberships(id, role, user_id)', { count: 'exact' });

    if (params.query && params.query.trim()) {
      const q = `%${params.query.trim().toLowerCase()}%`;
      query = query.or(`name.ilike.${q},slug.ilike.${q}`);
    }

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params.isPilot !== undefined) {
      query = query.eq('is_pilot_demo', params.isPilot);
    }

    const { data: businesses, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !businesses) {
      return { businesses: [], total: 0, page, limit, totalPages: 0 };
    }

    // Resolve owner details
    const ownerUserIds = businesses.map((b) => b.created_by).filter(Boolean);
    const { data: ownerProfiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', ownerUserIds.length > 0 ? ownerUserIds : ['none']);

    const ownerMap: Record<string, string> = {};
    (ownerProfiles || []).forEach((p) => {
      ownerMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Owner';
    });

    const formatted = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      businessType: b.business_type,
      countryCode: b.country_code,
      defaultCurrency: b.default_currency,
      status: b.status,
      isPilotDemo: Boolean(b.is_pilot_demo),
      branchCount: (b.branches || []).length,
      memberCount: (b.business_memberships || []).length,
      ownerName: ownerMap[b.created_by] || 'Business Owner',
      createdAt: b.created_at,
    }));

    const total = count || formatted.length;
    const totalPages = Math.ceil(total / limit);

    return {
      businesses: formatted,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Business Management: Get Business Details by ID.
   */
  static async getBusinessById(businessId: string) {
    const admin = createAdminClient();

    const { data: biz, error } = await admin
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .maybeSingle();

    if (error || !biz) return null;

    const [
      { data: branches },
      { data: memberships },
      { data: venueProfile },
      { data: ownerProfile },
    ] = await Promise.all([
      admin.from('branches').select('*').eq('business_id', businessId).is('deleted_at', null).order('is_default', { ascending: false }),
      admin.from('business_memberships').select('*, user_profiles(id, first_name, last_name, account_status)').eq('business_id', businessId),
      admin.from('venue_public_profiles').select('*').eq('business_id', businessId).maybeSingle(),
      admin.from('user_profiles').select('id, first_name, last_name').eq('id', biz.created_by).maybeSingle(),
    ]);

    return {
      ...biz,
      ownerName: ownerProfile ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ') : 'Owner',
      branches: branches || [],
      memberships: memberships || [],
      venueProfile: venueProfile || null,
    };
  }

  /**
   * Business Management: Toggle Business Status (Active / Suspended / Archived).
   */
  static async toggleBusinessStatus(
    businessId: string,
    status: 'active' | 'suspended' | 'archived',
    reason: string,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { error } = await admin
      .from('businesses')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', businessId);

    if (error) {
      return { success: false, message: `Failed to update business status: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: `business.status_${status}`,
      targetType: 'business',
      targetId: businessId,
      businessId,
      payload: { status, reason },
    });

    return { success: true, message: `Business status updated to ${status}.` };
  }

  /**
   * Branch Management: Cross-business Branch List.
   */
  static async listBranches(params: { query?: string; status?: string; page?: number; limit?: number } = {}) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = admin
      .from('branches')
      .select('*, businesses(id, name, slug, is_pilot_demo)', { count: 'exact' })
      .is('deleted_at', null);

    if (params.query && params.query.trim()) {
      const q = `%${params.query.trim().toLowerCase()}%`;
      query = query.or(`name.ilike.${q},code.ilike.${q},city.ilike.${q}`);
    }

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    const { data: branches, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !branches) {
      return { branches: [], total: 0, page, limit, totalPages: 0 };
    }

    const formatted = branches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      businessId: b.business_id,
      businessName: b.businesses?.name || 'Business',
      isPilot: Boolean(b.businesses?.is_pilot_demo),
      city: b.city || null,
      countryCode: b.country_code,
      status: b.status,
      isDefault: Boolean(b.is_default),
      hasCoordinates: b.latitude != null && b.longitude != null,
      latitude: b.latitude != null ? Number(b.latitude) : null,
      longitude: b.longitude != null ? Number(b.longitude) : null,
      createdAt: b.created_at,
    }));

    const total = count || formatted.length;
    const totalPages = Math.ceil(total / limit);

    return {
      branches: formatted,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * User Management: Platform User Directory.
   */
  static async listUsers(params: { query?: string; status?: string; isSuperAdminOnly?: boolean; page?: number; limit?: number } = {}) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = admin.from('user_profiles').select('*', { count: 'exact' });

    if (params.query && params.query.trim()) {
      const q = `%${params.query.trim().toLowerCase()}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q}`);
    }

    if (params.status && params.status !== 'all') {
      query = query.eq('account_status', params.status);
    }

    if (params.isSuperAdminOnly) {
      query = query.eq('is_super_admin', true);
    }

    const { data: profiles, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !profiles) {
      return { users: [], total: 0, page, limit, totalPages: 0 };
    }

    // Fetch auth emails safely via admin client
    const userIds = profiles.map((p) => p.id);
    const emailMap: Record<string, string> = {};
    for (const uid of userIds) {
      const { data: authUser } = await admin.auth.admin.getUserById(uid);
      if (authUser?.user?.email) {
        emailMap[uid] = authUser.user.email;
      }
    }

    const formatted = profiles.map((p) => ({
      id: p.id,
      email: emailMap[p.id] || 'No Email',
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'User',
      accountStatus: p.account_status,
      onboardingIntent: p.onboarding_intent || null,
      isSuperAdmin: Boolean(p.is_super_admin),
      createdAt: p.created_at,
    }));

    const total = count || formatted.length;
    const totalPages = Math.ceil(total / limit);

    return {
      users: formatted,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * User Management: Toggle User Account Status (Active / Suspended / Deactivated).
   */
  static async toggleUserStatus(
    userId: string,
    status: 'active' | 'suspended' | 'deactivated',
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { error } = await admin
      .from('user_profiles')
      .update({ account_status: status, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return { success: false, message: `Failed to update user status: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: `user.status_${status}`,
      targetType: 'user_profile',
      targetId: userId,
      payload: { status },
    });

    return { success: true, message: `User account status updated to ${status}.` };
  }

  /**
   * Super Admin Governance: List Super Admins.
   */
  static async listSuperAdmins() {
    const admin = createAdminClient();

    const { data: admins, error } = await admin
      .from('user_profiles')
      .select('*')
      .eq('is_super_admin', true)
      .order('created_at', { ascending: true });

    if (error || !admins) return [];

    const formatted = [];
    for (const a of admins) {
      const { data: authUser } = await admin.auth.admin.getUserById(a.id);
      formatted.push({
        id: a.id,
        email: authUser?.user?.email || 'N/A',
        name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Super Admin',
        accountStatus: a.account_status,
        createdAt: a.created_at,
      });
    }

    return formatted;
  }

  /**
   * Super Admin Governance: Grant Super Admin privilege.
   */
  static async grantSuperAdmin(
    targetEmailOrId: string,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();
    const query = targetEmailOrId.trim();

    let targetUserId = query;

    // If query looks like an email, lookup auth user
    if (query.includes('@')) {
      const { data: usersData } = await admin.auth.admin.listUsers();
      const match = usersData?.users?.find((u) => u.email?.toLowerCase() === query.toLowerCase());
      if (!match) {
        return { success: false, message: `No user found with email "${query}". User must register first.` };
      }
      targetUserId = match.id;
    }

    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, is_super_admin')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: 'User profile not found.' };
    }

    if (profile.is_super_admin) {
      return { success: true, message: 'User is already a Super Admin.' };
    }

    const { error } = await admin
      .from('user_profiles')
      .update({ is_super_admin: true, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (error) {
      return { success: false, message: `Failed to grant Super Admin status: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: 'super_admin.granted',
      targetType: 'user_profile',
      targetId: targetUserId,
      payload: { targetUserId },
    });

    return { success: true, message: 'Super Admin status granted successfully.' };
  }

  /**
   * Super Admin Governance: Revoke Super Admin privilege with final-admin protection.
   */
  static async revokeSuperAdmin(
    targetUserId: string,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    // Prevent self-lockout or removing final super admin
    const { count: superAdminCount } = await admin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_super_admin', true);

    if ((superAdminCount || 0) <= 1) {
      return { success: false, message: 'Safety violation: Cannot revoke the final remaining platform Super Admin.' };
    }

    if (targetUserId === actorId) {
      return { success: false, message: 'Safety violation: You cannot revoke your own Super Admin access.' };
    }

    const { error } = await admin
      .from('user_profiles')
      .update({ is_super_admin: false, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (error) {
      return { success: false, message: `Failed to revoke Super Admin status: ${error.message}` };
    }

    await this.recordAdminAction({
      actorId,
      action: 'super_admin.revoked',
      targetType: 'user_profile',
      targetId: targetUserId,
      payload: { targetUserId },
    });

    return { success: true, message: 'Super Admin status revoked successfully.' };
  }

  /**
   * Pilot / Demo Venues Portal: List pilot records.
   */
  static async listPilotVenues() {
    const admin = createAdminClient();

    const { data: pilotBusinesses, error } = await admin
      .from('businesses')
      .select('*, branches(*), venue_public_profiles(*)')
      .eq('is_pilot_demo', true)
      .order('created_at', { ascending: false });

    if (error || !pilotBusinesses) return [];

    return pilotBusinesses.map((b) => {
      const v = Array.isArray(b.venue_public_profiles) ? b.venue_public_profiles[0] : b.venue_public_profiles;
      return {
        businessId: b.id,
        businessName: b.name,
        slug: b.slug,
        status: b.status,
        branchCount: (b.branches || []).length,
        venueId: v?.id || null,
        venueDisplayName: v?.display_name || b.name,
        venueSlug: v?.slug || null,
        isPublished: Boolean(v?.is_published),
        isLocationComplete: v ? isVenueLocationComplete(v) : false,
        createdAt: b.created_at,
      };
    });
  }

  /**
   * Pilot Initialization wrapper.
   */
  static async initializePilotVenue(
    input: {
      businessName: string;
      venueDisplayName: string;
      venueType: VenueType;
      city: string;
      country: string;
      latitude: number;
      longitude: number;
      template: 'resort' | 'restaurant' | 'cafe';
      isPublished?: boolean;
    },
    actorId: string
  ) {
    const result = await PilotOnboardingService.initializePilot(input, actorId);

    if (result.success && result.businessId) {
      await this.recordAdminAction({
        actorId,
        action: 'pilot.initialized',
        targetType: 'business',
        targetId: result.businessId,
        businessId: result.businessId,
        payload: { venueDisplayName: input.venueDisplayName, template: input.template, isPublished: input.isPublished },
      });
    }

    return result;
  }

  /**
   * Audit Logs: Explorer list with multi-column filtering.
   */
  static async listAuditLogs(params: {
    action?: string;
    targetType?: string;
    actorId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const admin = createAdminClient();
    const page = params.page || 1;
    const limit = params.limit || 25;
    const offset = (page - 1) * limit;

    let query = admin.from('audit_logs').select('*, businesses(name)', { count: 'exact' });

    if (params.action && params.action.trim()) {
      query = query.ilike('action', `%${params.action.trim()}%`);
    }

    if (params.targetType && params.targetType.trim()) {
      query = query.eq('target_type', params.targetType.trim());
    }

    if (params.actorId && params.actorId.trim()) {
      query = query.eq('actor_id', params.actorId.trim());
    }

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !logs) {
      return { logs: [], total: 0, page, limit, totalPages: 0 };
    }

    // Resolve actor names
    const actorIds = Array.from(new Set(logs.map((l) => l.actor_id).filter(Boolean))) as string[];
    const actorMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await admin.from('user_profiles').select('id, first_name, last_name').in('id', actorIds);
      (profiles || []).forEach((p) => {
        actorMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Admin User';
      });
    }

    const formatted = logs.map((l) => ({
      id: l.id,
      action: l.action,
      targetType: l.target_type,
      targetId: l.target_id,
      businessId: l.business_id,
      businessName: l.businesses?.name || null,
      actorId: l.actor_id,
      actorName: (l.actor_id && actorMap[l.actor_id]) || 'Platform System / Super Admin',
      payload: l.payload as Record<string, unknown> | null,
      createdAt: l.created_at,
    }));

    const total = count || formatted.length;
    const totalPages = Math.ceil(total / limit);

    return {
      logs: formatted,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Helper to insert structured audit log entry.
   */
  static async recordAdminAction(params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    businessId?: string | null;
    payload?: Record<string, unknown>;
  }) {
    try {
      const admin = createAdminClient();
      await admin.from('audit_logs').insert({
        actor_id: params.actorId,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId,
        business_id: params.businessId || null,
        payload: params.payload || {},
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[SuperAdminService.recordAdminAction] Error:', err);
    }
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '../auth/super-admin';
import {
  SuperAdminService,
  CreateAdminVenuePayload,
  AdminVenueFilterParams,
} from '../services/super-admin.service';
import { VenueType } from '@/lib/validation/venue';

// ── Overview ─────────────────────────────────────────────────────────────────

export async function getAdminOverviewAction() {
  await requireSuperAdmin();
  const data = await SuperAdminService.getPlatformOverview();
  return { success: true, data };
}

// ── Venues ───────────────────────────────────────────────────────────────────

export async function listAdminVenuesAction(params: AdminVenueFilterParams = {}) {
  await requireSuperAdmin();
  const result = await SuperAdminService.listVenues(params);
  return { success: true, ...result };
}

export async function getAdminVenueDetailAction(venueId: string) {
  await requireSuperAdmin();
  const venue = await SuperAdminService.getVenueById(venueId);
  if (!venue) {
    return { success: false, message: 'Venue not found.', venue: null };
  }
  return { success: true, venue };
}

export async function createAdminVenueAction(input: CreateAdminVenuePayload | FormData) {
  const { user } = await requireSuperAdmin();
  let payload: CreateAdminVenuePayload;

  if (typeof (input as FormData)?.get === 'function') {
    const fd = input as FormData;
    const logoFile = fd.get('logoFile') as File | null;
    const coverFile = fd.get('coverFile') as File | null;
    const latStr = fd.get('latitude') as string | null;
    const lngStr = fd.get('longitude') as string | null;
    const priceStr = fd.get('priceLevel') as string | null;

    payload = {
      businessId: (fd.get('businessId') as string) || undefined,
      newBusinessName: (fd.get('newBusinessName') as string) || undefined,
      displayName: (fd.get('displayName') as string) || '',
      slug: (fd.get('slug') as string) || undefined,
      venueType: ((fd.get('venueType') as string) || 'restaurant') as VenueType,
      shortDescription: (fd.get('shortDescription') as string) || undefined,
      description: (fd.get('description') as string) || undefined,
      logoUrl: (fd.get('logoUrl') as string) || undefined,
      coverImageUrl: (fd.get('coverImageUrl') as string) || undefined,
      logoFile: logoFile && logoFile.size > 0 ? logoFile : null,
      coverFile: coverFile && coverFile.size > 0 ? coverFile : null,
      phonePublic: (fd.get('phonePublic') as string) || undefined,
      emailPublic: (fd.get('emailPublic') as string) || undefined,
      websiteUrl: (fd.get('websiteUrl') as string) || undefined,
      addressPublic: (fd.get('addressPublic') as string) || undefined,
      city: (fd.get('city') as string) || '',
      country: (fd.get('country') as string) || 'US',
      latitude: latStr && latStr.trim() !== '' ? Number(latStr) : null,
      longitude: lngStr && lngStr.trim() !== '' ? Number(lngStr) : null,
      priceLevel: priceStr ? parseInt(priceStr, 10) : 2,
      isPublished: fd.get('isPublished') === 'true',
      isAcceptingOrders: fd.get('isAcceptingOrders') !== 'false',
      isPilotDemo: fd.get('isPilotDemo') === 'true',
      featuredBranchId: (fd.get('featuredBranchId') as string) || undefined,
      bookingUrl: (fd.get('bookingUrl') as string) || undefined,
      agodaUrl: (fd.get('agodaUrl') as string) || undefined,
      externalBookingUrl: (fd.get('externalBookingUrl') as string) || undefined,
    };
  } else {
    payload = input as CreateAdminVenuePayload;
  }

  const result = await SuperAdminService.createVenue(payload, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath('/admin/businesses');
    revalidatePath('/admin/pilot');
    revalidatePath('/explore');
    if (result.slug) revalidatePath(`/venues/${result.slug}`);
  }

  return result;
}

export async function updateAdminVenueAction(venueId: string, input: Partial<CreateAdminVenuePayload>) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.updateVenue(venueId, input, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath('/explore');
    if (input.slug) revalidatePath(`/venues/${input.slug}`);
  }

  return result;
}

export async function toggleAdminPublishAction(venueId: string, isPublished: boolean) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.togglePublish(venueId, isPublished, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath('/explore');
  }

  return result;
}

export async function suspendAdminVenueAction(venueId: string, reason: string) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.suspendVenue(venueId, reason, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath('/explore');
  }

  return result;
}

export async function reactivateAdminVenueAction(venueId: string) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.reactivateVenue(venueId, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath('/explore');
  }

  return result;
}

// ── Businesses ───────────────────────────────────────────────────────────────

export async function listAdminBusinessesAction(params: { query?: string; status?: string; isPilot?: boolean; page?: number; limit?: number } = {}) {
  await requireSuperAdmin();
  const result = await SuperAdminService.listBusinesses(params);
  return { success: true, ...result };
}

export async function getAdminBusinessDetailAction(businessId: string) {
  await requireSuperAdmin();
  const business = await SuperAdminService.getBusinessById(businessId);
  if (!business) {
    return { success: false, message: 'Business not found.', business: null };
  }
  return { success: true, business };
}

export async function toggleAdminBusinessStatusAction(
  businessId: string,
  status: 'active' | 'suspended' | 'archived',
  reason: string
) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.toggleBusinessStatus(businessId, status, reason, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/businesses');
    revalidatePath(`/admin/businesses/${businessId}`);
    revalidatePath('/admin/venues');
    revalidatePath('/explore');
  }

  return result;
}

// ── Branches ─────────────────────────────────────────────────────────────────

export async function listAdminBranchesAction(params: { query?: string; status?: string; page?: number; limit?: number } = {}) {
  await requireSuperAdmin();
  const result = await SuperAdminService.listBranches(params);
  return { success: true, ...result };
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function listAdminUsersAction(params: { query?: string; status?: string; isSuperAdminOnly?: boolean; page?: number; limit?: number } = {}) {
  await requireSuperAdmin();
  const result = await SuperAdminService.listUsers(params);
  return { success: true, ...result };
}

export async function toggleAdminUserStatusAction(userId: string, status: 'active' | 'suspended' | 'deactivated') {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.toggleUserStatus(userId, status, user.id);

  if (result.success) {
    revalidatePath('/admin/users');
  }

  return result;
}

// ── Super Admins ─────────────────────────────────────────────────────────────

export async function listSuperAdminsAction() {
  await requireSuperAdmin();
  const admins = await SuperAdminService.listSuperAdmins();
  return { success: true, data: admins };
}

export async function grantSuperAdminAction(targetEmailOrId: string) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.grantSuperAdmin(targetEmailOrId, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/super-admins');
    revalidatePath('/admin/users');
  }

  return result;
}

export async function revokeSuperAdminAction(targetUserId: string) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.revokeSuperAdmin(targetUserId, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/super-admins');
    revalidatePath('/admin/users');
  }

  return result;
}

// ── Pilot / Demo ─────────────────────────────────────────────────────────────

export async function listPilotVenuesAction() {
  await requireSuperAdmin();
  const pilotVenues = await SuperAdminService.listPilotVenues();
  return { success: true, data: pilotVenues };
}

export async function initializePilotVenueAction(input: {
  businessName: string;
  venueDisplayName: string;
  venueType: VenueType;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  template: 'resort' | 'restaurant' | 'cafe';
  isPublished?: boolean;
}) {
  const { user } = await requireSuperAdmin();
  const result = await SuperAdminService.initializePilotVenue(input, user.id);

  if (result.success) {
    revalidatePath('/admin');
    revalidatePath('/admin/venues');
    revalidatePath('/admin/businesses');
    revalidatePath('/admin/pilot');
    revalidatePath('/admin/launch-readiness');
  }

  return result;
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export async function listAdminAuditLogsAction(params: {
  action?: string;
  targetType?: string;
  actorId?: string;
  page?: number;
  limit?: number;
} = {}) {
  await requireSuperAdmin();
  const result = await SuperAdminService.listAuditLogs(params);
  return { success: true, ...result };
}

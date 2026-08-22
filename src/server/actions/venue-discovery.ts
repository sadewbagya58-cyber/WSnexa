'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueProfileService } from '@/server/services/venue-profile.service';
import { VenueFavoriteService } from '@/server/services/venue-favorite.service';
import { VenueReviewService } from '@/server/services/venue-review.service';
import { ActionResponse } from './auth';
import {
  VenueProfileInput,
  VenueSearchQuery,
  CreateReviewInput,
  UpdateReviewInput,
  OwnerReviewResponseInput,
} from '@/lib/validation/venue';
import { CUSTOMER_FAVORITE_INTENT_COOKIE, FavoriteIntentData } from '@/lib/constants/customer-favorite';

/**
 * Public search venues.
 */
export async function searchVenuesAction(query: VenueSearchQuery) {
  return await VenueDiscoveryService.searchVenues(query);
}

/**
 * Get venue public profile by slug.
 */
export async function getVenueBySlugAction(slug: string) {
  return await VenueDiscoveryService.getVenueBySlug(slug);
}

/**
 * B2B Business Owner / Manager Upsert Venue Profile Action.
 */
export async function upsertVenueProfileAction(
  input: VenueProfileInput
): Promise<ActionResponse> {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Active business workspace required.' };
  }

  const hasPerm = await can({
    context: authContext,
    permission: 'venue_profile.manage',
  });

  if (!hasPerm) {
    return { success: false, message: 'Forbidden: You do not have permission to manage the venue profile.' };
  }

  const result = await VenueProfileService.upsertProfile(authContext.businessId, input);

  if (result.success) {
    revalidatePath('/dashboard/venue-profile');
    revalidatePath('/explore');
    revalidatePath(`/venues/${input.slug}`);
  }

  return result;
}

/**
 * Toggle Publish / Unpublish Status.
 */
export async function toggleVenuePublishedStatusAction(isPublished: boolean): Promise<ActionResponse> {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Active business workspace required.' };
  }

  const hasPerm = await can({
    context: authContext,
    permission: 'venue_profile.manage',
  });

  if (!hasPerm) {
    return { success: false, message: 'Forbidden: You do not have permission to manage venue publication.' };
  }

  const result = await VenueProfileService.setPublishedStatus(authContext.businessId, isPublished);

  if (result.success) {
    revalidatePath('/dashboard/venue-profile');
    revalidatePath('/explore');
  }

  return result;
}

/**
 * Toggle Favorite Venue for Authenticated Customer.
 */
export async function toggleFavoriteVenueAction(
  venueProfileId: string
): Promise<ActionResponse<{ isFavorite: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'AUTHENTICATION_REQUIRED',
    };
  }

  const res = await VenueFavoriteService.toggleFavorite(user.id, venueProfileId);

  if (res.success) {
    revalidatePath('/customer/favorites');
    revalidatePath('/explore');
  }

  return {
    success: res.success,
    message: res.message,
    data: { isFavorite: res.isFavorite },
  };
}

/**
 * Store Anonymous Favorite Intent Cookie.
 */
export async function storeFavoriteIntentAction(venueProfileId: string, returnUrl?: string) {
  try {
    const cookieStore = await cookies();
    const payload: FavoriteIntentData = {
      venueProfileId,
      returnUrl,
      createdAt: new Date().toISOString(),
    };

    cookieStore.set(CUSTOMER_FAVORITE_INTENT_COOKIE, JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 minutes
      path: '/',
    });
  } catch {
    // Outside request scope guard for test environments
  }

  return { success: true };
}

/**
 * Execute pending favorite intent cookie after login/registration.
 */
export async function executePendingFavoriteIntentAction(): Promise<{
  executed: boolean;
  saved?: boolean;
  returnUrl?: string;
}> {
  try {
    const cookieStore = await cookies();
    const intentCookie = cookieStore.get(CUSTOMER_FAVORITE_INTENT_COOKIE);

    if (!intentCookie || !intentCookie.value) {
      return { executed: false };
    }

    const data: FavoriteIntentData = JSON.parse(intentCookie.value);
    cookieStore.delete(CUSTOMER_FAVORITE_INTENT_COOKIE);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && data.venueProfileId) {
      await VenueFavoriteService.toggleFavorite(user.id, data.venueProfileId);
      return {
        executed: true,
        saved: true,
        returnUrl: data.returnUrl,
      };
    }
  } catch {
    // Outside request scope guard for test environments
  }

  return { executed: false };
}

/**
 * Check customer review eligibility for a venue.
 */
export async function checkReviewEligibilityAction(venueProfileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { eligible: false, reason: 'Please log in to submit a review.' };
  }

  return await VenueReviewService.checkEligibility(user.id, venueProfileId);
}

/**
 * Create Verified Review.
 */
export async function createReviewAction(input: CreateReviewInput): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Please log in to submit a review.' };

  const result = await VenueReviewService.createReview(user.id, input);

  if (result.success) {
    revalidatePath('/customer/reviews');
    revalidatePath('/explore');
  }

  return result;
}

/**
 * Update Customer Review.
 */
export async function updateReviewAction(input: UpdateReviewInput): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.' };

  const result = await VenueReviewService.updateReview(user.id, input);

  if (result.success) {
    revalidatePath('/customer/reviews');
  }

  return result;
}

/**
 * Delete Customer Review.
 */
export async function deleteReviewAction(reviewId: string): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.' };

  const result = await VenueReviewService.deleteReview(user.id, reviewId);

  if (result.success) {
    revalidatePath('/customer/reviews');
  }

  return result;
}

/**
 * Owner / Manager Response to Review (`/dashboard/reviews`).
 */
export async function respondToReviewAction(input: OwnerReviewResponseInput): Promise<ActionResponse> {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Active business workspace required.' };
  }

  const hasPerm = await can({
    context: authContext,
    permission: 'reviews.respond',
  });

  if (!hasPerm) {
    return { success: false, message: 'Forbidden: You do not have permission to respond to reviews.' };
  }

  const result = await VenueReviewService.respondToReview(authContext.businessId, authContext.userId, input);

  if (result.success) {
    revalidatePath('/dashboard/reviews');
  }

  return result;
}

/**
 * Upload Venue Logo or Cover Photo Action.
 */
export async function uploadVenueImageAction(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  publicUrl?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized. Please log in.' };

  const file = formData.get('file') as File | null;
  const imageType = (formData.get('imageType') as string) || 'logo';

  if (!file) {
    return { success: false, message: 'No image file provided.' };
  }

  if (imageType !== 'logo' && imageType !== 'cover') {
    return { success: false, message: 'Invalid image category.' };
  }

  const { resolveActiveBusinessContext } = await import('@/server/tenant/resolver');
  const context = await resolveActiveBusinessContext();

  if (!context) {
    return { success: false, message: 'Active business context required.' };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { VenueMediaService } = await import('@/server/services/venue-media.service');

  const res = await VenueMediaService.uploadImage({
    userId: user.id,
    businessId: context.business.id,
    imageType,
    fileBuffer: buffer,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
  });

  if (res.success) {
    revalidatePath('/dashboard/venue-profile');
    revalidatePath('/explore');
    if (context.business.slug) {
      revalidatePath(`/venues/${context.business.slug}`);
    }
  }

  return res;
}

/**
 * Remove Venue Logo or Cover Photo Action.
 */
export async function removeVenueImageAction(imageType: 'logo' | 'cover'): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.' };

  const { resolveActiveBusinessContext } = await import('@/server/tenant/resolver');
  const context = await resolveActiveBusinessContext();

  if (!context) {
    return { success: false, message: 'Active business context required.' };
  }

  const { VenueMediaService } = await import('@/server/services/venue-media.service');
  const res = await VenueMediaService.removeImage(user.id, context.business.id, imageType);

  if (res.success) {
    revalidatePath('/dashboard/venue-profile');
    revalidatePath('/explore');
    if (context.business.slug) {
      revalidatePath(`/venues/${context.business.slug}`);
    }
  }

  return res;
}


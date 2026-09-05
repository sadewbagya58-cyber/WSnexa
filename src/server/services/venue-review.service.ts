import { createAdminClient } from '@/lib/supabase/server';
import { CreateReviewInput, OwnerReviewResponseInput, UpdateReviewInput } from '@/lib/validation/venue';

export interface VenueReviewRecord {
  id: string;
  venue_profile_id: string;
  business_id: string;
  user_id: string;
  order_id: string;
  rating: number;
  review_text: string | null;
  status: string;
  is_verified_visit: boolean;
  owner_response: string | null;
  owner_responded_at: string | null;
  owner_responded_by: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  venue_name?: string;
  order_number_formatted?: string;
}

export interface ReviewEligibilityResult {
  eligible: boolean;
  reason?: string;
  eligibleOrderId?: string;
}

export class VenueReviewService {
  /**
   * Check if customer is eligible to review a venue profile.
   * Requirement: Authenticated customer + owns a claimed order for that venue + order status = 'completed' + order not already reviewed.
   */
  static async checkEligibility(userId: string, venueProfileId: string): Promise<ReviewEligibilityResult> {
    const admin = createAdminClient();

    // 1. Resolve venue profile to get business_id
    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('id, business_id')
      .eq('id', venueProfileId)
      .maybeSingle();

    if (!profile) {
      return { eligible: false, reason: 'Venue profile not found.' };
    }

    // 2. Find customer's completed claimed orders for this business
    const { data: eligibleOrders } = await admin
      .from('orders')
      .select('id, order_number_formatted, status')
      .eq('customer_user_id', userId)
      .eq('business_id', profile.business_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!eligibleOrders || eligibleOrders.length === 0) {
      return {
        eligible: false,
        reason: 'Reviews are available after a completed visit/order at this venue.',
      };
    }

    // 3. Check which order has NOT been reviewed yet
    const orderIds = eligibleOrders.map((o) => o.id);
    const { data: existingReviews } = await admin
      .from('venue_reviews')
      .select('order_id')
      .in('order_id', orderIds);

    const reviewedOrderIds = new Set((existingReviews || []).map((r) => r.order_id));
    const availableOrder = eligibleOrders.find((o) => !reviewedOrderIds.has(o.id));

    if (!availableOrder) {
      return {
        eligible: false,
        reason: 'You have already submitted a review for your visit to this venue.',
      };
    }

    return {
      eligible: true,
      eligibleOrderId: availableOrder.id,
    };
  }

  /**
   * Create a verified review. Derives business_id and venue_profile_id SERVER-SIDE from the verified order.
   */
  static async createReview(
    userId: string,
    input: CreateReviewInput
  ): Promise<{ success: boolean; message: string; data?: VenueReviewRecord }> {
    const admin = createAdminClient();

    // SECURITY VERIFICATION: Verify order exists, belongs to user, and is completed
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, customer_user_id, status, order_number_formatted')
      .eq('id', input.orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, message: 'Invalid or non-existent order ID.' };
    }

    if (order.customer_user_id !== userId) {
      return { success: false, message: 'Security check failed: You can only review your own claimed orders.' };
    }

    if (order.status !== 'completed') {
      return { success: false, message: 'Reviews can only be submitted for completed orders.' };
    }

    // Resolve venue profile from order's business_id (DO NOT TRUST CLIENT)
    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('id')
      .eq('business_id', order.business_id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: 'Venue profile not found for this business.' };
    }

    // Prevent duplicate review for same order
    const { data: existing } = await admin
      .from('venue_reviews')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existing) {
      return { success: false, message: 'A review has already been submitted for this order.' };
    }

    const { data: review, error } = await admin
      .from('venue_reviews')
      .insert({
        venue_profile_id: profile.id,
        business_id: order.business_id,
        user_id: userId,
        order_id: order.id,
        rating: input.rating,
        review_text: input.reviewText || null,
        status: 'published',
        is_verified_visit: true, // SERVER-ENFORCED BADGE
      })
      .select()
      .single();

    if (error || !review) {
      console.error('[VenueReviewService.createReview] Error:', error);
      return { success: false, message: error?.message || 'Failed to submit review.' };
    }

    return {
      success: true,
      message: 'Thank you! Your verified review has been published.',
      data: review as unknown as VenueReviewRecord,
    };
  }

  /**
   * Get published reviews for a venue profile.
   */
  static async getVenueReviews(venueProfileId: string): Promise<VenueReviewRecord[]> {
    const admin = createAdminClient();

    const { data: reviews, error } = await admin
      .from('venue_reviews')
      .select(`
        *,
        order:orders(order_number_formatted)
      `)
      .eq('venue_profile_id', venueProfileId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error || !reviews) return [];

    // Get author display names safely
    const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      profileMap[p.id] = fullName || 'Verified Customer';
    });

    return (reviews as unknown as Array<VenueReviewRecord & { order?: { order_number_formatted?: string } | null }>).map((r) => ({
      ...r,
      user_name: profileMap[r.user_id] || 'Verified Guest',
      order_number_formatted: r.order?.order_number_formatted || undefined,
    }));
  }

  /**
   * Get customer's submitted reviews (`/customer/reviews`).
   */
  static async getCustomerReviews(userId: string): Promise<VenueReviewRecord[]> {
    const admin = createAdminClient();

    const { data: reviews, error } = await admin
      .from('venue_reviews')
      .select(`
        *,
        venue:venue_public_profiles(display_name, slug),
        order:orders(order_number_formatted)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !reviews) return [];

    return (reviews as unknown as Array<VenueReviewRecord & { venue?: { display_name?: string; slug?: string } | null; order?: { order_number_formatted?: string } | null }>).map((r) => ({
      ...r,
      venue_name: r.venue?.display_name || 'WSNexa Venue',
      order_number_formatted: r.order?.order_number_formatted || undefined,
    }));
  }

  /**
   * Update customer review (text/rating only). Immutable fields (venue, order, user, verified) remain unchanged.
   */
  static async updateReview(
    userId: string,
    input: UpdateReviewInput
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('venue_reviews')
      .select('id, user_id')
      .eq('id', input.reviewId)
      .maybeSingle();

    if (!existing || existing.user_id !== userId) {
      return { success: false, message: 'Review not found or unauthorized.' };
    }

    const { error } = await admin
      .from('venue_reviews')
      .update({
        rating: input.rating,
        review_text: input.reviewText || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.reviewId);

    if (error) {
      return { success: false, message: 'Failed to update review.' };
    }

    return { success: true, message: 'Review updated successfully.' };
  }

  /**
   * Delete customer review.
   */
  static async deleteReview(userId: string, reviewId: string): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('venue_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .maybeSingle();

    if (!existing || existing.user_id !== userId) {
      return { success: false, message: 'Review not found or unauthorized.' };
    }

    const { error } = await admin.from('venue_reviews').delete().eq('id', reviewId);

    if (error) {
      return { success: false, message: 'Failed to delete review.' };
    }

    return { success: true, message: 'Review deleted successfully.' };
  }

  /**
   * Business owner/manager review response (`/dashboard/reviews`).
   */
  static async respondToReview(
    businessId: string,
    actorUserId: string,
    input: OwnerReviewResponseInput
  ): Promise<{ success: boolean; message: string }> {
    const admin = createAdminClient();

    const { data: review } = await admin
      .from('venue_reviews')
      .select('id, business_id')
      .eq('id', input.reviewId)
      .maybeSingle();

    if (!review || review.business_id !== businessId) {
      return { success: false, message: 'Review not found or unauthorized for your business.' };
    }

    const { error } = await admin
      .from('venue_reviews')
      .update({
        owner_response: input.response,
        owner_responded_at: new Date().toISOString(),
        owner_responded_by: actorUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.reviewId);

    if (error) {
      return { success: false, message: 'Failed to save response to review.' };
    }

    return { success: true, message: 'Response posted successfully!' };
  }

  /**
   * Get reviews for B2B Dashboard (`/dashboard/reviews`).
   */
  static async getBusinessReviews(businessId: string): Promise<VenueReviewRecord[]> {
    const admin = createAdminClient();

    const { data: reviews, error } = await admin
      .from('venue_reviews')
      .select(`
        *,
        order:orders(order_number_formatted)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error || !reviews) return [];

    const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
      profileMap[p.id] = fullName || 'Verified Customer';
    });

    return (reviews as unknown as Array<VenueReviewRecord & { order?: { order_number_formatted?: string } | null }>).map((r) => ({
      ...r,
      user_name: profileMap[r.user_id] || 'Verified Guest',
      order_number_formatted: r.order?.order_number_formatted || undefined,
    }));
  }
}

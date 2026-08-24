import { createAdminClient } from '@/lib/supabase/server';
import { AuthorizationContext } from '@/types/authorization.types';
import { can } from '@/server/auth/policy-engine';
import { maskEmail, maskPhone } from '@/lib/crm/crm-normalization';
import { UnifiedCustomerProfileDTO } from '@/lib/crm/crm-types';

export class CustomerProfileService {
  /**
   * Fetches the unified customer profile with aggregated order, loyalty, review, and activity metrics.
   * Intersects customer activity with the user's authorized branch reach.
   */
  static async getUnifiedCustomerProfile(
    customerId: string,
    businessId: string,
    authContext: AuthorizationContext
  ): Promise<UnifiedCustomerProfileDTO | null> {
    // 1. Authorization Guard
    if (!(await can({ context: authContext, permission: 'customers.view' }))) {
      return null;
    }

    // Business tenant isolation check
    if (authContext.businessId !== businessId) {
      return null;
    }

    const admin = createAdminClient();

    // 2. Fetch Customer Base Entity
    const { data: customer } = await admin
      .from('crm_customers')
      .select('*')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!customer) return null;

    // Determine contact detail permissions
    const canViewContact = await can({ context: authContext, permission: 'customers.contact_view' });

    // Determine property reach filter
    const targetBranchIds = authContext.authorizedBranchIds;
    const isFilteredByBranch = targetBranchIds !== null && targetBranchIds.length > 0;

    // 3. Batch concurrent queries for Orders, Loyalty, Reviews, and Consents
    const [ordersRes, loyaltyRes, reviewsRes, consentsRes, businessRes] = await Promise.all([
      // A. Customer Orders query
      (async () => {
        let query = admin
          .from('orders')
          .select('id, branch_id, status, total_cents, currency, created_at')
          .eq('business_id', businessId)
          .or(`crm_customer_id.eq.${customerId}${customer.auth_user_id ? `,customer_user_id.eq.${customer.auth_user_id}` : ''}`);

        if (isFilteredByBranch) {
          query = query.in('branch_id', targetBranchIds);
        }

        const { data } = await query;
        return data || [];
      })(),

      // B. Customer Loyalty Account query
      (async () => {
        if (!customer.auth_user_id) return null;
        const { data } = await admin
          .from('customer_loyalty_accounts')
          .select('points_balance, lifetime_points_earned, lifetime_points_redeemed, current_tier_id, loyalty_tiers(tier_name)')
          .eq('business_id', businessId)
          .eq('customer_user_id', customer.auth_user_id)
          .maybeSingle();
        return data;
      })(),

      // C. Customer Reviews query
      (async () => {
        if (!customer.auth_user_id) return [];
        const { data } = await admin
          .from('venue_reviews')
          .select('rating, created_at')
          .eq('business_id', businessId)
          .eq('user_id', customer.auth_user_id);
        return data || [];
      })(),

      // D. Consent Records query
      (async () => {
        const { data } = await admin
          .from('crm_consent_records')
          .select('channel, status, updated_at')
          .eq('business_id', businessId)
          .eq('crm_customer_id', customerId);
        return data || [];
      })(),

      // E. Business Currency query
      (async () => {
        const { data } = await admin
          .from('businesses')
          .select('default_currency')
          .eq('id', businessId)
          .single();
        return data;
      })(),
    ]);

    const currency = businessRes?.default_currency || 'USD';

    // 4. Calculate Activity Aggregates (using canonical Phase 32 sales rules)
    const totalOrders = ordersRes.length;
    const completedOrders = ordersRes.filter((o) => o.status === 'completed');
    const completedCount = completedOrders.length;
    const totalSpendCents = completedOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
    const aovCents = completedCount > 0 ? Math.round(totalSpendCents / completedCount) : 0;

    const visitedBranchIds = new Set(ordersRes.map((o) => o.branch_id));
    const sortedOrders = [...ordersRes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastOrderAt = sortedOrders[0]?.created_at || null;

    // 5. Calculate Loyalty Aggregates
    const pointsBalance = loyaltyRes?.points_balance || 0;
    const lifetimePointsEarned = loyaltyRes?.lifetime_points_earned || 0;
    const lifetimePointsRedeemed = loyaltyRes?.lifetime_points_redeemed || 0;
    const tierName =
      (loyaltyRes?.loyalty_tiers as unknown as { tier_name?: string })?.tier_name || null;

    // 6. Calculate Review Aggregates
    const reviewCount = reviewsRes.length;
    const avgRatingGiven =
      reviewCount > 0
        ? Number((reviewsRes.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount).toFixed(1))
        : null;
    const sortedReviews = [...reviewsRes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastReviewAt = sortedReviews[0]?.created_at || null;

    // 7. Format Contact Details with Privacy Masking
    const emailMasked = maskEmail(customer.email_normalized);
    const phoneMasked = maskPhone(customer.phone_normalized);

    return {
      customerId: customer.id,
      businessId: customer.business_id,
      authUserId: customer.auth_user_id,
      identityType: customer.identity_type,
      displayName: customer.display_name || 'Guest Customer',
      emailMasked,
      phoneMasked,
      ...(canViewContact && {
        emailUnmasked: customer.email_normalized,
        phoneUnmasked: customer.phone_normalized,
      }),
      isAccountLinked: Boolean(customer.auth_user_id),
      firstSeenAt: customer.first_seen_at,
      lastSeenAt: customer.last_seen_at,
      activity: {
        totalOrders,
        completedOrders: completedCount,
        totalSpendCents,
        aovCents,
        branchesVisitedCount: visitedBranchIds.size,
        lastOrderAt,
        currency,
      },
      loyalty: {
        pointsBalance,
        lifetimePointsEarned,
        lifetimePointsRedeemed,
        tierName,
      },
      reviews: {
        reviewCount,
        avgRatingGiven,
        lastReviewAt,
      },
      topStats: {
        topOrderedItemName: null,
        topCategoryName: null,
        mostVisitedBranchName: null,
      },
      consents: consentsRes.map((c) => ({
        channel: c.channel,
        status: c.status,
        updatedAt: c.updated_at,
      })),
    };
  }
}

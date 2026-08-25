import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ActiveTenantContext } from '@/types';
import { startTimer, stopTimer, logPerformanceMetric } from '@/lib/performance/logger';

export const ACTIVE_BUSINESS_COOKIE = 'wsnexa_active_business';
export const ACTIVE_BRANCH_COOKIE = 'wsnexa_active_branch';

/**
 * Resolves current authenticated user from server session.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Fetches all active business memberships for a given user ID.
 */
export async function getUserBusinesses(userId: string) {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from('business_memberships')
    .select('*, businesses(*)')
    .eq('user_id', userId)
    .eq('membership_status', 'active');

  if (error || !memberships) {
    return [];
  }
  return memberships;
}

/**
 * Validates that current user holds an active membership in the specified business.
 */
export async function requireBusinessMembership(businessId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized. User session required.');
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from('business_memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('membership_status', 'active')
    .single();

  if (error || !membership) {
    throw new Error('Forbidden. Active business membership required.');
  }

  return { user, membership };
}

/**
 * Validates that current user holds one of the specified roles within the business.
 */
export async function requireBusinessRole(businessId: string, allowedRoles: string[]) {
  const { user, membership } = await requireBusinessMembership(businessId);

  if (!allowedRoles.includes(membership.role)) {
    throw new Error('Forbidden. Insufficient role permissions for this operation.');
  }

  return { user, membership };
}

/**
 * Resolves active tenant context for current server request.
 * Deduplicated per-request via React cache().
 */
export const resolveActiveBusinessContext = cache(
  async (): Promise<ActiveTenantContext | null> => {
    const startTime = startTimer();
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const supabase = await createClient();

    // Concurrently fetch memberships & profile in 1 parallel batch
    const [{ data: memberships }, { data: profile }] = await Promise.all([
      supabase
        .from('business_memberships')
        .select('*, businesses(*)')
        .eq('user_id', user.id)
        .eq('membership_status', 'active'),
      supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single(),
    ]);

    if (!memberships || memberships.length === 0) {
      return null;
    }

    const cookieStore = await cookies();
    const requestedBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

    let activeMembership = memberships.find(
      (m) => m.business_id === requestedBusinessId
    );

    if (!activeMembership) {
      activeMembership = memberships[0];
    }

    const business = activeMembership.businesses as unknown as {
      id: string;
      name: string;
      slug: string;
      business_type: string;
      country_code: string;
      default_currency: string;
      timezone: string;
      status: string;
    };

    if (!business) {
      return null;
    }

    // Fetch all active/non-deleted branches for the business
    const { data: allBranches } = await supabase
      .from('branches')
      .select('*')
      .eq('business_id', business.id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false });

    const formattedBranches = (allBranches || []).map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      phone: b.phone || null,
      email: b.email || null,
      address_line1: b.address_line_1 || null,
      city: b.city || null,
      timezone: b.timezone,
      currency: (b as unknown as { currency?: string }).currency || business.default_currency,
      isDefault: b.is_default,
      status: b.status,
      require_table_selection: (b as unknown as { require_table_selection?: boolean }).require_table_selection ?? true,
      require_table_pin: (b as unknown as { require_table_pin?: boolean }).require_table_pin ?? false,
      table_pin_length: (b as unknown as { table_pin_length?: number }).table_pin_length ?? 4,
    }));

    let userAssignedBranchIds: string[] | null = null;
    if (activeMembership.role !== 'business_owner') {
      const { data: assignments } = await supabase
        .from('branch_assignments')
        .select('branch_id')
        .eq('business_membership_id', activeMembership.id);
      userAssignedBranchIds = (assignments || []).map((a) => a.branch_id);
    }

    const userAccessibleBranches =
      userAssignedBranchIds !== null
        ? formattedBranches.filter((b) => userAssignedBranchIds!.includes(b.id))
        : formattedBranches;

    const defaultBranchInfo = userAccessibleBranches.find((b) => b.isDefault) || userAccessibleBranches[0] || null;
    const requestedBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;

    let activeBranchInfo = defaultBranchInfo;
    if (requestedBranchId && userAccessibleBranches.some((b) => b.id === requestedBranchId)) {
      activeBranchInfo = userAccessibleBranches.find((b) => b.id === requestedBranchId) || defaultBranchInfo;
    }

    let subscriptionInfo = undefined;
    try {
      const { SubscriptionService } = await import('@/server/services/subscription.service');
      const subContext = await SubscriptionService.resolveSubscriptionContext(business.id);
      subscriptionInfo = {
        planCode: subContext.subscription.plan_code,
        status: subContext.subscription.status,
        effectiveStatus: subContext.effectiveStatus,
        trialEndsAt: subContext.subscription.trial_ends_at,
        periodEndsAt: subContext.periodEndsAt ? subContext.periodEndsAt.toISOString() : null,
        graceEndsAt: subContext.graceEndsAt ? subContext.graceEndsAt.toISOString() : null,
        daysRemaining: subContext.daysRemaining,
        effectiveLimits: subContext.effectiveLimits,
      };
    } catch (subErr) {
      console.warn('[resolveActiveBusinessContext] Failed to resolve subscription context:', subErr);
    }

    const duration = stopTimer(startTime);
    logPerformanceMetric('RESOLVE_TENANT_CONTEXT', business.slug, duration);

    return {
      user: {
        id: user.id,
        email: user.email || '',
      },
      profile: profile
        ? {
            firstName: profile.first_name || '',
            lastName: profile.last_name || null,
          }
        : null,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        businessType: business.business_type,
        countryCode: business.country_code,
        defaultCurrency: business.default_currency,
        timezone: business.timezone,
        status: business.status,
      },
      defaultBranch: defaultBranchInfo,
      activeBranch: activeBranchInfo,
      branches: activeMembership.role === 'business_owner' ? formattedBranches : userAccessibleBranches,
      membership: {
        id: activeMembership.id,
        role: activeMembership.role,
        status: activeMembership.membership_status,
      },
      subscription: subscriptionInfo,
    };
  }
);

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ActiveTenantContext } from '@/types';

export const ACTIVE_BUSINESS_COOKIE = 'wsnexa_active_business';

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
 */
export async function resolveActiveBusinessContext(): Promise<ActiveTenantContext | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const memberships = await getUserBusinesses(user.id);
  if (memberships.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const requestedBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  // Find target membership matching cookie or fallback to first membership
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

  // Fetch default branch for this business
  const supabase = await createClient();
  const { data: defaultBranch } = await supabase
    .from('branches')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_default', true)
    .single();

  return {
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
    defaultBranch: defaultBranch
      ? {
          id: defaultBranch.id,
          name: defaultBranch.name,
          code: defaultBranch.code,
          isDefault: defaultBranch.is_default,
        }
      : null,
    membership: {
      id: activeMembership.id,
      role: activeMembership.role,
      status: activeMembership.membership_status,
    },
  };
}

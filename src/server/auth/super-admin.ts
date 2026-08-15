import 'server-only';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { User } from '@supabase/supabase-js';

export interface VerifiedSuperAdminContext {
  user: User;
  profile: {
    id: string;
    firstName: string;
    lastName: string | null;
    accountStatus: string;
    isSuperAdmin: boolean;
  };
}

import { cache } from 'react';

/**
 * Authoritative server-side Super Admin Guard.
 * 
 * Verifies:
 * 1. Authenticated Supabase session.
 * 2. Active account status in `user_profiles` (`account_status === 'active'`).
 * 3. Authoritative platform flag `user_profiles.is_super_admin === true`.
 * 
 * Request-scoped deduplication via React cache() ensures multiple checks within
 * the same render pass execute only 1 database lookup.
 * 
 * Never trusts client headers, role claims, or request payloads.
 * Fails securely by throwing an Error.
 */
export const requireSuperAdmin = cache(async function requireSuperAdmin(): Promise<VerifiedSuperAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: User session required.');
  }

  // Fetch profile via service role client to bypass client RLS tampering
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, first_name, last_name, account_status, is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error('Forbidden: User profile not found.');
  }

  if (profile.account_status !== 'active') {
    throw new Error('Forbidden: Account is suspended or deactivated.');
  }

  if (!profile.is_super_admin) {
    throw new Error('Forbidden: Super Admin authority required.');
  }

  return {
    user,
    profile: {
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || null,
      accountStatus: profile.account_status,
      isSuperAdmin: Boolean(profile.is_super_admin),
    },
  };
});

/**
 * Safe boolean check for conditionally rendering Super Admin UI elements.
 * Request-scoped deduplication via React cache().
 * NOT a substitute for server-side authorization guards on mutations or sensitive reads.
 */
export const isSuperAdmin = cache(async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('is_super_admin, account_status')
      .eq('id', userId)
      .maybeSingle();

    return Boolean(profile?.is_super_admin && profile?.account_status === 'active');
  } catch {
    return false;
  }
});

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AccountService, MinimalUserProfile, MinimalMembership } from '@/server/services/account.service';

function getSafeRedirectUrl(next: string | null, defaultTarget: string, origin: string): string {
  if (!next) {
    return `${origin}${defaultTarget}`;
  }

  // Reject external protocols, protocol-relative URLs, and path traversal
  if (
    next.startsWith('//') ||
    next.includes(':\\') ||
    next.includes('://') ||
    !next.startsWith('/')
  ) {
    return `${origin}${defaultTarget}`;
  }

  return `${origin}${next}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const admin = createAdminClient();

        // 1. Fetch user profile
        const { data: profile } = await admin
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        // 2. Sync Google OAuth metadata to user profile if fields are missing (Initial sync only)
        const meta = user.user_metadata || {};
        const googleFirstName = meta.given_name || (meta.full_name ? meta.full_name.split(' ')[0] : null) || meta.name || null;
        const googleLastName = meta.family_name || (meta.full_name && meta.full_name.split(' ').length > 1 ? meta.full_name.split(' ').slice(1).join(' ') : null);
        const googleAvatar = meta.avatar_url || meta.picture || null;

        if (!profile) {
          await admin.from('user_profiles').insert({
            id: user.id,
            first_name: googleFirstName || 'User',
            last_name: googleLastName || null,
            avatar_url: googleAvatar,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (!profile.first_name && googleFirstName) {
          await admin.from('user_profiles').update({
            first_name: googleFirstName,
            ...(googleLastName && !profile.last_name ? { last_name: googleLastName } : {}),
            ...(googleAvatar && !profile.avatar_url ? { avatar_url: googleAvatar } : {}),
            updated_at: new Date().toISOString(),
          }).eq('id', user.id);
        }

        // 3. Fetch active business membership
        const { data: membership } = await admin
          .from('business_memberships')
          .select('id, business_id, role, membership_status, custom_role_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        // 4. Resolve workspace route via AccountService
        let targetRoute = await AccountService.resolveAccountRoute(
          user,
          profile as MinimalUserProfile | null,
          membership as (MinimalMembership & { custom_role_id?: string | null }) | null
        );

        // 5. Execute pending customer order claim intent if present
        try {
          const { executePendingClaimIntentAction } = await import('@/server/actions/customer-order');
          const claimRes = await executePendingClaimIntentAction();
          if (claimRes.executed && claimRes.claimed && claimRes.returnUrl) {
            targetRoute = claimRes.returnUrl;
          }
        } catch (err) {
          console.warn('[auth/callback] Pending claim intent execution skipped:', err);
        }

        // 6. Execute pending customer favorite intent if present
        try {
          const { executePendingFavoriteIntentAction } = await import('@/server/actions/venue-discovery');
          const favRes = await executePendingFavoriteIntentAction();
          if (favRes.executed && favRes.saved && favRes.returnUrl) {
            targetRoute = favRes.returnUrl;
          }
        } catch (err) {
          console.warn('[auth/callback] Pending favorite intent execution skipped:', err);
        }

        const safeRedirect = getSafeRedirectUrl(next, targetRoute, origin);
        return NextResponse.redirect(safeRedirect);
      }
    }
  }

  // Return to login with error if code exchange fails or is invalid
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+auth+link`);
}

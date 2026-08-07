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

      let targetRoute = '/dashboard';
      if (user) {
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from('user_profiles')
          .select('id, first_name, last_name, onboarding_intent, preferred_workspace, customer_profile_created_at')
          .eq('id', user.id)
          .single();

        const { data: membership } = await admin
          .from('business_memberships')
          .select('id, business_id, role, membership_status')
          .eq('user_id', user.id)
          .eq('membership_status', 'active')
          .limit(1)
          .single();

        targetRoute = AccountService.resolveAccountRoute(
          user,
          profile as MinimalUserProfile,
          membership as MinimalMembership
        );
      }

      const safeRedirect = getSafeRedirectUrl(next, targetRoute, origin);
      return NextResponse.redirect(safeRedirect);
    }
  }

  // Return to login with error if code exchange fails or is invalid
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+auth+link`);
}

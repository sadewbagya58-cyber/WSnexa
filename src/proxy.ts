import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { startTimer, stopTimer, logPerformanceMetric } from '@/lib/performance/logger';
import {
  PRODUCTION_CANONICAL_DOMAIN,
  LEGACY_VERCEL_DOMAIN,
} from '@/lib/utils/canonical-url';

export async function proxy(request: NextRequest) {
  const startTime = startTimer();
  const pathname = request.nextUrl.pathname;

  // 1. Canonical Domain Protection:
  // If request arrives at the legacy deployment domain (w-snexa.vercel.app) or www,
  // permanently redirect (308) to canonical production URL (https://wsnexa.app),
  // preserving path and query strings, except for automated internal cron tasks.
  const host = request.headers.get('host') || request.nextUrl.host;
  const isLegacyVercel = host === LEGACY_VERCEL_DOMAIN || host === `www.${LEGACY_VERCEL_DOMAIN}`;
  const isWwwProduction = host === `www.${PRODUCTION_CANONICAL_DOMAIN}`;

  if ((isLegacyVercel || isWwwProduction) && !pathname.startsWith('/api/cron')) {
    const canonicalUrl = new URL(request.url);
    canonicalUrl.protocol = 'https:';
    canonicalUrl.host = PRODUCTION_CANONICAL_DOMAIN;
    canonicalUrl.port = '';
    return NextResponse.redirect(canonicalUrl, { status: 308 });
  }

  // 2. OAuth Root Fallback Handler:
  // If an OAuth provider or legacy configuration redirects with code to root '/',
  // route directly to /auth/callback preserving all query params so session exchange
  // completes rather than falling back to the public marketing page.
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url);
    request.nextUrl.searchParams.forEach((val, key) => {
      callbackUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(callbackUrl, { status: 307 });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const authStart = startTimer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authDuration = stopTimer(authStart);

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // 1. Unauthenticated Route Guards
  if (!user && (isDashboardRoute || isOnboardingRoute || isAdminRoute)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    logPerformanceMetric('PROXY_REDIRECT_UNAUTH', pathname, stopTimer(startTime));
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated User Guards for Auth Pages (Prevent redirect loops)
  if (user && isAuthRoute) {
    // Check if user has active business membership or intent
    const [{ data: memberships }, { data: profile }] = await Promise.all([
      supabase
        .from('business_memberships')
        .select('role, membership_status')
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .limit(1),
      supabase
        .from('user_profiles')
        .select('onboarding_intent, customer_profile_created_at')
        .eq('id', user.id)
        .single(),
    ]);

    let targetRoute = '/onboarding/account-type';

    if (memberships && memberships.length > 0) {
      const role = memberships[0].role;
      switch (role) {
        case 'business_owner':
        case 'branch_manager':
          targetRoute = '/dashboard';
          break;
        case 'cashier':
          targetRoute = '/dashboard/cashier';
          break;
        case 'kitchen_staff':
          targetRoute = '/dashboard/kitchen';
          break;
        case 'waiter':
          targetRoute = '/dashboard/waiter';
          break;
        default:
          targetRoute = '/dashboard';
      }
    } else {
      const intent = profile?.onboarding_intent;
      if (intent === 'customer' || profile?.customer_profile_created_at) {
        targetRoute = '/customer';
      } else if (intent === 'branch_manager' || intent === 'staff') {
        targetRoute = '/account/pending-access';
      } else if (intent === 'business_owner') {
        targetRoute = '/onboarding';
      } else {
        targetRoute = '/onboarding/account-type';
      }
    }

    const redirectUrl = new URL(targetRoute, request.url);
    logPerformanceMetric('PROXY_REDIRECT_AUTH', pathname, stopTimer(startTime));
    return NextResponse.redirect(redirectUrl);
  }

  const proxyDuration = stopTimer(startTime);
  logPerformanceMetric('PROXY_EXECUTION', pathname, proxyDuration, { authDuration });

  // Pass Server Timing Header
  response.headers.set('Server-Timing', `proxy;dur=${proxyDuration}, auth;dur=${authDuration}`);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

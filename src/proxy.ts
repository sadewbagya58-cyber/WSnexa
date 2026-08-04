import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // 1. Unauthenticated Route Guards
  if (!user && (isDashboardRoute || isOnboardingRoute)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated User Guards
  if (user) {
    // Check memberships count
    const { data: memberships } = await supabase
      .from('business_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('membership_status', 'active');

    const hasBusiness = memberships && memberships.length > 0;

    // Check profile onboarding status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_status')
      .eq('id', user.id)
      .single();

    const isCompleted = profile?.onboarding_status === 'completed' || hasBusiness;

    if (isAuthRoute) {
      const redirectUrl = new URL(isCompleted ? '/dashboard' : '/onboarding', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (isOnboardingRoute && isCompleted && !pathname.endsWith('/complete')) {
      const redirectUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (isDashboardRoute && !isCompleted) {
      const redirectUrl = new URL('/onboarding', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

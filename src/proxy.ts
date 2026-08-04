import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { startTimer, stopTimer, logPerformanceMetric } from '@/lib/performance/logger';

export async function proxy(request: NextRequest) {
  const startTime = startTimer();
  const pathname = request.nextUrl.pathname;

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
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // 1. Unauthenticated Route Guards
  if (!user && (isDashboardRoute || isOnboardingRoute)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    logPerformanceMetric('PROXY_REDIRECT_UNAUTH', pathname, stopTimer(startTime));
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated User Guards for Auth Pages
  if (user && isAuthRoute) {
    const redirectUrl = new URL('/dashboard', request.url);
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

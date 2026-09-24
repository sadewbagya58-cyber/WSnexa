import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RouteProgress } from '@/components/ui/route-progress';
import { OfflineBanner } from '@/components/mobile/offline-banner';
import { ServiceWorkerRegister } from '@/components/mobile/service-worker-register';

export const metadata: Metadata = {
  title: 'WSNexa — Smart Hospitality. Simplified.',
  description:
    'Multi-tenant Hospitality Operating System for restaurants, cafes, resorts, food courts, and hospitality venues.',
  icons: {
    icon: [
      { url: '/brand/ws-mark.png', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/ws-mark.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
         * Android cold-start flash guard.
         *
         * When an authenticated user opens the Android app, Capacitor loads the
         * root URL "/". The SSR page at "/" runs server-side auth detection which
         * takes a round-trip — during that time the public landing page briefly
         * renders before the server-side redirect fires.
         *
         * This inline synchronous script runs BEFORE React hydrates. It checks
         * localStorage for a valid Supabase session (Supabase stores the token
         * under "sb-<project>-auth-token"). If found and the path is "/", we
         * immediately replace the navigation to /dashboard — which the server then
         * resolves to the correct workspace via AccountService (dashboard →
         * /admin for super-admin, /dashboard for staff, /onboarding for new users, etc).
         *
         * Safety guarantees:
         * - Logged-out users: no localStorage key found → no redirect, normal render
         * - Server enforces all auth/middleware on the redirected route
         * - No hardcoded user IDs, roles, or destinations
         * - Web browser: harmless (same logic applies, removes one SSR round-trip)
         * - dangerouslySetInnerHTML is required for synchronous inline scripts
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register')) {
      if (window.AndroidAuthBridge && window.AndroidAuthBridge.setAuthenticated) {
        try { window.AndroidAuthBridge.setAuthenticated(false); } catch (e) {}
      }
      return;
    }
    if (window.location.pathname !== '/') return;
    // Find any Supabase auth token in localStorage (key pattern: sb-*-auth-token)
    var found = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        var raw = localStorage.getItem(k);
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            // Valid session has access_token and non-expired expiry
            if (parsed && parsed.access_token) {
              var exp = parsed.expires_at;
              if (!exp || (typeof exp === 'number' && exp * 1000 > Date.now())) {
                found = true;
                break;
              }
            }
          } catch (e) {}
        }
      }
    }
    if (found) {
      // Immediately hide marketing page DOM and show neutral dark splash before paint
      document.documentElement.setAttribute('data-auth-restoring', 'true');
      if (window.AndroidAuthBridge && window.AndroidAuthBridge.setAuthenticated) {
        try { window.AndroidAuthBridge.setAuthenticated(true); } catch (e) {}
      }
      // Replace "/" with "/dashboard"
      window.location.replace('/dashboard');
    }
  } catch (e) {}
})();
`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-zinc-950">
        {/* Startup splash guard: shown ONLY when an authenticated session is restoring from "/" */}
        <div
          id="auth-restoring-splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#09090b] text-white"
          style={{ display: 'none' }}
        >
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-200">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-3 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/ws-mark.png" alt="WSNexa" className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Restoring Session...</span>
            </div>
          </div>
        </div>
        <ServiceWorkerRegister />
        <OfflineBanner />
        <RouteProgress />
        {children}
      </body>
    </html>
  );
}

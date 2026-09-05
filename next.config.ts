import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client router cache TTL for dynamic routes.
    //
    // The default is 0 (no cache) — which causes skeleton flashes on every back
    // navigation because the RSC payload is discarded immediately after leaving
    // a page.
    //
    // dynamic: 30 — cache the RSC payload for 30 seconds in browser memory.
    // Normal back/forward within an active session restores the previous page's
    // RSC shell without a server round-trip or skeleton flash. After 30 seconds
    // the route re-fetches fresh from the server.
    //
    // This does NOT affect server-side security: RLS, auth middleware, tenant
    // isolation, and subscription guards all remain server-enforced. The client
    // router cache only stores the rendered RSC payload in browser memory —
    // it is not a data cache and is discarded entirely on full page reload
    // (e.g. sign-out via the POST /api/auth/logout form).
    //
    // Operational real-time areas (Kitchen, Waiter, Cashier, Reservations) use
    // Supabase realtime subscriptions for live data — unaffected by this cache.
    //
    // static: 300 — retain fully static RSC payloads for 5 minutes (default).
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default nextConfig;

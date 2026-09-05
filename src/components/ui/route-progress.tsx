'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// ── Global Route Progress Bar ─────────────────────────────────────────────────
//
// Shows a thin top-of-screen progress bar during route transitions that take > 100ms.
// The 100ms debounce avoids flashing on instant cache hits (back/forward within
// staleTimes.dynamic or cached static routes).
//
// Uses only usePathname (not useSearchParams) to avoid CSR bailout or requiring
// a Suspense boundary in the RootLayout.

export const RouteProgress: React.FC = () => {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const committedPath = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname !== committedPath.current) {
      committedPath.current = pathname;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor || !anchor.href || anchor.target === '_blank') return;

      try {
        const dest = new URL(anchor.href, window.location.href);
        if (dest.origin !== window.location.origin) return;
        if (dest.pathname === window.location.pathname) return;

        // Show progress bar only if navigation takes > 100ms
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setLoading(true), 100);
      } catch {
        // Invalid URL, ignore
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => {
      document.removeEventListener('click', handleAnchorClick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      aria-hidden
      role="progressbar"
      className="fixed top-0 left-0 right-0 z-[9999] h-0.5 overflow-hidden pointer-events-none bg-zinc-200/60"
    >
      <div className="h-full bg-zinc-950 animate-[progress-slide_1.4s_ease-in-out_infinite]" />
    </div>
  );
};

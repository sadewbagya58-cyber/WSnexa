'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { networkStatus } from '@/lib/offline/network-status';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOffline, setIsOffline] = useState(() => networkStatus.isOffline());
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  useEffect(() => {
    console.error('Dashboard Overview Error:', error);
    const unsub = networkStatus.subscribe((state) => {
      setIsOffline(!state.connected);
      if (state.connected) {
        setRetryNotice(null);
      }
    });
    return () => unsub();
  }, [error]);

  const handleTryAgain = () => {
    if (networkStatus.isOffline()) {
      setRetryNotice(
        'You are currently offline. Please reconnect to the internet to reload dashboard metrics.'
      );
      return;
    }

    setRetryNotice(null);
    startTransition(() => {
      try {
        router.refresh();
        reset();
      } catch {
        window.location.reload();
      }
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-4 py-8 text-center">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">
          {isOffline ? '🌐' : '⚠️'}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-black text-zinc-950">
            {isOffline ? 'Connection Required' : 'Dashboard Overview Error'}
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {isOffline
              ? 'Active branch metrics require an internet connection. Your offline tools (Take Order, Dining Tables, KDS) remain fully functional.'
              : error.message || 'An error occurred while loading active branch metrics.'}
          </p>
        </div>

        {retryNotice && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 animate-in fade-in">
            ⚠️ {retryNotice}
          </div>
        )}

        {isOffline && (
          <div className="pt-1 flex flex-col gap-2">
            <Link
              href="/dashboard/waiter/order"
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-extrabold hover:bg-zinc-800 transition min-h-[44px] flex items-center justify-center touch-manipulation active:scale-[0.98]"
            >
              Take Order (Offline Ready)
            </Link>
            <Link
              href="/dashboard/tables"
              className="w-full py-2.5 px-4 rounded-xl border border-zinc-300 bg-zinc-50 text-zinc-900 text-xs font-bold hover:bg-zinc-100 transition min-h-[44px] flex items-center justify-center touch-manipulation active:scale-[0.98]"
            >
              Dining Tables
            </Link>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button
            type="button"
            onClick={handleTryAgain}
            disabled={isPending}
            className="w-full sm:w-auto text-xs font-bold min-h-[44px] px-5 touch-manipulation active:scale-[0.98]"
          >
            {isPending ? '🔄 Retrying...' : '🔄 Try Again'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto text-xs font-semibold min-h-[44px] px-4 touch-manipulation active:scale-[0.98]"
          >
            🏠 Refresh Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { networkStatus } from '@/lib/offline/network-status';
import { syncQueue } from '@/lib/offline/sync-queue';
import { SyncEngineStats, NetworkState } from '@/lib/offline/offline-types';

interface OfflineBannerProps {
  onOpenSyncDetails?: () => void;
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  onOpenSyncDetails,
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const [network, setNetwork] = useState<NetworkState>(() => networkStatus.getState());
  const [stats, setStats] = useState<SyncEngineStats>(() => syncQueue.getStats());

  useEffect(() => {
    setMounted(true);
    const unsubNet = networkStatus.subscribe((state) => {
      setNetwork(state);
    });
    const unsubQueue = syncQueue.subscribe((newStats) => {
      setStats(newStats);
    });

    return () => {
      unsubNet();
      unsubQueue();
    };
  }, []);

  if (!mounted) {
    return null;
  }

  const isOffline = !network.connected;
  const hasPending = stats.pending_count > 0;
  const isSyncing = stats.is_syncing || stats.syncing_count > 0;
  const hasErrors = stats.failed_count > 0 || stats.conflict_count > 0;

  // If online, not syncing, no pending mutations, and no errors, do not render
  if (!isOffline && !isSyncing && !hasPending && !hasErrors) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 w-full px-4 py-2.5 transition-all text-xs font-medium shadow-sm flex items-center justify-between ${
        isOffline
          ? 'bg-amber-500 text-amber-950 border-b border-amber-600'
          : isSyncing
          ? 'bg-blue-600 text-white'
          : hasErrors
          ? 'bg-rose-600 text-white'
          : 'bg-emerald-600 text-white'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {isOffline ? (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-900 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-900"></span>
          </span>
        ) : isSyncing ? (
          <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : hasErrors ? (
          <span>⚠️</span>
        ) : (
          <span>✓</span>
        )}

        <span>
          {isOffline ? (
            <>
              <strong>Offline Mode</strong> — Operational features active.{' '}
              {hasPending ? `(${stats.pending_count} pending sync)` : '(Queue ready)'}
            </>
          ) : isSyncing ? (
            <>
              <strong>Syncing with WSNexa Server...</strong> ({stats.pending_count + stats.syncing_count} remaining)
            </>
          ) : hasErrors ? (
            <>
              <strong>Sync Attention Required:</strong> {stats.failed_count + stats.conflict_count} mutation(s) need review.
            </>
          ) : (
            <>
              <strong>Connected & Synchronized</strong>
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {hasPending && !isSyncing && !isOffline && (
          <button
            onClick={() => syncQueue.processQueue()}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition"
          >
            Sync Now
          </button>
        )}

        {onOpenSyncDetails && (
          <button
            onClick={onOpenSyncDetails}
            className={`px-2 py-0.5 rounded underline text-[11px] font-medium transition ${
              isOffline ? 'text-amber-950 hover:text-black' : 'text-white/90 hover:text-white'
            }`}
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
};

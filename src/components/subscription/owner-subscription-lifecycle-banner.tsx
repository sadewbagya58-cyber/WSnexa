'use client';

import React from 'react';
import Link from 'next/link';
import { TenantSubscriptionInfo } from '@/types';

interface OwnerSubscriptionLifecycleBannerProps {
  subscription?: TenantSubscriptionInfo;
  isBusinessOwner: boolean;
}

export function OwnerSubscriptionLifecycleBanner({
  subscription,
  isBusinessOwner,
}: OwnerSubscriptionLifecycleBannerProps) {
  if (!isBusinessOwner || !subscription) {
    return null;
  }

  const { effectiveStatus, daysRemaining } = subscription;

  if (effectiveStatus === 'TRIALING') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 shadow-sm border border-blue-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/40 border border-blue-400/40 flex items-center justify-center text-xl shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md border border-blue-400/30">
                14-Day Trial Active
              </span>
              <span className="text-xs font-bold text-blue-200">
                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Trial ends soon'}
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium mt-0.5">
              Your trial provides full access to all WSNexa product capabilities. Choose a plan to ensure continuous operations.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-xs font-extrabold text-blue-950 bg-white hover:bg-blue-50 rounded-xl transition-all shadow-xs"
        >
          Upgrade Plan ⚡
        </Link>
      </div>
    );
  }

  if (effectiveStatus === 'GRACE_PERIOD') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-amber-900 to-orange-950 text-white p-4 shadow-sm border border-amber-600/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/40 border border-amber-400/40 flex items-center justify-center text-xl shrink-0">
            ⚠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-md border border-amber-400/30">
                Grace Period Active
              </span>
              <span className="text-xs font-bold text-amber-200">
                {daysRemaining > 0 ? `${daysRemaining} days left` : 'Grace period expiring'}
              </span>
            </div>
            <p className="text-xs text-amber-100 font-medium mt-0.5">
              Your subscription period has expired. Renew your plan now to prevent operational suspension.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-xs font-extrabold text-amber-950 bg-amber-300 hover:bg-amber-200 rounded-xl transition-all shadow-xs"
        >
          Renew Plan ⚡
        </Link>
      </div>
    );
  }

  if (effectiveStatus === 'SUSPENDED') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-rose-950 to-red-900 text-white p-4 shadow-sm border border-rose-600/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/40 border border-rose-400/40 flex items-center justify-center text-xl shrink-0">
            🔒
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-md border border-rose-400/30">
                Subscription Suspended
              </span>
            </div>
            <p className="text-xs text-rose-100 font-medium mt-0.5">
              Commercial operations are suspended. Reactivate your subscription to restore workspace access.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-xs font-extrabold text-rose-950 bg-white hover:bg-rose-50 rounded-xl transition-all shadow-xs"
        >
          Reactivate Subscription ⚡
        </Link>
      </div>
    );
  }

  if (effectiveStatus === 'CANCELLED') {
    return (
      <div className="rounded-2xl bg-zinc-900 text-white p-4 shadow-sm border border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl shrink-0">
            🛑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700">
                Subscription Cancelled
              </span>
            </div>
            <p className="text-xs text-zinc-300 font-medium mt-0.5">
              Your subscription is cancelled. All venue data remains 100% intact. Reactivate at any time.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-xs font-extrabold text-zinc-950 bg-white hover:bg-zinc-100 rounded-xl transition-all shadow-xs"
        >
          Reactivate Subscription ⚡
        </Link>
      </div>
    );
  }

  return null;
}

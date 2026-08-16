import React from 'react';

export default function InventoryHubLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-zinc-200 rounded-md" />
          <div className="h-3.5 w-64 bg-zinc-100 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-zinc-200 rounded-xl" />
          <div className="h-9 w-32 bg-zinc-200 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
            <div className="h-3 w-20 bg-zinc-200 rounded" />
            <div className="h-7 w-16 bg-zinc-300 rounded" />
            <div className="h-2.5 w-28 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Health Card & Needs Attention Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="h-4 w-32 bg-zinc-200 rounded" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-zinc-100 rounded" />
            <div className="h-3 w-4/5 bg-zinc-100 rounded" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
          <div className="h-4 w-36 bg-zinc-200 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-zinc-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Shortcuts Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100" />
            <div className="h-4 w-24 bg-zinc-200 rounded" />
            <div className="h-3 w-32 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

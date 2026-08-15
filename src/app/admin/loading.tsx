import React from 'react';

export default function AdminOverviewLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
          <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
          <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-zinc-200 rounded-xl" />
          <div className="h-10 w-36 bg-zinc-900/10 rounded-xl" />
        </div>
      </div>

      {/* Platform Health Score Banner Skeleton */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-3 w-28 bg-zinc-200 rounded" />
            <div className="h-6 w-48 bg-zinc-200 rounded-lg" />
          </div>
          <div className="h-12 w-24 bg-zinc-200 rounded-2xl" />
        </div>
        <div className="h-2 w-full bg-zinc-100 rounded-full" />
      </div>

      {/* 4 Metric Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-3xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-7 w-7 bg-zinc-100 rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-zinc-200 rounded-xl" />
            <div className="h-2.5 w-28 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Two Column Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Venues */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 bg-zinc-200 rounded-lg" />
            <div className="h-4 w-16 bg-zinc-100 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-14 bg-zinc-50 rounded-2xl border border-zinc-100" />
            ))}
          </div>
        </div>

        {/* Recent Audit */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-zinc-200 rounded-lg" />
            <div className="h-4 w-16 bg-zinc-100 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-14 bg-zinc-50 rounded-2xl border border-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function AdminVenueDetailLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
          <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
          <div className="h-3 w-48 bg-zinc-100 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-zinc-200 rounded-2xl" />
          <div className="h-10 w-32 bg-zinc-200 rounded-2xl" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="h-6 w-36 bg-zinc-200 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-zinc-100 rounded-xl" />
              <div className="h-10 bg-zinc-100 rounded-xl" />
            </div>
            <div className="h-20 bg-zinc-100 rounded-xl" />
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="h-6 w-40 bg-zinc-200 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-zinc-100 rounded-xl" />
              <div className="h-10 bg-zinc-100 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="h-5 w-28 bg-zinc-200 rounded" />
            <div className="h-12 bg-zinc-100 rounded-2xl" />
            <div className="h-12 bg-zinc-100 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

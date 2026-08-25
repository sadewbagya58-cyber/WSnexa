import React from 'react';

export default function PublicVenueLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased animate-pulse">
      {/* Hero Cover Skeleton */}
      <div className="h-56 sm:h-72 w-full bg-zinc-800" />

      <main className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10 space-y-6 pb-12">
        {/* Profile Card Skeleton */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-200 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-zinc-200 rounded-lg" />
              <div className="h-4 w-32 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="h-12 bg-amber-100 rounded-2xl" />
            <div className="h-12 bg-zinc-100 rounded-2xl" />
            <div className="h-12 bg-zinc-100 rounded-2xl" />
            <div className="h-12 bg-zinc-900 rounded-2xl" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-4">
          <div className="h-5 w-36 bg-zinc-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-16 bg-zinc-50 rounded-2xl border border-zinc-100" />
            <div className="h-16 bg-zinc-50 rounded-2xl border border-zinc-100" />
          </div>
        </div>
      </main>
    </div>
  );
}

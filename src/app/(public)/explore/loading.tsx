import React from 'react';

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between overflow-x-hidden max-w-full">
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 animate-pulse">
        {/* Hero Title Skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-64 sm:w-96 bg-zinc-200 rounded-xl" />
          <div className="h-4 w-48 sm:w-72 bg-zinc-100 rounded-lg" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="p-2 bg-white rounded-2xl border border-zinc-200 flex items-center gap-2">
          <div className="h-10 flex-1 bg-zinc-100 rounded-xl" />
          <div className="h-10 w-24 bg-zinc-900/20 rounded-xl" />
        </div>

        {/* Category Chips Skeleton */}
        <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-zinc-200 rounded-full shrink-0" />
          ))}
        </div>

        {/* Results Card Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden space-y-3 p-4">
              <div className="aspect-[16/10] w-full bg-zinc-200 rounded-xl" />
              <div className="h-5 w-3/4 bg-zinc-200 rounded" />
              <div className="h-4 w-1/2 bg-zinc-100 rounded" />
              <div className="h-10 w-full bg-zinc-900/10 rounded-xl pt-2" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

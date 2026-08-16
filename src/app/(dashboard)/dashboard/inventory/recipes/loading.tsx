import React from 'react';

export default function RecipesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-zinc-200 rounded-md" />
          <div className="h-4 w-72 bg-zinc-100 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-zinc-200 rounded-xl" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-4 shadow-xs">
            <div className="flex justify-between items-start">
              <div className="h-5 w-32 bg-zinc-200 rounded-md" />
              <div className="h-5 w-16 bg-zinc-100 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-zinc-100 rounded-md" />
              <div className="h-4 w-3/4 bg-zinc-100 rounded-md" />
            </div>
            <div className="pt-2 border-t border-zinc-100 flex justify-between">
              <div className="h-4 w-20 bg-zinc-100 rounded-md" />
              <div className="h-4 w-20 bg-zinc-200 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

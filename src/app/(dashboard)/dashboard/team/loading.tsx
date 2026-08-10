import React from 'react';

export default function TeamLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="h-7 w-48 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-zinc-100 rounded-md" />
        </div>
        <div className="h-10 w-36 bg-zinc-200 rounded-xl" />
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-zinc-200/80 rounded-xl" />
        <div className="h-10 w-32 bg-zinc-200/80 rounded-xl" />
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-zinc-200 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 bg-zinc-200 rounded-md" />
                <div className="h-3 w-40 bg-zinc-100 rounded-md" />
              </div>
            </div>
            <div className="h-6 w-24 bg-zinc-100 rounded-full" />
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
              <div className="h-3 w-20 bg-zinc-100 rounded-md" />
              <div className="h-8 w-28 bg-zinc-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

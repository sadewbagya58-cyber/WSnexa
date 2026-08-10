import React from 'react';

export default function TeamInvitesLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="h-7 w-48 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-zinc-100 rounded-md" />
        </div>
        <div className="h-10 w-40 bg-zinc-200 rounded-xl" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 bg-zinc-200 rounded-full" />
        ))}
      </div>

      {/* Invites Cards / Table Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 bg-zinc-200 rounded-md" />
                <div className="h-5 w-16 bg-zinc-100 rounded-full" />
              </div>
              <div className="h-4 w-48 bg-zinc-100 rounded-md" />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="h-9 w-28 bg-zinc-200 rounded-xl" />
              <div className="h-9 w-20 bg-zinc-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

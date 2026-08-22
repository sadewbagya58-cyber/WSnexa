import React from 'react';

export default function MemberDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-4 bg-zinc-200 rounded w-48" />

      {/* Header Profile Card Skeleton */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-200" />
          <div className="space-y-2">
            <div className="h-5 bg-zinc-200 rounded w-48" />
            <div className="h-3 bg-zinc-100 rounded w-64" />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="h-9 bg-zinc-100 rounded-xl w-32" />
          <div className="h-9 bg-zinc-200 rounded-xl w-40" />
        </div>
      </div>

      {/* Detail Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="h-5 bg-zinc-200 rounded w-36" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="h-5 bg-zinc-200 rounded w-36" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

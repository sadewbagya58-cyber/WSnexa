import React from 'react';

export default function ReservationsDashboardLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse font-sans">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-slate-200 rounded-lg" />
          <div className="h-10 w-36 bg-amber-200 rounded-lg" />
        </div>
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
        <div className="h-9 w-32 bg-slate-200 rounded-lg" />
        <div className="h-9 w-24 bg-slate-100 rounded-lg" />
        <div className="h-9 w-28 bg-slate-100 rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

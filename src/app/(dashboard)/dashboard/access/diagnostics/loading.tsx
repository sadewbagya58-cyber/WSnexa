import React from 'react';

export default function DiagnosticsPageLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded-lg w-64" />
          <div className="h-6 bg-zinc-100 rounded-full w-28" />
        </div>
        <div className="h-4 bg-zinc-100 rounded-lg w-3/4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="h-5 bg-zinc-200 rounded w-36" />
          <div className="h-9 bg-zinc-100 rounded-xl w-full" />
          <div className="h-9 bg-zinc-100 rounded-xl w-full" />
          <div className="h-9 bg-zinc-100 rounded-xl w-full" />
          <div className="h-10 bg-zinc-200 rounded-xl w-full pt-2" />
        </div>

        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="h-5 bg-zinc-200 rounded w-48" />
          <div className="h-24 bg-zinc-100 rounded-xl w-full" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-zinc-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

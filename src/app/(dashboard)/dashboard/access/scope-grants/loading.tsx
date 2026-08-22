import React from 'react';

export default function ScopeGrantsPageLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded-lg w-64" />
          <div className="h-9 bg-zinc-200 rounded-xl w-40" />
        </div>
        <div className="h-4 bg-zinc-100 rounded-lg w-3/4" />
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border border-zinc-100 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-zinc-200 rounded w-48" />
              <div className="h-3 bg-zinc-100 rounded w-64" />
            </div>
            <div className="h-8 bg-zinc-100 rounded-xl w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

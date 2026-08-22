import React from 'react';

export default function MembersPageLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded-lg w-56" />
          <div className="h-6 bg-zinc-100 rounded-full w-24" />
        </div>
        <div className="h-4 bg-zinc-100 rounded-lg w-2/3" />
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs divide-y divide-zinc-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-zinc-200 rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 bg-zinc-200 rounded w-40" />
                <div className="h-3 bg-zinc-100 rounded w-48" />
              </div>
            </div>
            <div className="h-8 bg-zinc-100 rounded-xl w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

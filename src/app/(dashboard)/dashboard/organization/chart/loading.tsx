import React from 'react';

export default function OrgChartLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="h-7 w-40 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-zinc-100 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl bg-white border border-zinc-200 p-8 min-h-[400px] flex flex-col items-center gap-8 shadow-sm">
        <div className="h-16 w-48 bg-zinc-200 rounded-xl" />
        <div className="flex gap-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-36 bg-zinc-200/80 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-28 bg-zinc-100 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

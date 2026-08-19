import React from 'react';

export default function JobTitlesLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="h-7 w-48 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-zinc-100 rounded-md" />
        </div>
        <div className="h-9 w-36 bg-zinc-200 rounded-xl" />
      </div>
      <div className="h-9 bg-zinc-200/80 rounded-lg max-w-sm" />
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
        <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 w-20 bg-zinc-200 rounded-md" />
          ))}
        </div>
        <div className="divide-y divide-zinc-100">
          {[1, 2, 3, 4, 5, 6, 8].map((i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-6">
              <div className="h-4 w-36 bg-zinc-200 rounded-md flex-1" />
              <div className="h-4 w-16 bg-zinc-100 rounded-md" />
              <div className="h-4 w-24 bg-zinc-100 rounded-md" />
              <div className="h-6 w-16 bg-zinc-100 rounded-full" />
              <div className="h-7 w-12 bg-zinc-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

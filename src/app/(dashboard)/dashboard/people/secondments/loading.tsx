import React from 'react';

export default function SecondmentsLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="h-7 w-44 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-zinc-100 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-zinc-200 rounded-md" />
              <div className="h-3 w-56 bg-zinc-100 rounded-md" />
            </div>
            <div className="h-6 w-24 bg-zinc-200 rounded-full" />
            <div className="h-4 w-20 bg-zinc-100 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

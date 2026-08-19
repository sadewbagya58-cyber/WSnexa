import React from 'react';

export default function IntegrityLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="h-7 w-56 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-80 bg-zinc-100 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5 space-y-2 shadow-sm">
            <div className="h-4 w-32 bg-zinc-200 rounded-md" />
            <div className="h-8 w-16 bg-zinc-200 rounded-md" />
            <div className="h-3 w-48 bg-zinc-100 rounded-md" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 flex gap-4 shadow-sm">
            <div className="h-5 w-5 rounded-full bg-zinc-200 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 bg-zinc-200 rounded-md" />
              <div className="h-3 w-full bg-zinc-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';

export default function StructureLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="h-7 w-64 bg-zinc-200 rounded-lg mb-2" />
          <div className="h-4 w-80 bg-zinc-100 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 bg-zinc-200 rounded-xl" />
          <div className="h-9 w-36 bg-zinc-200 rounded-xl" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 bg-zinc-200/80 rounded-lg" />
        <div className="h-9 w-48 bg-zinc-200/80 rounded-lg" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-5 flex items-center justify-between gap-3 border-b border-zinc-100">
              <div className="flex items-center space-x-3">
                <div className="h-7 w-7 rounded-md bg-zinc-200" />
                <div className="space-y-1.5">
                  <div className="h-5 w-36 bg-zinc-200 rounded-md" />
                  <div className="h-3 w-56 bg-zinc-100 rounded-md" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-zinc-100 rounded-lg" />
                <div className="h-8 w-16 bg-zinc-100 rounded-lg" />
              </div>
            </div>
            <div className="p-4 bg-zinc-50/50 grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="rounded-lg bg-white border border-zinc-200 p-3.5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-zinc-200 rounded-md" />
                    <div className="h-3 w-20 bg-zinc-100 rounded-md" />
                  </div>
                  <div className="h-7 w-12 bg-zinc-100 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

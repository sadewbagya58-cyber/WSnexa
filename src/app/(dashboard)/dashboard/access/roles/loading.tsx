import React from 'react';

export default function RolesPageLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded-lg w-56" />
          <div className="h-9 bg-zinc-200 rounded-xl w-36" />
        </div>
        <div className="h-4 bg-zinc-100 rounded-lg w-2/3" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-zinc-200 rounded-lg w-36" />
              <div className="h-5 bg-zinc-100 rounded-full w-20" />
            </div>
            <div className="h-4 bg-zinc-100 rounded-lg w-full" />
            <div className="h-8 bg-zinc-100 rounded-xl w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

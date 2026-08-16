import React from 'react';

export default function RecipeDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-zinc-200 rounded-lg" />
        <div className="space-y-2">
          <div className="h-7 w-64 bg-zinc-200 rounded-md" />
          <div className="h-4 w-32 bg-zinc-100 rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-zinc-200 rounded-xl p-5" />
        ))}
      </div>
      <div className="h-64 bg-white border border-zinc-200 rounded-xl" />
    </div>
  );
}

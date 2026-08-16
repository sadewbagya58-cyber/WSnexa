import React from 'react';

export default function NewRecipeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-md" />
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
        <div className="h-5 w-40 bg-zinc-200 rounded-md" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-zinc-100 rounded-xl" />
          <div className="h-10 bg-zinc-100 rounded-xl" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 space-y-4">
        <div className="h-5 w-40 bg-zinc-200 rounded-md" />
        <div className="h-16 bg-zinc-100 rounded-xl" />
      </div>
    </div>
  );
}

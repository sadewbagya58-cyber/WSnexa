import React from 'react';
import { Card } from '@/components/ui/card';

export default function TablesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-64 bg-zinc-200 rounded-md" />
        <div className="h-4 w-96 bg-zinc-200 rounded-md" />
      </div>

      {/* Summary Stat Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-3 text-center space-y-2">
            <div className="h-3 w-16 bg-zinc-200 rounded mx-auto" />
            <div className="h-6 w-10 bg-zinc-200 rounded mx-auto" />
          </Card>
        ))}
      </div>

      {/* Table Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-5 w-24 bg-zinc-200 rounded" />
              <div className="h-4 w-16 bg-zinc-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-zinc-200 rounded" />
            <div className="h-3 w-32 bg-zinc-200 rounded" />
            <div className="h-8 w-full bg-zinc-100 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { Card } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-64 bg-zinc-200 rounded-md" />
        <div className="h-4 w-96 bg-zinc-200 rounded-md" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-zinc-200 rounded" />
              <div className="h-4 w-12 bg-zinc-200 rounded" />
            </div>
            <div className="h-8 w-16 bg-zinc-200 rounded" />
            <div className="h-3 w-24 bg-zinc-200 rounded" />
          </Card>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div className="h-5 w-48 bg-zinc-200 rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-full bg-zinc-100 rounded-lg" />
            ))}
          </div>
        </Card>
        <Card className="p-6 space-y-4">
          <div className="h-5 w-32 bg-zinc-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-full bg-zinc-100 rounded" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

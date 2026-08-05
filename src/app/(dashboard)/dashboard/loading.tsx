import React from 'react';
import { StatsSkeleton, ListRowSkeleton } from '@/components/ui/skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Overview</h1>
        <p className="text-xs text-zinc-500">Live operational summary of your active branch</p>
      </div>

      {/* Summary Stat Skeletons */}
      <StatsSkeleton count={4} />

      {/* Activity Skeleton */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-950">Recent System Activity</h2>
        <ListRowSkeleton count={2} />
      </div>
    </div>
  );
}

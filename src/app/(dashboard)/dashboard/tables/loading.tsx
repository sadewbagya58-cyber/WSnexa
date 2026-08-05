import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TableGridSkeleton, StatsSkeleton } from '@/components/ui/skeletons';

export default function TablesLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Dining Tables</h1>
          <p className="text-xs text-zinc-500">Manage seating layout, service areas, and table status</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/tables/areas">
            <Button variant="outline" size="sm">Service Areas</Button>
          </Link>
          <Link href="/dashboard/tables/bulk">
            <Button variant="outline" size="sm">Bulk Generator</Button>
          </Link>
          <Link href="/dashboard/tables/new">
            <Button size="sm">+ Add Table</Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats Skeletons */}
      <StatsSkeleton count={4} />

      {/* Table Grid Skeleton */}
      <TableGridSkeleton count={4} />
    </div>
  );
}

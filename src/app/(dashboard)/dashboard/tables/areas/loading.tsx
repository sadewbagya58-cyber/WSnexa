import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRowSkeleton } from '@/components/ui/skeletons';

export default function AreasLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Service Areas</h1>
          <p className="text-xs text-zinc-500">Configure dining zones, rooms, and seating floors</p>
        </div>
        <Link href="/dashboard/tables">
          <Button variant="outline" size="sm">Manage Tables</Button>
        </Link>
      </div>

      {/* Real Form Frame */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-bold text-zinc-950">Create New Service Area</h2>
        <div className="flex gap-2">
          <input
            disabled
            placeholder="Area name (e.g. Main Hall)..."
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm bg-zinc-50 cursor-not-allowed"
          />
          <Button disabled size="sm">Add Area</Button>
        </div>
      </Card>

      {/* Service Area List Skeleton */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-zinc-950">Existing Service Areas</h2>
        <ListRowSkeleton count={3} />
      </div>
    </div>
  );
}

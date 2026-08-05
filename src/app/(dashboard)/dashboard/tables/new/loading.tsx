import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NewTableLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Real Page Header & Actions */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Add Dining Table</h1>
          <p className="text-xs text-zinc-500">Create an individual table with custom label and capacity</p>
        </div>
        <Link href="/dashboard/tables">
          <Button variant="outline" size="sm">Back to Tables</Button>
        </Link>
      </div>

      {/* Form Loading Skeleton */}
      <Card className="p-6 space-y-4 animate-pulse">
        <div className="h-10 w-full bg-zinc-100 rounded" />
        <div className="h-10 w-full bg-zinc-100 rounded" />
        <div className="h-10 w-full bg-zinc-100 rounded" />
        <div className="h-10 w-full bg-zinc-200 rounded" />
      </Card>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatsSkeleton } from '@/components/ui/skeletons';

export default function MenuLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header & Navigation Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Menu Management</h1>
          <p className="text-xs text-zinc-500">Configure menu categories, items, and modifiers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/menu/categories">
            <Button variant="outline" size="sm">Categories</Button>
          </Link>
          <Link href="/dashboard/menu/items">
            <Button size="sm">Menu Items</Button>
          </Link>
        </div>
      </div>

      <StatsSkeleton count={3} />
    </div>
  );
}

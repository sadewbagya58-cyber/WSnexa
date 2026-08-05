import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CompactCardSkeleton } from '@/components/ui/skeletons';

export default function MenuItemsLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Menu Items</h1>
          <p className="text-xs text-zinc-500">Manage your menu offerings, pricing, and availability</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/menu/categories">
            <Button variant="outline" size="sm">Manage Categories</Button>
          </Link>
          <Link href="/dashboard/menu/items/new">
            <Button size="sm">+ Add Menu Item</Button>
          </Link>
        </div>
      </div>

      {/* Real Filter Controls Frame */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          disabled
          placeholder="Search items by name..."
          className="w-full sm:w-64 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-400 bg-zinc-50 cursor-not-allowed"
        />
        <select
          disabled
          className="w-full sm:w-48 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-400 bg-zinc-50 cursor-not-allowed"
        >
          <option>All Categories</option>
        </select>
      </div>

      {/* Contextual Data Skeleton Area */}
      <CompactCardSkeleton count={2} />
    </div>
  );
}

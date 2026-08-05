import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ListRowSkeleton } from '@/components/ui/skeletons';

export default function ItemDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header & Actions */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Item Details</h1>
          <p className="text-xs text-zinc-500">Configure item properties and modifier groups</p>
        </div>
        <Link href="/dashboard/menu/items">
          <Button variant="outline" size="sm">Back to Items</Button>
        </Link>
      </div>

      <ListRowSkeleton count={2} />
    </div>
  );
}

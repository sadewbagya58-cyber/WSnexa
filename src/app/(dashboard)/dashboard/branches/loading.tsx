import React from 'react';
import { ListRowSkeleton } from '@/components/ui/skeletons';

export default function BranchesLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Branches</h1>
        <p className="text-xs text-zinc-500">Manage locations and branch operating settings</p>
      </div>

      <ListRowSkeleton count={2} />
    </div>
  );
}

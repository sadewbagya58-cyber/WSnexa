import React from 'react';
import { ListRowSkeleton } from '@/components/ui/skeletons';

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Team & Staff</h1>
        <p className="text-xs text-zinc-500">Manage user roles, permissions, and staff assignments</p>
      </div>

      <ListRowSkeleton count={3} />
    </div>
  );
}

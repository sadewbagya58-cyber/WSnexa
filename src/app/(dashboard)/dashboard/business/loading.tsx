import React from 'react';
import { Card } from '@/components/ui/card';

export default function BusinessLoading() {
  return (
    <div className="space-y-6">
      {/* Real Page Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Business Profile</h1>
        <p className="text-xs text-zinc-500">Manage business branding, contact details, and currency</p>
      </div>

      <Card className="p-6 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-zinc-200 rounded" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-10 w-full bg-zinc-100 rounded" />
          <div className="h-10 w-full bg-zinc-100 rounded" />
        </div>
      </Card>
    </div>
  );
}

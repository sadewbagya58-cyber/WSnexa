import React from 'react';
import { Card } from '@/components/ui/card';

export default function MenuLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-64 bg-zinc-200 rounded-md" />
        <div className="h-4 w-80 bg-zinc-200 rounded-md" />
      </div>

      <div className="flex border-b border-zinc-200 gap-4 pb-2">
        <div className="h-6 w-24 bg-zinc-200 rounded" />
        <div className="h-6 w-24 bg-zinc-200 rounded" />
        <div className="h-6 w-24 bg-zinc-200 rounded" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 space-y-3">
            <div className="h-4 w-32 bg-zinc-200 rounded" />
            <div className="h-8 w-16 bg-zinc-200 rounded" />
            <div className="h-4 w-24 bg-zinc-200 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { Card } from '@/components/ui/card';

export default function MenuItemsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-56 bg-zinc-200 rounded-md" />
        <div className="h-4 w-96 bg-zinc-200 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="h-40 w-full bg-zinc-200 rounded-md" />
            <div className="flex justify-between items-center">
              <div className="h-5 w-32 bg-zinc-200 rounded" />
              <div className="h-5 w-16 bg-zinc-200 rounded" />
            </div>
            <div className="h-3 w-44 bg-zinc-200 rounded" />
            <div className="h-8 w-full bg-zinc-100 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

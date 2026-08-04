import React from 'react';
import { Card } from '@/components/ui/card';

export default function TeamLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-48 bg-zinc-200 rounded-md" />
        <div className="h-4 w-80 bg-zinc-200 rounded-md" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-5 w-44 bg-zinc-200 rounded" />
              <div className="flex gap-2">
                <div className="h-4 w-20 bg-zinc-200 rounded" />
                <div className="h-4 w-20 bg-zinc-200 rounded" />
              </div>
            </div>
            <div className="h-4 w-32 bg-zinc-200 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

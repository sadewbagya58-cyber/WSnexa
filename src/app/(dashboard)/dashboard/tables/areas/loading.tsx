import React from 'react';
import { Card } from '@/components/ui/card';

export default function AreasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-48 bg-zinc-200 rounded-md" />
        <div className="h-4 w-80 bg-zinc-200 rounded-md" />
      </div>

      <Card className="p-6 space-y-4">
        <div className="h-5 w-44 bg-zinc-200 rounded" />
        <div className="h-10 w-full bg-zinc-100 rounded" />
      </Card>

      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-48 bg-zinc-200 rounded" />
            </div>
            <div className="h-8 w-20 bg-zinc-200 rounded" />
          </Card>
        ))}
      </div>
    </div>
  );
}

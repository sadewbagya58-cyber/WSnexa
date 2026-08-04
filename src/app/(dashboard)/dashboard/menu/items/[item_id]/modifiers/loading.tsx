import React from 'react';
import { Card } from '@/components/ui/card';

export default function ModifiersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-64 bg-zinc-200 rounded-md" />
        <div className="h-4 w-96 bg-zinc-200 rounded-md" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 space-y-4">
            <div className="flex justify-between">
              <div className="h-5 w-40 bg-zinc-200 rounded" />
              <div className="h-5 w-20 bg-zinc-200 rounded" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-10 w-full bg-zinc-100 rounded" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

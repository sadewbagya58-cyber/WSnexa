import React from 'react';
import { Card } from '@/components/ui/card';

export default function BulkTablesLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      <div className="space-y-2 pb-2 border-b border-zinc-200">
        <div className="h-8 w-60 bg-zinc-200 rounded-md" />
        <div className="h-4 w-96 bg-zinc-200 rounded-md" />
      </div>

      <Card className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 bg-zinc-200 rounded" />
            <div className="h-10 w-full bg-zinc-100 rounded" />
          </div>
        ))}
      </Card>
    </div>
  );
}

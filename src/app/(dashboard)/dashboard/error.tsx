'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Overview Error:', error);
  }, [error]);

  return (
    <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-xl mx-auto space-y-4 text-center shadow-lg my-12">
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl mx-auto">
        ⚠️
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-black text-zinc-950">Dashboard Overview Error</h2>
        <p className="text-xs text-zinc-500">
          An error occurred while loading active branch metrics: {error.message || 'Unknown runtime exception'}
        </p>
      </div>

      <div className="pt-2 flex justify-center gap-3">
        <Button variant="primary" size="sm" onClick={() => reset()}>
          🔄 Try Again
        </Button>
        <a href="/dashboard">
          <Button variant="outline" size="sm">
            🏠 Refresh Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}

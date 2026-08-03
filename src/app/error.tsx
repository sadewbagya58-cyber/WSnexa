'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service if needed
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-2xl font-bold text-zinc-950">Something went wrong!</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        An unexpected error occurred. Please try again or return home.
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={() => reset()}>Try Again</Button>
      </div>
    </div>
  );
}

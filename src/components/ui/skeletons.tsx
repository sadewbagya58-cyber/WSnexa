import React from 'react';
import { Card } from '@/components/ui/card';

export const ListRowSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-36 bg-zinc-200 rounded" />
            <div className="h-3 w-48 bg-zinc-100 rounded" />
          </div>
          <div className="h-8 w-20 bg-zinc-200 rounded" />
        </Card>
      ))}
    </div>
  );
};

export const CompactCardSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-24 bg-zinc-100 rounded" />
              <div className="h-3 w-44 bg-zinc-100 rounded" />
              <div className="h-4 w-16 bg-zinc-200 rounded" />
            </div>
            <div className="h-16 w-16 bg-zinc-200 rounded-md" />
          </div>
          <div className="flex justify-between items-center border-t border-zinc-100 pt-3">
            <div className="flex gap-1">
              <div className="h-8 w-20 bg-zinc-200 rounded" />
              <div className="h-8 w-20 bg-zinc-200 rounded" />
            </div>
            <div className="h-8 w-16 bg-zinc-200 rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
};

export const TableGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-4 w-20 bg-zinc-200 rounded" />
            <div className="h-5 w-16 bg-zinc-200 rounded-full" />
          </div>
          <div className="h-3 w-28 bg-zinc-100 rounded" />
          <div className="h-3 w-36 bg-zinc-100 rounded" />
          <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
            <div className="h-7 w-24 bg-zinc-200 rounded" />
            <div className="h-7 w-16 bg-zinc-200 rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
};

export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 space-y-2">
          <div className="h-3 w-24 bg-zinc-200 rounded" />
          <div className="h-7 w-16 bg-zinc-300 rounded" />
        </Card>
      ))}
    </div>
  );
};

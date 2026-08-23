'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = typeof totalItems === 'number' ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  return (
    <div className={`flex items-center justify-between gap-3 pt-4 border-t border-zinc-200 ${className}`}>
      <div className="text-xs font-semibold text-zinc-500">
        {typeof totalItems === 'number' ? (
          <span>
            Showing <strong className="text-zinc-900">{startItem}</strong> to <strong className="text-zinc-900">{endItem}</strong> of{' '}
            <strong className="text-zinc-900">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="text-zinc-900">{currentPage}</strong> of <strong className="text-zinc-900">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 px-3 text-xs font-bold"
        >
          Previous
        </Button>

        <span className="text-xs font-extrabold text-zinc-800 px-2">
          {currentPage} / {totalPages}
        </span>

        <Button
          size="sm"
          variant="outline"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 px-3 text-xs font-bold"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

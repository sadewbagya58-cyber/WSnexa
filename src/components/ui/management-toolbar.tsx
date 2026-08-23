'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export interface SortOption {
  label: string;
  value: string;
}

export interface ManagementToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterOption[];
  sortOptions?: SortOption[];
  currentSort?: string;
  onSortChange?: (value: string) => void;
  primaryAction?: {
    label: string;
    icon?: string;
    onClick?: () => void;
    canPerform?: boolean;
  };
  totalResults?: number;
  className?: string;
}

export const ManagementToolbar: React.FC<ManagementToolbarProps> = ({
  searchPlaceholder = 'Search records...',
  searchValue = '',
  onSearchChange,
  filters = [],
  sortOptions = [],
  currentSort,
  onSortChange,
  primaryAction,
  totalResults,
  className = '',
}) => {
  const canPerformPrimary = primaryAction?.canPerform ?? true;

  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs ${className}`}>
      {/* Left: Search & Filters */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-8 pr-8 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950 text-zinc-950 placeholder:text-zinc-400 font-medium transition-all"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs font-bold p-1"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Dynamic Filters */}
        {filters.map((filter) => (
          <select
            key={filter.key}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {/* Sort selector */}
        {sortOptions.length > 0 && onSortChange && (
          <select
            value={currentSort || ''}
            onChange={(e) => onSortChange(e.target.value)}
            className="h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right: Counter & Primary Action */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
        {typeof totalResults === 'number' && (
          <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
            {totalResults} {totalResults === 1 ? 'item' : 'items'}
          </span>
        )}

        {primaryAction && canPerformPrimary && (
          <Button
            size="sm"
            onClick={primaryAction.onClick}
            className="h-9 px-4 text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 rounded-xl shadow-2xs"
          >
            {primaryAction.icon && <span className="mr-1">{primaryAction.icon}</span>}
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

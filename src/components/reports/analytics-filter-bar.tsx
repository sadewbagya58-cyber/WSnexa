'use client';

import React from 'react';
import { AnalyticsDatePreset } from '@/lib/analytics/analytics-types';

interface AnalyticsFilterBarProps {
  preset: AnalyticsDatePreset;
  onPresetChange: (preset: AnalyticsDatePreset) => void;
  startDate?: string;
  endDate?: string;
  onCustomDateChange: (start: string, end: string) => void;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  authorizedBranches: { id: string; name: string }[];
  isMultiBranchAuthorized: boolean;
  timezoneLabel?: string;
  isLoading?: boolean;
}

export function AnalyticsFilterBar({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onCustomDateChange,
  selectedBranchId,
  onBranchChange,
  authorizedBranches,
  isMultiBranchAuthorized,
  timezoneLabel = 'Asia/Colombo',
  isLoading = false,
}: AnalyticsFilterBarProps) {
  const presets: { key: AnalyticsDatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'last_7_days', label: 'Last 7 Days' },
    { key: 'last_30_days', label: 'Last 30 Days' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-2 hidden sm:inline">
            Range:
          </span>
          {presets.map((p) => {
            const active = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onPresetChange(p.key)}
                disabled={isLoading}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all min-h-[44px] flex items-center ${
                  active
                    ? 'bg-amber-500 text-black shadow-md font-bold'
                    : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                } disabled:opacity-50`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right: Branch Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-branch-select" className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0">
            Branch:
          </label>
          <select
            id="analytics-branch-select"
            aria-label="Select Target Branch for Analytics"
            value={selectedBranchId}
            onChange={(e) => onBranchChange(e.target.value)}
            disabled={isLoading}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs font-medium rounded-xl px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer disabled:opacity-50"
          >
            {isMultiBranchAuthorized && authorizedBranches.length > 1 && (
              <option value="all">🌐 All Authorized Branches ({authorizedBranches.length})</option>
            )}
            {authorizedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Picker Inputs */}
      {preset === 'custom' && (
        <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">Start Date:</span>
            <input
              type="datetime-local"
              aria-label="Custom Analytics Start Date"
              value={startDate ? startDate.slice(0, 16) : ''}
              onChange={(e) => onCustomDateChange(e.target.value, endDate || '')}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-1.5 min-h-[44px] focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">End Date:</span>
            <input
              type="datetime-local"
              aria-label="Custom Analytics End Date"
              value={endDate ? endDate.slice(0, 16) : ''}
              onChange={(e) => onCustomDateChange(startDate || '', e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-1.5 min-h-[44px] focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <span className="text-zinc-500 italic text-[11px]">
            Timezone: {timezoneLabel}
          </span>
        </div>
      )}
    </div>
  );
}

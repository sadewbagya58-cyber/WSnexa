'use client';

import React from 'react';
import { ReportPreset } from '@/lib/validation/report';

interface DateRangePickerProps {
  preset: ReportPreset;
  onPresetChange: (preset: ReportPreset) => void;
  startDate?: string;
  endDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
  timezone?: string;
}

export function DateRangePicker({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onCustomDateChange,
  timezone = 'Local Timezone',
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Period:</span>
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as ReportPreset)}
          className="bg-zinc-950 text-zinc-100 text-sm font-medium border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom Date Range</option>
        </select>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate ? startDate.split('T')[0] : ''}
            onChange={(e) => {
              if (onCustomDateChange && e.target.value && endDate) {
                onCustomDateChange(new Date(e.target.value).toISOString(), endDate);
              }
            }}
            className="bg-zinc-950 text-zinc-100 text-xs border border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-zinc-500 text-xs">to</span>
          <input
            type="date"
            value={endDate ? endDate.split('T')[0] : ''}
            onChange={(e) => {
              if (onCustomDateChange && startDate && e.target.value) {
                onCustomDateChange(startDate, new Date(e.target.value).toISOString());
              }
            }}
            className="bg-zinc-950 text-zinc-100 text-xs border border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      <div className="ml-auto text-xs text-zinc-500 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>{timezone}</span>
      </div>
    </div>
  );
}

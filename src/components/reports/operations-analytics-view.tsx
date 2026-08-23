'use client';

import React from 'react';
import { OperationsAnalyticsResult } from '@/server/analytics/operations-analytics';

interface OperationsAnalyticsViewProps {
  operations: OperationsAnalyticsResult;
}

export function OperationsAnalyticsView({ operations }: OperationsAnalyticsViewProps) {
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const cards = [
    {
      title: 'Order Acceptance Time',
      value: formatDuration(operations.avgOrderAcceptanceTime.value),
      subtitle: 'Submission → Confirmation',
      icon: '⚡',
      color: 'text-amber-400',
    },
    {
      title: 'Kitchen Prep Time',
      value: formatDuration(operations.avgKitchenPreparationTime.value),
      subtitle: 'Preparation → Ready',
      icon: '🍳',
      color: 'text-emerald-400',
    },
    {
      title: 'Total Fulfillment Time',
      value: formatDuration(operations.avgFulfillmentTime.value),
      subtitle: 'Submission → Completion',
      icon: '⏱️',
      color: 'text-blue-400',
    },
    {
      title: 'Pending Live Queue Depth',
      value: `${operations.pendingOrderCount.value || 0} Orders`,
      subtitle: 'Active pending, preparing, ready',
      icon: '🛎️',
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Speed Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span>{c.title}</span>
              <span className="text-base">{c.icon}</span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${c.color}`}>
              {c.value}
            </div>
            <div className="text-xs text-zinc-500 italic">{c.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Fulfillment Rates Grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>📊</span> Order Fulfillment & Disposition Rates
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-1">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Completion Rate</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {operations.completionRate.value !== null ? `${operations.completionRate.value}%` : 'N/A'}
            </div>
            <div className="text-[11px] text-zinc-500">Orders successfully served</div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-1">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Cancellation Rate</div>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {operations.cancellationRate.value !== null ? `${operations.cancellationRate.value}%` : 'N/A'}
            </div>
            <div className="text-[11px] text-zinc-500">Cancelled during prep/service</div>
          </div>

          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-1">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Rejection Rate</div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {operations.rejectionRate.value !== null ? `${operations.rejectionRate.value}%` : 'N/A'}
            </div>
            <div className="text-[11px] text-zinc-500">Rejected before kitchen prep</div>
          </div>
        </div>
      </div>
    </div>
  );
}

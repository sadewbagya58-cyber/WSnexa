'use client';

import React from 'react';
import { OperationalInsightDTO } from '@/lib/insights/insight-types';

interface ExecutiveOverviewInsightsCardProps {
  insights: OperationalInsightDTO[];
  onNavigateToInsights?: () => void;
}

export function ExecutiveOverviewInsightsCard({
  insights,
  onNavigateToInsights,
}: ExecutiveOverviewInsightsCardProps) {
  const activeInsights = insights.filter((i) => i.status === 'ACTIVE').slice(0, 4);

  if (activeInsights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <span>💡</span>
          <span>Key Operational Insights</span>
        </h3>
        {onNavigateToInsights && (
          <button
            type="button"
            onClick={onNavigateToInsights}
            className="min-h-[44px] px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <span>View All ({insights.length})</span>
            <span>→</span>
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {activeInsights.map((insight) => {
          let badgeColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
          let icon = 'ℹ️';

          if (insight.severity === 'CRITICAL') {
            badgeColor = 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
            icon = '🚨';
          } else if (insight.severity === 'WARNING') {
            badgeColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
            icon = '⚠️';
          } else if (insight.severity === 'SUCCESS') {
            badgeColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
            icon = '✅';
          }

          return (
            <div
              key={insight.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/60 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base select-none mt-0.5">{icon}</span>
                <div>
                  <div className="font-black text-zinc-900 dark:text-white">
                    {insight.title}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    {insight.summary}
                  </div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase shrink-0 ${badgeColor}`}
              >
                {insight.severity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

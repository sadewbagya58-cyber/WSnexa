'use client';

import React, { useState } from 'react';
import { OperationalInsightDTO, InsightSeverity } from '@/lib/insights/insight-types';

import { dismissInsightAction, restoreInsightAction } from '@/server/actions/insight';

interface InsightsTabProps {
  insights: OperationalInsightDTO[];
  onRefresh?: () => void;
}

export function InsightsTab({ insights, onRefresh }: InsightsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const categories: { key: string; label: string; icon: string }[] = [
    { key: 'ALL', label: 'All Insights', icon: '⚡' },
    { key: 'CRITICAL', label: 'Critical', icon: '🚨' },
    { key: 'WARNING', label: 'Warnings', icon: '⚠️' },
    { key: 'SALES', label: 'Sales', icon: '💰' },
    { key: 'OPERATIONS', label: 'Operations', icon: '⚙️' },
    { key: 'MENU', label: 'Menu', icon: '🍽️' },
    { key: 'INVENTORY', label: 'Inventory', icon: '📦' },
    { key: 'REPUTATION', label: 'Reputation', icon: '⭐' },
    { key: 'BRANCH', label: 'Branch Comparison', icon: '🏬' },
  ];

  const filtered = insights.filter((item) => {
    if (!showDismissed && item.status === 'DISMISSED') return false;

    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'CRITICAL') return item.severity === 'CRITICAL';
    if (selectedCategory === 'WARNING') return item.severity === 'WARNING';
    return item.category === selectedCategory;
  });

  const handleDismiss = async (insight: OperationalInsightDTO) => {
    setPendingId(insight.id);
    try {
      await dismissInsightAction(insight.ruleKey, insight.fingerprint, insight.branchId);
      if (onRefresh) onRefresh();
    } finally {
      setPendingId(null);
    }
  };

  const handleRestore = async (insight: OperationalInsightDTO) => {
    setPendingId(insight.id);
    try {
      await restoreInsightAction(insight.ruleKey, insight.fingerprint, insight.branchId);
      if (onRefresh) onRefresh();
    } finally {
      setPendingId(null);
    }
  };

  const getSeverityBadge = (severity: InsightSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            <span>🚨</span>
            <span>CRITICAL ALERT</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <span>⚠️</span>
            <span>WARNING</span>
          </span>
        );
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span>✅</span>
            <span>SUCCESS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            <span>ℹ️</span>
            <span>OBSERVATION</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Filter Pills & Dismiss Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer min-h-[44px] select-none">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-zinc-300 dark:border-zinc-700"
          />
          <span>Show Dismissed Insights</span>
        </label>
      </div>

      {/* Insights Cards List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="text-4xl mb-3">✨</div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">
            No Operational Insights Detected
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
            No significant operational anomalies or threshold breaches were detected for the selected period and category filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isPending = pendingId === item.id;
            const isDismissed = item.status === 'DISMISSED';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-xl border transition-colors ${
                  isDismissed
                    ? 'opacity-60 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(item.severity)}
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {item.branchName && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        📍 {item.branchName}
                      </span>
                    )}
                  </div>

                  {isDismissed ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRestore(item)}
                      className="min-h-[44px] px-3 py-1.5 rounded text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {isPending ? 'Restoring...' : 'Restore Insight'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDismiss(item)}
                      className="min-h-[44px] px-3 py-1.5 rounded text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    >
                      {isPending ? 'Dismissing...' : 'Dismiss'}
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {/* Evidence Section */}
                  {item.evidence.length > 0 && (
                    <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-2">
                        WHAT HAPPENED & EVIDENCE
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {item.evidence.map((ev, idx) => (
                          <div key={idx} className="flex flex-col text-xs">
                            <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                              {ev.label}
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white mt-0.5">
                              {ev.currentValue}
                              {ev.previousValue && (
                                <span className="text-zinc-500 font-normal ml-1">
                                  (prev: {ev.previousValue})
                                </span>
                              )}
                              {ev.changeFormatted && (
                                <span className="ml-1.5 font-bold text-amber-600 dark:text-amber-400">
                                  {ev.changeFormatted}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation Section */}
                  <div className="bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                    <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider mb-1 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>RECOMMENDED NEXT CHECK</span>
                    </div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">
                      {item.recommendation.title}: {item.recommendation.action}
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 italic">
                      Note: {item.recommendation.cautiousReasoning}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

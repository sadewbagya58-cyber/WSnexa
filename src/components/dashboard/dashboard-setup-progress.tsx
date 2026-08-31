'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SetupJourneyReport } from '@/lib/setup/setup-journey';

interface DashboardSetupProgressProps {
  businessName: string;
  report?: SetupJourneyReport;
  // Backward-compat props
  categoriesCount?: number;
  menuItemsCount?: number;
  serviceAreasCount?: number;
  tablesCount?: number;
  setupComplete?: boolean;
}

export const DashboardSetupProgress: React.FC<DashboardSetupProgressProps> = ({
  businessName,
  report,
  categoriesCount = 0,
  menuItemsCount = 0,
  serviceAreasCount = 0,
  tablesCount = 0,
  setupComplete = false,
}) => {
  // If report is provided, use data-derived completion
  const isComplete = report ? report.isCoreSetupComplete : setupComplete;

  // Once core setup is complete, collapse/remove from primary attention
  if (isComplete) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-emerald-900 font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-[10px]">
            ✓
          </span>
          <span>Core venue setup is complete for {businessName}.</span>
        </div>
        <Link href="/dashboard/setup" className="shrink-0 text-emerald-800 hover:text-emerald-950 font-bold underline">
          View Setup Journey →
        </Link>
      </div>
    );
  }

  // Derive counts from report or props
  const totalRequired = report?.totalRequired || 6;
  const completedRequired = report?.completedRequired || (
    (categoriesCount > 0 && menuItemsCount > 0 ? 1 : 0) +
    (serviceAreasCount > 0 && tablesCount > 0 ? 1 : 0) +
    2
  );
  const percentage = report?.overallPercentage || Math.round((completedRequired / totalRequired) * 100);
  const nextStage = report?.nextStage;

  return (
    <Card className="p-5 space-y-4 border-zinc-950/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Setup in Progress
            </span>
            <span className="text-xs text-zinc-400">• {completedRequired} of {totalRequired} core steps complete</span>
          </div>
          <h2 className="text-sm font-extrabold text-white">
            Complete your WSNexa venue setup
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/setup">
            <Button variant="outline" size="sm" className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-white text-xs h-9">
              All Stages
            </Button>
          </Link>
          {nextStage && (
            <Link href={nextStage.nextActionHref}>
              <button
                type="button"
                className="flex min-h-[36px] items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-zinc-950 font-extrabold text-xs hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-md touch-manipulation"
              >
                Continue Setup →
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
          <span>Readiness Progress</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(percentage, 8)}%` }}
          />
        </div>
      </div>

      {/* Next Step Banner */}
      {nextStage && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base select-none">{nextStage.icon}</span>
            <div className="min-w-0">
              <span className="font-bold text-white block truncate">
                Next: {nextStage.title}
              </span>
              <span className="text-[11px] text-zinc-400 truncate block">
                {nextStage.completionDetail}
              </span>
            </div>
          </div>
          <Link href={nextStage.nextActionHref} className="shrink-0 ml-2">
            <span className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
              {nextStage.nextActionLabel} →
            </span>
          </Link>
        </div>
      )}
    </Card>
  );
};


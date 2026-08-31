'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
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

  // Hydration-safe client-side dismissal state scoped to active business & branch
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const storageKey = React.useMemo(() => {
    if (report?.businessId && report?.branchId) {
      return `wsnexa_setup_card_hidden:${report.businessId}:${report.branchId}`;
    }
    return `wsnexa_setup_card_hidden:${businessName}`;
  }, [report?.businessId, report?.branchId, businessName]);

  React.useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(storageKey);
        if (stored === 'true') {
          setIsDismissed(true);
        }
      }
    } catch {
      // ignore storage access errors in sandboxed environments
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, 'true');
      }
    } catch {
      // ignore
    }
  };

  // State B & State C: If core setup is complete OR user dismissed the card, render nothing (no nagging, no reserved space)
  if (isComplete || (mounted && isDismissed)) {
    return null;
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
    <Card className="p-4 sm:p-5 space-y-4 border-zinc-950/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-xl rounded-2xl">
      {/* Top Header Row: Badges & Dismiss Action */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/90 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
            Core Setup
          </span>
          <span className="text-xs font-semibold text-zinc-300">
            {completedRequired} of {totalRequired} essential steps complete
          </span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors underline-offset-2 hover:underline shrink-0 touch-manipulation px-1 py-0.5"
          title="Hide setup assistant on dashboard (accessible anytime in Settings)"
        >
          Hide for now
        </button>
      </div>

      {/* Title & Progress Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-sm sm:text-base font-extrabold text-white">
            Finish your essential venue setup
          </h2>
          <span className="text-xs font-bold text-zinc-400">
            {percentage}% ready
          </span>
        </div>

        <div className="h-2 w-full bg-zinc-800/90 rounded-full overflow-hidden border border-zinc-700/40">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
            style={{ width: `${Math.max(percentage, 6)}%` }}
          />
        </div>
      </div>

      {/* Next Step Box (Stacked layout on mobile to prevent truncation; side-by-side on desktop) */}
      {nextStage && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/90 border border-zinc-700/80 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-base select-none border border-zinc-700">
              {nextStage.icon}
            </span>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Next Step
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-white leading-snug break-words">
                  {nextStage.title}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed break-words">
                {nextStage.completionDetail}
              </p>
            </div>
          </div>

          {/* Action Button Row: Full-width touch targets on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
            <Link href="/dashboard/setup" className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 hover:text-white font-bold text-xs transition-colors shadow-xs touch-manipulation"
              >
                View Setup
              </button>
            </Link>

            <Link href={nextStage.nextActionHref} className="w-full sm:w-auto">
              <button
                type="button"
                className="w-full sm:w-auto flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white text-zinc-950 font-black text-xs hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-md touch-manipulation"
              >
                {nextStage.nextActionLabel || 'Continue Setup'} →
              </button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
};



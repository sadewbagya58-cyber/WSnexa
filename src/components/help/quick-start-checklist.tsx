'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { QuickStartProgress } from '@/content/help/types';
import { Badge } from '@/components/ui/badge';

interface QuickStartChecklistProps {
  progress: QuickStartProgress;
}

export const QuickStartChecklist: React.FC<QuickStartChecklistProps> = ({ progress }) => {
  const [isExpanded, setIsExpanded] = useState(progress.percentage < 100);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-5">
      {/* Header & Progress Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚀</span>
            <div>
              <h2 className="text-base font-extrabold text-zinc-950">
                Venue Launch Readiness Checklist
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                {progress.completedSteps} of {progress.totalSteps} steps completed ({progress.percentage}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={progress.percentage === 100 ? 'success' : 'neutral'}
              className="font-black text-xs"
            >
              {progress.percentage === 100 ? 'Ready for Launch' : `${progress.percentage}% Ready`}
            </Badge>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-950 p-1.5 rounded-lg hover:bg-zinc-100 transition-all cursor-pointer"
            >
              {isExpanded ? 'Hide Steps ▲' : 'Show Steps ▼'}
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              progress.percentage === 100 ? 'bg-emerald-500' : 'bg-zinc-950'
            }`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      {isExpanded && (
        <div className="divide-y divide-zinc-100 pt-2">
          {progress.steps.map((step, idx) => (
            <div
              key={step.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${
                    step.isCompleted
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                  }`}
                >
                  {step.isCompleted ? '✓' : idx + 1}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="font-extrabold text-zinc-950 flex items-center gap-2">
                    <span className={step.isCompleted ? 'line-through text-zinc-400' : ''}>
                      {step.title}
                    </span>
                    {step.isCompleted && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-8 sm:pl-0">
                <Link
                  href={`/dashboard/help/${step.guideSlug}`}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 active:scale-[0.97] transition-all"
                >
                  📖 Read Guide
                </Link>
                <Link
                  href={step.route}
                  className="rounded-xl bg-zinc-950 px-3 py-1 text-[11px] font-extrabold text-white hover:bg-zinc-800 active:scale-[0.97] transition-all"
                >
                  Go to Setup →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

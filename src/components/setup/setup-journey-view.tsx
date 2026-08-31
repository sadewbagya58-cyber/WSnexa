'use client';

import React from 'react';
import Link from 'next/link';
import { SetupJourneyReport, SetupStageState } from '@/lib/setup/setup-journey';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SetupJourneyViewProps {
  report: SetupJourneyReport;
}

export const SetupJourneyView: React.FC<SetupJourneyViewProps> = ({ report }) => {
  const requiredStages = report.stages.filter((s) => s.tier === 'required');
  const recommendedStages = report.stages.filter((s) => s.tier === 'recommended');
  const optionalStages = report.stages.filter((s) => s.tier === 'optional');

  const renderStatusBadge = (stage: SetupStageState) => {
    if (stage.isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          <span className="text-xs">✓</span> Completed
        </span>
      );
    }
    if (stage.status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
          <span className="animate-pulse">●</span> In Progress
        </span>
      );
    }
    if (stage.status === 'blocked') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
          🔒 Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
        ○ Not Started
      </span>
    );
  };

  const renderStageCard = (stage: SetupStageState) => {
    const isNext = report.nextStage?.id === stage.id;

    return (
      <Card
        key={stage.id}
        className={`p-5 space-y-4 transition-all duration-150 ${
          isNext
            ? 'border-2 border-zinc-950 bg-white shadow-md'
            : stage.isCompleted
            ? 'border-zinc-200/80 bg-zinc-50/40'
            : 'border-zinc-200 bg-white'
        }`}
      >
        {/* Stage Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg select-none">
              {stage.icon}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-zinc-950 truncate">{stage.title}</h3>
                {isNext && (
                  <Badge variant="neutral" className="bg-zinc-950 text-white text-[10px] uppercase tracking-wider">
                    Recommended Next Step
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500 line-clamp-1">{stage.description}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
            {renderStatusBadge(stage)}
          </div>
        </div>

        {/* Completion Detail Text */}
        <div className="text-xs">
          <span className="font-semibold text-zinc-700">Current Status: </span>
          <span className={stage.isCompleted ? 'text-emerald-700 font-medium' : 'text-zinc-600'}>
            {stage.completionDetail}
          </span>
        </div>

        {/* Substeps Checklist (if available) */}
        {stage.substeps && stage.substeps.length > 0 && (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Milestones
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stage.substeps.map((sub) => (
                <Link
                  key={sub.id}
                  href={sub.href}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-zinc-200/60 hover:border-zinc-300 hover:bg-zinc-50 transition-colors text-xs touch-manipulation"
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      sub.isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-500'
                    }`}>
                      {sub.isCompleted ? '✓' : '○'}
                    </span>
                    <span className={`truncate font-medium ${sub.isCompleted ? 'text-zinc-900' : 'text-zinc-600'}`}>
                      {sub.label}
                    </span>
                  </div>
                  <span className="text-zinc-400 text-xs shrink-0 select-none">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Action Button Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-400">
            {stage.scope === 'BRANCH' ? `📍 Scoped to ${report.branchName}` : '🏢 Organization-wide setting'}
          </span>
          <Link href={stage.nextActionHref} className="shrink-0">
            <Button
              variant={isNext ? 'primary' : stage.isCompleted ? 'outline' : 'primary'}
              size="sm"
              className="min-h-[40px] px-4 font-bold text-xs"
            >
              {stage.nextActionLabel} →
            </Button>
          </Link>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" className="text-xs font-semibold">
            🏢 {report.businessName}
          </Badge>
          <span className="text-zinc-300 select-none">|</span>
          <Badge variant="neutral" className="text-xs font-semibold">
            📍 {report.branchName}
          </Badge>
        </div>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
          Guided Business Setup & Onboarding
        </h1>
        <p className="text-sm text-zinc-600">
          Follow this structured journey to configure your venue, build your menu, set up dining QR codes, and prepare for live operations.
        </p>
      </div>

      {/* ── Overall Progress Hero Card ─────────────────────────── */}
      <Card className="p-6 border-zinc-950/10 bg-gradient-to-br from-zinc-900 to-zinc-950 text-white space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
              Core Setup Journey
            </span>
            <h2 className="text-xl font-extrabold">
              {report.isCoreSetupComplete
                ? '🎉 Core Venue Setup Complete'
                : `${report.completedRequired} of ${report.totalRequired} Core Setup Steps Complete`}
            </h2>
            <p className="text-xs text-zinc-300">
              {report.isCoreSetupComplete
                ? 'Your primary branch is configured with dining areas, menu items, order security, and testing.'
                : `Next Action: ${report.nextStage?.title || 'Review Setup'}`}
            </p>
          </div>

          {report.nextStage && (
            <Link href={report.nextStage.nextActionHref} className="shrink-0">
              <button
                type="button"
                className="flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-zinc-950 font-black text-xs uppercase tracking-wider hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-lg touch-manipulation"
              >
                Continue Setup →
              </button>
            </Link>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
            <span>Core Hospitality Readiness</span>
            <span>{report.overallPercentage}%</span>
          </div>
          <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(report.overallPercentage, 5)}%` }}
            />
          </div>
        </div>

        {/* Stage Pills Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-zinc-800/80">
          {requiredStages.map((s) => (
            <div
              key={s.id}
              className={`p-2 rounded-lg text-center text-xs space-y-0.5 border ${
                s.isCompleted
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                  : report.nextStage?.id === s.id
                  ? 'bg-zinc-800 border-white text-white font-black'
                  : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400'
              }`}
            >
              <div className="text-sm select-none">{s.icon}</div>
              <div className="truncate text-[11px]">{s.shortTitle}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider">
                {s.isCompleted ? '✓ Done' : report.nextStage?.id === s.id ? '● Next' : '○ Todo'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 1. Core Setup Stages (Required) ────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <div>
            <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
              1. Core Setup (Required for Ordering)
            </h2>
            <p className="text-xs text-zinc-500">
              These fundamental steps establish your dining space, digital menu, security gates, and order flow.
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full">
            {report.completedRequired} / {report.totalRequired} Complete
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {requiredStages.map((stage) => renderStageCard(stage))}
        </div>
      </section>

      {/* ── 2. Recommended Enhancements ────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <div>
            <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
              2. Recommended Enhancements
            </h2>
            <p className="text-xs text-zinc-500">
              Invite your staff members and publish your venue profile for customer discovery.
            </p>
          </div>
          <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full">
            {report.completedRecommended} / {report.totalRecommended} Complete
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {recommendedStages.map((stage) => renderStageCard(stage))}
        </div>
      </section>

      {/* ── 3. Optional Operations & Supply Chain ───────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <div>
            <h2 className="text-base font-black text-zinc-950 uppercase tracking-wide">
              3. Optional Operations & Supply Chain
            </h2>
            <p className="text-xs text-zinc-500">
              Advanced inventory, recipe bill of materials (BOM), supplier management, and purchase orders.
            </p>
          </div>
          <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
            Optional
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {optionalStages.map((stage) => renderStageCard(stage))}
        </div>
      </section>
    </div>
  );
};
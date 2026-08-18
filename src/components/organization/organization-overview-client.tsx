'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { reconcileAssignmentLifecycleAction } from '@/server/actions/organization';

interface OrganizationOverviewProps {
  summary: {
    totalMembers: number;
    activePrimaryAssignments: number;
    departmentsCount: number;
    unitsCount: number;
    positionsCount: number;
    totalHeadcountLimit: number;
    occupiedPositionsCount: number;
    vacantPositionsCount: number;
    activeActingCount: number;
    activeSecondmentsCount: number;
    activeTemporaryCount: number;
    activeAbsencesCount: number;
    integrityIssuesCount: number;
    criticalIssuesCount: number;
  };
  recentIssues: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    assignmentId?: string;
  }>;
  canManage: boolean;
}

export function OrganizationOverviewClient({
  summary,
  recentIssues,
  canManage,
}: OrganizationOverviewProps) {
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState<string | null>(null);

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileMsg(null);
    try {
      const res = await reconcileAssignmentLifecycleAction();
      if (res.success) {
        setReconcileMsg(res.message || 'Organization assignment lifecycle reconciled successfully.');
      } else {
        setReconcileMsg(`Error: ${res.message || 'Reconciliation failed'}`);
      }
    } catch (err: unknown) {
      setReconcileMsg(err instanceof Error ? err.message : 'Failed to reconcile lifecycle');
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
            Organization & Workforce Hub
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enterprise structure, position headcount, reporting chains, and active leadership coverage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/organization/chart">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              📊 Visual Org Chart
            </Button>
          </Link>
          <Link href="/dashboard/people">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              👥 People Directory
            </Button>
          </Link>
          {canManage && (
            <Button
              onClick={handleReconcile}
              disabled={isReconciling}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
            >
              {isReconciling ? 'Reconciling...' : '⚡ Reconcile Lifecycle'}
            </Button>
          )}
        </div>
      </div>

      {reconcileMsg && (
        <div className="rounded-xl bg-emerald-950/60 border border-emerald-800/80 p-3.5 text-xs text-emerald-300">
          {reconcileMsg}
        </div>
      )}

      {/* Integrity Alert Banner if issues exist */}
      {summary.integrityIssuesCount > 0 && (
        <div className="rounded-2xl bg-amber-950/30 border border-amber-800/50 p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                {summary.integrityIssuesCount} Organization Diagnostics Detected
                {summary.criticalIssuesCount > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-300">
                    {summary.criticalIssuesCount} Critical
                  </span>
                )}
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Branch access alignment mismatches, missing supervisors, or expired temporary roles detected.
              </p>
            </div>
          </div>
          <Link href="/dashboard/people/integrity">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold whitespace-nowrap">
              Review Diagnostics Center →
            </Button>
          </Link>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Active Staff</div>
          <div className="text-3xl font-extrabold text-zinc-100">{summary.totalMembers}</div>
          <div className="text-xs text-emerald-400 font-medium">
            {summary.activePrimaryAssignments} Primary Roles Placed
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Departments & Units</div>
          <div className="text-3xl font-extrabold text-zinc-100">{summary.departmentsCount}</div>
          <div className="text-xs text-zinc-400 font-medium">
            {summary.unitsCount} Operational Sections / Teams
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Position Headcount</div>
          <div className="text-3xl font-extrabold text-zinc-100">
            {summary.occupiedPositionsCount} <span className="text-base text-zinc-400 font-normal">/ {summary.positionsCount} Filled</span>
          </div>
          <div className="text-xs text-blue-400 font-medium">
            {summary.vacantPositionsCount} Vacant Position Slots
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Temporary & Coverage</div>
          <div className="text-3xl font-extrabold text-purple-400">{summary.activeActingCount}</div>
          <div className="text-xs text-purple-300/80 font-medium">
            Acting Roles • {summary.activeSecondmentsCount} Seconded • {summary.activeAbsencesCount} Absences
          </div>
        </div>
      </div>

      {/* Domain Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/dashboard/organization/structure"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-emerald-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🏢</span>
            <span className="text-xs text-zinc-500 group-hover:text-emerald-400 transition-colors">Manage →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              Structure & Departments
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Corporate group departments, property-specific departments, and nested operational stations/teams.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/organization/positions"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-emerald-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🪑</span>
            <span className="text-xs text-zinc-500 group-hover:text-emerald-400 transition-colors">Manage →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              Positions & Headcount
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Authorized position slots, capacity limits, substantive occupants, and live acting coverage badges.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/organization/job-titles"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-emerald-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🎖️</span>
            <span className="text-xs text-zinc-500 group-hover:text-emerald-400 transition-colors">Manage →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              Job Titles & Hierarchy Levels
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Seniority rank structure, executive to operational tiers, and standardized job title catalog.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/people/acting"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-purple-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🎭</span>
            <span className="text-xs text-zinc-500 group-hover:text-purple-400 transition-colors">Manage →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors">
              Acting & Coverage Hub
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Temporary leadership appointments, absence coverage, and automated effective reporting routing.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/people/secondments"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-blue-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">✈️</span>
            <span className="text-xs text-zinc-500 group-hover:text-blue-400 transition-colors">Manage →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-blue-300 transition-colors">
              Cross-Property Secondments
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Inter-branch employee taskforce placements with home property substantive preservation.
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/people/integrity"
          className="group rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 hover:border-amber-500/50 hover:bg-zinc-900/80 transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🛡️</span>
            <span className="text-xs text-zinc-500 group-hover:text-amber-400 transition-colors">Inspect →</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors">
              Integrity & Diagnostics
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Real-time anomaly scanner for branch access alignment, reporting tree gaps, and lifecycle audits.
            </p>
          </div>
        </Link>
      </div>

      {/* Quick Diagnostics Snapshot */}
      {recentIssues.length > 0 && (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
              Recent Integrity Diagnostics ({recentIssues.length})
            </h3>
            <Link href="/dashboard/people/integrity" className="text-xs text-emerald-400 hover:text-emerald-300">
              View All Diagnostics →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentIssues.slice(0, 3).map((issue, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-zinc-950 border border-zinc-800/60 p-3 flex items-start space-x-3 text-xs"
              >
                <span className="mt-0.5">
                  {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-zinc-200">{issue.message}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">Category: {issue.type}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

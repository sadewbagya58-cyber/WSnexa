'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { reconcileAssignmentLifecycleAction } from '@/server/actions/organization';

interface IntegrityIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  assignmentId?: string;
  membershipId?: string;
  positionId?: string;
}

interface IntegrityCenterClientProps {
  issues: IntegrityIssue[];
  canManage: boolean;
}

export function IntegrityCenterClient({
  issues,
  canManage,
}: IntegrityCenterClientProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);

  const filteredIssues = issues.filter((i) => {
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    return true;
  });

  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileResult(null);
    try {
      const res = await reconcileAssignmentLifecycleAction();
      if (res.success) {
        setReconcileResult(res.message || 'Lifecycle reconciled successfully.');
      } else {
        setReconcileResult(`Error: ${res.message || 'Reconciliation failed'}`);
      }
    } catch (err: unknown) {
      setReconcileResult(err instanceof Error ? err.message : 'Failed to reconcile lifecycle');
    } finally {
      setIsReconciling(false);
    }
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Organization Integrity & Diagnostics Center
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated workforce governance scanner detecting structural mismatches and temporal anomalies
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
          >
            {isReconciling ? 'Reconciling...' : '⚡ Reconcile All Lifecycles'}
          </Button>
        )}
      </div>

      {reconcileResult && (
        <div className="rounded-xl bg-emerald-950/60 border border-emerald-800/80 p-3.5 text-xs text-emerald-300">
          {reconcileResult}
        </div>
      )}

      {/* Summary Filter Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setSeverityFilter('all')}
          className={`rounded-2xl border p-4 text-left transition-all ${
            severityFilter === 'all'
              ? 'border-zinc-500 bg-zinc-800/80 text-zinc-100'
              : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">All Diagnostics</div>
          <div className="text-2xl font-extrabold mt-1 text-zinc-100">{issues.length}</div>
        </button>

        <button
          onClick={() => setSeverityFilter('error')}
          className={`rounded-2xl border p-4 text-left transition-all ${
            severityFilter === 'error'
              ? 'border-red-500 bg-red-950/40 text-red-200'
              : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Critical Errors</div>
          <div className="text-2xl font-extrabold mt-1 text-red-300">{errorCount}</div>
        </button>

        <button
          onClick={() => setSeverityFilter('warning')}
          className={`rounded-2xl border p-4 text-left transition-all ${
            severityFilter === 'warning'
              ? 'border-amber-500 bg-amber-950/40 text-amber-200'
              : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Warnings</div>
          <div className="text-2xl font-extrabold mt-1 text-amber-300">{warningCount}</div>
        </button>

        <button
          onClick={() => setSeverityFilter('info')}
          className={`rounded-2xl border p-4 text-left transition-all ${
            severityFilter === 'info'
              ? 'border-blue-500 bg-blue-950/40 text-blue-200'
              : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Advisory Info</div>
          <div className="text-2xl font-extrabold mt-1 text-blue-300">{infoCount}</div>
        </button>
      </div>

      {/* Diagnostics List */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">🛡️</span>
            <div className="text-sm font-semibold text-emerald-400">Organization Healthy</div>
            <div className="text-xs text-zinc-500">No issues found matching the selected severity filter.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredIssues.map((issue, idx) => {
              const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
              const badgeClass =
                issue.severity === 'error'
                  ? 'bg-red-950 border-red-800 text-red-300'
                  : issue.severity === 'warning'
                  ? 'bg-amber-950 border-amber-800 text-amber-300'
                  : 'bg-blue-950 border-blue-800 text-blue-300';

              return (
                <div key={idx} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-850/20 transition-colors">
                  <div className="flex items-start space-x-3.5">
                    <span className="text-xl mt-0.5">{icon}</span>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeClass}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs font-mono text-zinc-500 uppercase">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">{issue.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start md:self-auto">
                    {issue.membershipId && (
                      <Link href={`/dashboard/people/${issue.membershipId}`}>
                        <Button size="sm" variant="outline" className="text-xs h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                          Inspect Member →
                        </Button>
                      </Link>
                    )}
                    {issue.positionId && (
                      <Link href="/dashboard/organization/positions">
                        <Button size="sm" variant="outline" className="text-xs h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                          Inspect Position →
                        </Button>
                      </Link>
                    )}
                    {issue.type.startsWith('temporal_anomaly') && canManage && (
                      <Button
                        size="sm"
                        onClick={handleReconcile}
                        disabled={isReconciling}
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        Auto-Reconcile
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

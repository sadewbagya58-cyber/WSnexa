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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Organization Integrity & Diagnostics Center
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Automated workforce governance scanner detecting structural mismatches and temporal anomalies
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm"
          >
            {isReconciling ? 'Reconciling...' : 'Reconcile All Lifecycles'}
          </Button>
        )}
      </div>

      {reconcileResult && (
        <div className="rounded-lg bg-zinc-100 border border-zinc-200 p-3.5 text-xs text-zinc-900 font-medium">
          {reconcileResult}
        </div>
      )}

      {/* Summary Filter Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setSeverityFilter('all')}
          className={`rounded-xl border p-4 text-left transition-all shadow-xs ${
            severityFilter === 'all'
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wider ${severityFilter === 'all' ? 'text-zinc-300' : 'text-zinc-400'}`}>
            All Diagnostics
          </div>
          <div className={`text-2xl font-extrabold mt-1 ${severityFilter === 'all' ? 'text-white' : 'text-zinc-900'}`}>
            {issues.length}
          </div>
        </button>

        <button
          onClick={() => setSeverityFilter('error')}
          className={`rounded-xl border p-4 text-left transition-all shadow-xs ${
            severityFilter === 'error'
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wider ${severityFilter === 'error' ? 'text-red-100' : 'text-red-600'}`}>
            Critical Errors
          </div>
          <div className={`text-2xl font-extrabold mt-1 ${severityFilter === 'error' ? 'text-white' : 'text-red-600'}`}>
            {errorCount}
          </div>
        </button>

        <button
          onClick={() => setSeverityFilter('warning')}
          className={`rounded-xl border p-4 text-left transition-all shadow-xs ${
            severityFilter === 'warning'
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wider ${severityFilter === 'warning' ? 'text-amber-100' : 'text-amber-700'}`}>
            Warnings
          </div>
          <div className={`text-2xl font-extrabold mt-1 ${severityFilter === 'warning' ? 'text-white' : 'text-amber-700'}`}>
            {warningCount}
          </div>
        </button>

        <button
          onClick={() => setSeverityFilter('info')}
          className={`rounded-xl border p-4 text-left transition-all shadow-xs ${
            severityFilter === 'info'
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
          }`}
        >
          <div className={`text-[10px] font-semibold uppercase tracking-wider ${severityFilter === 'info' ? 'text-zinc-300' : 'text-zinc-500'}`}>
            Advisory Info
          </div>
          <div className={`text-2xl font-extrabold mt-1 ${severityFilter === 'info' ? 'text-white' : 'text-zinc-900'}`}>
            {infoCount}
          </div>
        </button>
      </div>

      {/* Diagnostics List */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">🛡️</span>
            <div className="text-sm font-semibold text-zinc-900">Organization Healthy</div>
            <div className="text-xs text-zinc-500">No issues found matching the selected severity filter.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredIssues.map((issue, idx) => {
              const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
              const badgeClass =
                issue.severity === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : issue.severity === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700';

              return (
                <div key={idx} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-50/70 transition-colors">
                  <div className="flex items-start space-x-3.5">
                    <span className="text-xl mt-0.5">{icon}</span>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeClass}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs font-mono text-zinc-400 uppercase">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-zinc-900">{issue.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start md:self-auto">
                    {issue.membershipId && (
                      <Link href={`/dashboard/people/${issue.membershipId}`}>
                        <Button size="sm" variant="outline" className="text-xs h-8 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium">
                          Inspect Member &rarr;
                        </Button>
                      </Link>
                    )}
                    {issue.positionId && (
                      <Link href="/dashboard/organization/positions">
                        <Button size="sm" variant="outline" className="text-xs h-8 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium">
                          Inspect Position &rarr;
                        </Button>
                      </Link>
                    )}
                    {issue.type.startsWith('temporal_anomaly') && canManage && (
                      <Button
                        size="sm"
                        onClick={handleReconcile}
                        disabled={isReconciling}
                        className="text-xs h-8 bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
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

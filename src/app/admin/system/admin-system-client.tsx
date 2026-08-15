'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformHealthReport } from '@/server/services/launch-readiness.service';
import { runLaunchDiagnosticsAction } from '@/server/actions/launch-readiness';

interface AdminSystemClientProps {
  initialReport: PlatformHealthReport;
}

export function AdminSystemClient({ initialReport }: AdminSystemClientProps) {
  const [report, setReport] = useState<PlatformHealthReport>(initialReport);
  const [loading, setLoading] = useState(false);

  const handleRunAudit = async () => {
    setLoading(true);
    const res = await runLaunchDiagnosticsAction();
    setLoading(false);

    if (res.success && res.report) {
      setReport(res.report);
    }
  };

  const getStatusBadge = (status: PlatformHealthReport['status']) => {
    switch (status) {
      case 'READY_FOR_LAUNCH':
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-xs">✓ OPERATIONAL</Badge>;
      case 'NEEDS_ATTENTION':
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-xs">⚠ WARNINGS DETECTED</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-900 border-red-300 font-extrabold text-xs">⛔ CRITICAL ISSUES</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-zinc-400">System Diagnostics</span>
              {getStatusBadge(report.status)}
            </div>
            <h2 className="text-xl font-black text-zinc-950 mt-1">Platform Infrastructure & Health</h2>
            <p className="text-xs font-semibold text-zinc-500">
              Audited at: {new Date(report.timestamp).toLocaleTimeString()} ({report.checks.length} checks performed)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-black text-zinc-950">{report.score}%</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">Health Score</div>
          </div>

          <Button
            type="button"
            onClick={handleRunAudit}
            disabled={loading}
            className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs px-5 rounded-2xl min-h-[44px]"
          >
            {loading ? 'Auditing...' : '🔄 Run Full Audit'}
          </Button>
        </div>
      </div>

      {/* Diagnostics Check List */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-base font-black text-zinc-950">Diagnostic Audit Checks</h3>
          <p className="text-xs font-semibold text-zinc-500">
            Live verification of database connectivity, auth configuration, secret masking, storage, and security contracts.
          </p>
        </div>

        <div className="divide-y divide-zinc-100">
          {report.checks.map((chk) => (
            <div key={chk.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-zinc-950">{chk.name}</span>
                  <Badge variant="neutral" className="text-[10px] font-mono capitalize">
                    {chk.category}
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-zinc-600 leading-relaxed">{chk.details}</p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {chk.latencyMs != null && (
                  <span className="text-[10px] font-mono font-bold text-zinc-400">{chk.latencyMs}ms</span>
                )}
                {chk.status === 'operational' && (
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
                    ✓ Passed
                  </Badge>
                )}
                {chk.status === 'warning' && (
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-bold text-[10px]">
                    ⚠ Warning
                  </Badge>
                )}
                {chk.status === 'critical' && (
                  <Badge className="bg-red-50 text-red-800 border-red-200 font-bold text-[10px]">
                    ⛔ Critical
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

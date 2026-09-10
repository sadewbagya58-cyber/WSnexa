import React from 'react';
import Link from 'next/link';
import { SystemStatusService, SubsystemStatus } from '@/server/services/system-status.service';
import { OFFICIAL_BUSINESS_INFO } from '@/content/legal/registry';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'System & Service Status | WSNexa',
  description: 'Authoritative live operational status of WSNexa platform engines, database services, and operational components.',
};

function formatStatusBadge(status: SubsystemStatus) {
  switch (status) {
    case 'operational':
      return {
        label: 'Operational',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500',
      };
    case 'degraded_performance':
      return {
        label: 'Degraded Performance',
        colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    case 'partial_outage':
      return {
        label: 'Partial Outage',
        colorClass: 'bg-orange-50 text-orange-800 border-orange-200',
        dotClass: 'bg-orange-500',
      };
    case 'major_outage':
      return {
        label: 'Major Outage',
        colorClass: 'bg-red-50 text-red-800 border-red-200',
        dotClass: 'bg-red-500',
      };
    case 'maintenance':
      return {
        label: 'Maintenance',
        colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
        dotClass: 'bg-blue-500',
      };
  }
}

export default async function SystemStatusPage() {
  const statusReport = await SystemStatusService.getAuthoritativeStatus();
  const overall = formatStatusBadge(statusReport.overallStatus);

  const formattedTime = new Date(statusReport.lastCheckedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-extrabold uppercase tracking-wider">
              <span>🚦</span>
              <span>Authoritative Platform Health</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              WSNexa System & Service Status
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 font-medium">
              Real-time connectivity and subsystem health indicators across all operational modules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/status"
              className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-xs font-bold hover:border-zinc-950 transition-all shadow-2xs"
            >
              🔄 Refresh Status
            </Link>
          </div>
        </div>

        {/* Hero Status Banner */}
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6 ${overall.colorClass}`}>
          <div className="flex items-center gap-4 text-center sm:text-left">
            <span className="relative flex h-5 w-5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${overall.dotClass}`} />
              <span className={`relative inline-flex rounded-full h-5 w-5 ${overall.dotClass}`} />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">
                {statusReport.overallMessage}
              </h2>
              <p className="text-xs opacity-80 font-semibold mt-0.5">
                Last checked: {formattedTime} • Database roundtrip:{' '}
                {statusReport.databaseLatencyMs ? `${statusReport.databaseLatencyMs}ms` : 'Connecting...'}
              </p>
            </div>
          </div>

          <span className="text-xs font-black uppercase px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-xs border border-current shadow-2xs">
            {overall.label}
          </span>
        </div>

        {/* Subsystems Health List */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-base font-black text-zinc-950">
              Operational Subsystems
            </h2>
            <span className="text-xs text-zinc-400 font-bold">
              {statusReport.subsystems.length} components monitored
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {statusReport.subsystems.map((sub) => {
              const badge = formatStatusBadge(sub.status);
              return (
                <div
                  key={sub.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-950">
                        {sub.name}
                      </span>
                      {sub.responseTimeMs !== undefined && (
                        <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                          {sub.responseTimeMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">
                      {sub.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className={`text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${badge.colorClass} inline-flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Incidents & Maintenance */}
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-xs space-y-4">
          <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
            <span>📋</span>
            <span>Incident & Maintenance Log</span>
          </h2>

          {statusReport.activeIncidents.length === 0 ? (
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-600 font-medium flex items-center gap-3">
              <span className="text-lg">✓</span>
              <span>No active incidents or unscheduled downtime reported today. All core services are operating within normal parameters.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {statusReport.activeIncidents.map((inc) => (
                <div key={inc.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs">
                  <h3 className="font-bold text-amber-950">{inc.title}</h3>
                  <p className="text-amber-800">{inc.impact}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Definitions & Clarification */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-6 space-y-3 text-xs text-zinc-600 font-medium leading-relaxed">
          <h3 className="font-black text-zinc-950 uppercase tracking-wider">
            Status Measurement Principles
          </h3>
          <p>
            WSNexa does not present simulated or fabricated 99.999% uptime figures. This status page performs genuine live health probes against database connectivity, application routing, and auth resolvers to give operators and dining guests an honest view of current platform health.
          </p>
          <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap gap-x-6 gap-y-1 text-zinc-500 font-semibold">
            <span>Official Inquiries: {OFFICIAL_BUSINESS_INFO.supportEmail}</span>
            <span>Support: {OFFICIAL_BUSINESS_INFO.phone}</span>
            <span>Address: {OFFICIAL_BUSINESS_INFO.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

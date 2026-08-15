import React from 'react';
import Link from 'next/link';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Overview — Super Admin | WSNexa',
  description: 'Platform health diagnostics, venue lifecycle statistics, and platform operations.',
};

export default async function AdminOverviewPage() {
  const data = await SuperAdminService.getPlatformOverview();
  const { metrics, recentVenues, recentAuditLogs, healthScore, healthStatus } = data;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Platform Control Center
            </Badge>
            <Badge
              className={`text-[10px] font-black uppercase ${
                healthStatus === 'READY_FOR_LAUNCH'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              {healthStatus === 'READY_FOR_LAUNCH' ? '✓ System Operational' : '⚠ Action Recommended'}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1.5">
            Platform Operations & Control
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-1">
            Real-time platform metrics, venue publication management, and security oversight across all WSNexa tenants.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/admin/venues/new"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs font-black text-black shadow-2xs transition-all active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Create Venue</span>
          </Link>

          <Link
            href="/admin/pilot"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 px-4 py-2.5 text-xs font-black text-white shadow-2xs transition-all active:scale-[0.98]"
          >
            <span>🧪</span>
            <span>Pilot Venues</span>
          </Link>

          <Link
            href="/admin/launch-readiness"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2.5 text-xs font-extrabold text-zinc-800 transition-all active:scale-[0.98]"
          >
            <span>🚀</span>
            <span>Launch Readiness</span>
          </Link>
        </div>
      </div>

      {/* System Health Snapshot + Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Health Score Card */}
        <div className="md:col-span-1 rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">System Health</span>
            <span className="text-xl">🛡️</span>
          </div>
          <div className="my-4 flex items-baseline gap-2">
            <span className="text-4xl font-black text-zinc-950">{healthScore}%</span>
            <span className="text-xs font-bold text-zinc-500">Readiness Score</span>
          </div>
          <Link
            href="/admin/system"
            className="text-xs font-black text-amber-600 hover:text-amber-700 underline"
          >
            Inspect System Diagnostics →
          </Link>
        </div>

        {/* Metric Cards */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Live Venues</span>
            <span>🏛️</span>
          </div>
          <div className="text-3xl font-black text-zinc-950">{metrics.publishedVenues}</div>
          <div className="text-[11px] font-semibold text-zinc-500">
            {metrics.draftVenues} draft | {metrics.suspendedVenues} suspended
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Businesses</span>
            <span>🏢</span>
          </div>
          <div className="text-3xl font-black text-zinc-950">{metrics.totalBusinesses}</div>
          <div className="text-[11px] font-semibold text-zinc-500">
            {metrics.activeBranches} active branches ({metrics.totalBranches} total)
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Super Admins</span>
            <span>🛡️</span>
          </div>
          <div className="text-3xl font-black text-zinc-950">{metrics.superAdminsCount}</div>
          <div className="text-[11px] font-semibold text-zinc-500">
            {metrics.totalStaff} staff | {metrics.totalCustomers} customers
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Ordering Enabled</div>
          <div className="text-xl font-black text-zinc-950 mt-0.5">{metrics.orderingVenues} Venues</div>
          <div className="text-[10px] font-semibold text-emerald-700">Digital ordering active</div>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Pilot / Demos</div>
          <div className="text-xl font-black text-zinc-950 mt-0.5">{metrics.pilotVenues} Venues</div>
          <div className="text-[10px] font-semibold text-zinc-500">Isolated launch partners</div>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Total Orders</div>
          <div className="text-xl font-black text-zinc-950 mt-0.5">{metrics.totalOrders}</div>
          <div className="text-[10px] font-semibold text-zinc-500">Platform orders processed</div>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70">
          <div className="text-[10px] font-black text-zinc-400 uppercase">Draft Venues</div>
          <div className="text-xl font-black text-zinc-950 mt-0.5">{metrics.draftVenues}</div>
          <div className="text-[10px] font-semibold text-zinc-500">Pending publication</div>
        </div>
      </div>

      {/* Main Content Grid: Recent Venues & Recent Admin Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Venues */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-zinc-950">Recent Venues</h2>
              <p className="text-xs font-semibold text-zinc-500">Latest venues registered on WSNexa</p>
            </div>
            <Link
              href="/admin/venues"
              className="text-xs font-extrabold text-amber-600 hover:text-amber-700"
            >
              View All ({metrics.publishedVenues + metrics.draftVenues}) →
            </Link>
          </div>

          <div className="divide-y divide-zinc-100">
            {recentVenues.length === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-zinc-400">No venues created yet.</p>
            ) : (
              recentVenues.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/venues/${v.id}`}
                      className="font-extrabold text-xs text-zinc-950 hover:text-amber-600 truncate block"
                    >
                      {v.displayName}
                    </Link>
                    <div className="text-[11px] text-zinc-500 truncate">
                      🏢 {v.businessName} • 📍 {v.city}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {v.isSuspended ? (
                      <Badge className="bg-red-100 text-red-900 border-red-300 font-extrabold text-[9px]">
                        SUSPENDED
                      </Badge>
                    ) : v.isPublished ? (
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-[9px]">
                        LIVE
                      </Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-700 font-bold text-[9px]">
                        DRAFT
                      </Badge>
                    )}
                    <Link
                      href={`/admin/venues/${v.id}`}
                      className="text-[11px] font-extrabold text-zinc-600 hover:text-zinc-950"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Admin Audit Logs */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-zinc-950">Recent Platform Actions</h2>
              <p className="text-xs font-semibold text-zinc-500">Security audit log activity</p>
            </div>
            <Link
              href="/admin/audit"
              className="text-xs font-extrabold text-amber-600 hover:text-amber-700"
            >
              View Full Log →
            </Link>
          </div>

          <div className="divide-y divide-zinc-100">
            {recentAuditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-zinc-400">No administrative logs recorded yet.</p>
            ) : (
              recentAuditLogs.map((l) => (
                <div key={l.id} className="py-3 space-y-1 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-zinc-900">{l.action}</span>
                    <span className="text-[10px] text-zinc-400">
                      {new Date(l.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Target: {l.targetType} ({l.targetId.slice(0, 8)}...)</span>
                    <span className="text-zinc-400 truncate max-w-[120px]">{l.actorEmail}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

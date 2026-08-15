'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformHealthReport } from '@/server/services/launch-readiness.service';
import { runLaunchDiagnosticsAction, createPilotVenueAction } from '@/server/actions/launch-readiness';
import { VenueType } from '@/lib/validation/venue';

interface LaunchReadinessClientProps {
  initialReport: PlatformHealthReport;
}

export function LaunchReadinessClient({ initialReport }: LaunchReadinessClientProps) {
  const [report, setReport] = useState<PlatformHealthReport>(initialReport);
  const [runningDiag, setRunningDiag] = useState(false);
  const [showPilotModal, setShowPilotModal] = useState(false);
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotMessage, setPilotMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [pilotData, setPilotData] = useState({
    businessName: 'Grand Ocean Hotel & Resort',
    venueDisplayName: 'Grand Ocean Resort',
    venueType: 'resort' as VenueType,
    city: 'Colombo',
    country: 'LK',
    latitude: 6.9271,
    longitude: 79.8612,
    template: 'resort' as 'resort' | 'restaurant' | 'cafe',
    isPublished: false,
  });

  const handleRunDiagnostics = async () => {
    setRunningDiag(true);
    const res = await runLaunchDiagnosticsAction();
    setRunningDiag(false);
    if (res.success && res.report) {
      setReport(res.report);
    }
  };

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    setPilotLoading(true);
    setPilotMessage(null);

    const res = await createPilotVenueAction(pilotData);
    setPilotLoading(false);

    if (res.success) {
      setPilotMessage({ success: true, text: res.message || 'Pilot venue initialized!' });
      setTimeout(() => {
        handleRunDiagnostics(); // Refresh metrics after pilot creation
      }, 1000);
    } else {
      setPilotMessage({ success: false, text: res.message || 'Failed to initialize pilot venue.' });
    }
  };

  const getStatusBadge = (status: PlatformHealthReport['status']) => {
    switch (status) {
      case 'READY_FOR_LAUNCH':
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-xs">✓ READY FOR LAUNCH</Badge>;
      case 'NEEDS_ATTENTION':
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-xs">⚠ NEEDS ATTENTION</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-900 border-red-300 font-extrabold text-xs">⛔ NOT READY FOR LAUNCH</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="neutral" className="bg-zinc-100 text-zinc-800 font-mono text-[10px] uppercase">
              Super Admin Portal
            </Badge>
            {getStatusBadge(report.status)}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Platform Launch Readiness & Diagnostics
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-1">
            System health audit, RLS policy verification, database metrics, and pilot onboarding manager.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleRunDiagnostics}
            disabled={runningDiag}
            className="text-xs font-extrabold min-h-[44px]"
          >
            {runningDiag ? 'Running...' : '🔄 Run Diagnostics'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowPilotModal(true)}
            className="text-xs font-extrabold bg-zinc-950 text-white min-h-[44px]"
          >
            🚀 Initialize Pilot Venue
          </Button>
        </div>
      </div>

      {/* Health Score Banner & System Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Readiness Score Card */}
        <div className="p-6 rounded-3xl border border-zinc-200 bg-white shadow-2xs flex items-center gap-6">
          <div className="relative w-24 h-24 rounded-full border-8 border-amber-500 flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-zinc-950">{report.score}%</span>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Health Score</div>
            <div className="text-lg font-black text-zinc-950 mt-1">
              {report.score >= 90 ? 'Production Ready' : report.score >= 50 ? 'Requires Review' : 'Critical Issues'}
            </div>
            <div className="text-[11px] font-semibold text-zinc-400 mt-1">
              Last audited: {new Date(report.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Businesses</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.totalBusinesses}</div>
            <div className="text-[10px] font-semibold text-zinc-400">Total Tenants</div>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Active Branches</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.activeBranches}</div>
            <div className="text-[10px] font-semibold text-zinc-400">Operational Locations</div>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Published Venues</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.publishedVenues}</div>
            <div className="text-[10px] font-semibold text-zinc-400">Live Public Profiles</div>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Total Tables</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.totalTables}</div>
            <div className="text-[10px] font-semibold text-zinc-400">QR Tokens Active</div>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Total Orders</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.totalOrders}</div>
            <div className="text-[10px] font-semibold text-zinc-400">Processed Lifecycle</div>
          </div>

          <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="text-[11px] font-bold text-zinc-500 uppercase">Super Admins</div>
            <div className="text-2xl font-black text-zinc-950 mt-1">{report.metrics.superAdminsCount}</div>
            <div className="text-[10px] font-semibold text-zinc-400">Authorized Personnel</div>
          </div>
        </div>
      </div>

      {/* Diagnostics Check Suite */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <h2 className="text-base font-black text-zinc-950 flex items-center gap-2">
          <span>🛡 System Diagnostic Audit Checks</span>
          <span className="text-xs font-semibold text-zinc-400">({report.checks.length} checks performed)</span>
        </h2>

        <div className="divide-y divide-zinc-100">
          {report.checks.map((chk) => (
            <div key={chk.id} className="py-3.5 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
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

      {/* Pilot Onboarding Modal */}
      {showPilotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-black text-zinc-950">Initialize Pilot Venue</h3>
                <p className="text-xs font-semibold text-zinc-500">
                  Pre-populate a launch partner or pilot business with branches, menu & tables.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPilotModal(false)}
                className="text-zinc-400 hover:text-zinc-700 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {pilotMessage && (
              <div
                className={`p-3 rounded-2xl text-xs font-semibold ${
                  pilotMessage.success
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                {pilotMessage.text}
              </div>
            )}

            <form onSubmit={handleCreatePilot} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700">Business Legal Name *</label>
                <input
                  type="text"
                  required
                  value={pilotData.businessName}
                  onChange={(e) => setPilotData({ ...pilotData, businessName: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700">Public Venue Display Name *</label>
                <input
                  type="text"
                  required
                  value={pilotData.venueDisplayName}
                  onChange={(e) => setPilotData({ ...pilotData, venueDisplayName: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700">Venue Type *</label>
                  <select
                    value={pilotData.venueType}
                    onChange={(e) => setPilotData({ ...pilotData, venueType: e.target.value as VenueType })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  >
                    <option value="resort">Resort</option>
                    <option value="hotel">Hotel</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="cafe">Cafe</option>
                    <option value="villa">Villa</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">City *</label>
                  <input
                    type="text"
                    required
                    value={pilotData.city}
                    onChange={(e) => setPilotData({ ...pilotData, city: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={pilotData.latitude}
                    onChange={(e) => setPilotData({ ...pilotData, latitude: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={pilotData.longitude}
                    onChange={(e) => setPilotData({ ...pilotData, longitude: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="isPublishedToggle"
                  checked={pilotData.isPublished}
                  onChange={(e) => setPilotData({ ...pilotData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <label htmlFor="isPublishedToggle" className="text-xs font-bold text-zinc-700 cursor-pointer">
                  Publish Venue Immediately (Default: Unpublished)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPilotModal(false)}
                  className="text-xs font-extrabold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pilotLoading}
                  className="text-xs font-extrabold bg-zinc-950 text-white"
                >
                  {pilotLoading ? 'Creating Pilot Venue...' : 'Initialize Pilot Venue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

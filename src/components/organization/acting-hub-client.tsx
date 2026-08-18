'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { endActingAssignmentAction, extendActingAssignmentAction } from '@/server/actions/organization';

export interface ActingRow {
  id: string;
  business_membership_id: string;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  reason?: string | null;
  membership?: {
    user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
  } | null;
  job_title?: { name: string; code?: string | null } | null;
  position?: { position_code?: string } | null;
  branch?: { name: string } | null;
  department?: { name: string } | null;
  acting_for?: {
    id: string;
    job_title?: { name: string } | null;
    membership?: {
      user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
    } | null;
  } | null;
  coverage_absence?: {
    id: string;
    absence_type: string;
    starts_at: string;
    ends_at: string;
    reason?: string | null;
    status: string;
  } | null;
}

interface ActingHubClientProps {
  actingAssignments: ActingRow[];
  canManage: boolean;
}

export function ActingHubClient({
  actingAssignments,
  canManage,
}: ActingHubClientProps) {
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = actingAssignments.filter((a) => {
    if (filterActiveOnly && a.status !== 'active') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const p = a.membership?.user_profiles;
      const prof = Array.isArray(p) ? p[0] : p;
      const name = `${prof?.first_name || ''} ${prof?.last_name || ''}`.toLowerCase();
      const title = a.job_title?.name.toLowerCase() || '';
      return name.includes(q) || title.includes(q);
    }
    return true;
  });

  const handleEndActing = async (id: string) => {
    if (!confirm('Are you sure you want to end this acting appointment? Reporting will automatically restore to the substantive leader.')) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await endActingAssignmentAction({
        assignmentId: id,
        reason: 'Concluded from Acting Hub',
      });
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to end acting appointment');
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to end acting role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtendActing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingId || !newEndDate) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await extendActingAssignmentAction({
        assignmentId: extendingId,
        newEndsAt: new Date(newEndDate).toISOString(),
        reason: extendReason.trim() || 'Extension requested via Acting Hub',
      });
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to extend acting appointment');
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to extend acting role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Acting Leadership & Absence Coverage
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage temporary leadership appointments, active absence coverages, and effective reporting routing
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link href="/dashboard/people">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              👥 Assign from Staff Directory
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-950/60 border border-red-800/80 p-3.5 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search acting appointee or covered role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterActiveOnly(true)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filterActiveOnly
                ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            Active Only ({actingAssignments.filter((a) => a.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterActiveOnly(false)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              !filterActiveOnly
                ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            All Appointments ({actingAssignments.length})
          </button>
        </div>
      </div>

      {/* Acting Roles List */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">🎭</span>
            <div className="text-sm font-semibold text-zinc-300">No acting assignments found</div>
            <div className="text-xs text-zinc-500">No active leadership coverages currently scheduled.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((act) => {
              const prof = act.membership?.user_profiles;
              const p = Array.isArray(prof) ? prof[0] : prof;
              const appointeeName = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Staff Member';

              const coverProf = act.acting_for?.membership?.user_profiles;
              const cp = Array.isArray(coverProf) ? coverProf[0] : coverProf;
              const coveredName = `${cp?.first_name || ''} ${cp?.last_name || ''}`.trim() || 'Substantive Leader';

              return (
                <div key={act.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-850/20 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-bold text-zinc-100">
                        🎭 {appointeeName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950/80 border border-purple-800 text-purple-300">
                        Acting {act.job_title?.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        act.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {act.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-3">
                      <span>Covering: <strong className="text-zinc-200">{coveredName}</strong> ({act.acting_for?.job_title?.name})</span>
                      <span>• Property: {act.branch?.name || 'Corporate'}</span>
                      {act.position?.position_code && <span>• Slot: [{act.position.position_code}]</span>}
                    </div>

                    <div className="text-[11px] font-mono text-zinc-500 flex items-center space-x-2">
                      <span>Period: {act.starts_at?.split('T')[0]} → {act.ends_at?.split('T')[0] || 'Ongoing / Indefinite'}</span>
                      {act.coverage_absence && (
                        <span className="text-amber-400">
                          (Linked: {act.coverage_absence.absence_type} leave)
                        </span>
                      )}
                    </div>

                    {act.reason && (
                      <div className="text-xs text-zinc-400 italic">“{act.reason}”</div>
                    )}
                  </div>

                  {canManage && act.status === 'active' && (
                    <div className="flex items-center space-x-2 self-start md:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExtendingId(act.id);
                          setNewEndDate(act.ends_at?.split('T')[0] || '');
                        }}
                        className="text-xs h-8 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                      >
                        Extend Term
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndActing(act.id)}
                        disabled={isSubmitting}
                        className="text-xs h-8 bg-red-950/60 border-red-800 hover:bg-red-900 text-red-300"
                      >
                        End Role
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extend Modal */}
      {extendingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">Extend Acting Term</h3>
            <form onSubmit={handleExtendActing} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">New End Date</label>
                <input
                  type="date"
                  required
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Extension Reason</label>
                <input
                  type="text"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g. Leave prolonged by 14 days"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setExtendingId(null)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-500 text-white">
                  Save Extension
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

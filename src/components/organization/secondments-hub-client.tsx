'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { endSecondmentAction } from '@/server/actions/organization';

export interface SecondmentRow {
  id: string;
  business_membership_id: string;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  reason?: string | null;
  membership?: {
    user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }>;
  } | null;
  job_title?: { name: string } | null;
  branch?: { name: string } | null;
  department?: { name: string } | null;
  source_assignment?: {
    id: string;
    branch?: { name: string } | null;
    department?: { name: string } | null;
    job_title?: { name: string } | null;
  } | null;
}

interface SecondmentsHubClientProps {
  secondments: SecondmentRow[];
  canManage: boolean;
}

export function SecondmentsHubClient({
  secondments,
  canManage,
}: SecondmentsHubClientProps) {
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = secondments.filter((s) => {
    if (filterActiveOnly && s.status !== 'active') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const p = s.membership?.user_profiles;
      const prof = Array.isArray(p) ? p[0] : p;
      const name = `${prof?.first_name || ''} ${prof?.last_name || ''}`.toLowerCase();
      return name.includes(q);
    }
    return true;
  });

  const handleEndSecondment = async (id: string) => {
    if (!confirm('Are you sure you want to end this secondment?')) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await endSecondmentAction({
        assignmentId: id,
        reason: 'Concluded from Secondments Hub',
      });
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to end secondment');
      } else {
        window.location.reload();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to end secondment');
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
            Cross-Property Secondments & Taskforces
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Inter-branch staff deployments while preserving substantive home property placements
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link href="/dashboard/people">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              👥 Authorize via Staff Profile
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-950/60 border border-red-800/80 p-3.5 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Security Architecture Banner */}
      <div className="rounded-2xl bg-blue-950/30 border border-blue-800/60 p-4 md:p-5 flex items-start space-x-3.5 text-xs text-blue-200 leading-relaxed">
        <span className="text-xl mt-0.5">ℹ️</span>
        <div>
          <strong>WSNexa Security Architecture Principle:</strong>
          <br />
          Secondment placement assigns an employee to an organization node at the destination property for workforce hierarchy, reporting, and costing.
          Operational branch access (POS terminal, kitchen display, waiter tools) is governed strictly by <Link href="/dashboard/branches" className="underline font-semibold hover:text-white">Branch Assignments</Link> and is NOT automatically granted.
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search seconded staff member..."
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
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            Active Only ({secondments.filter((s) => s.status === 'active').length})
          </button>
          <button
            onClick={() => setFilterActiveOnly(false)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              !filterActiveOnly
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            All Deployments ({secondments.length})
          </button>
        </div>
      </div>

      {/* Secondments List */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">✈️</span>
            <div className="text-sm font-semibold text-zinc-300">No secondments recorded</div>
            <div className="text-xs text-zinc-500">No active cross-property deployments found.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filtered.map((sec) => {
              const prof = sec.membership?.user_profiles;
              const p = Array.isArray(prof) ? prof[0] : prof;
              const staffName = `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Staff Member';

              return (
                <div key={sec.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-850/20 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-3">
                      <span className="text-base font-bold text-zinc-100">
                        👤 {staffName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/80 border border-blue-800 text-blue-300">
                        Seconded Role: {sec.job_title?.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        sec.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {sec.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
                      <span>Home: <strong className="text-zinc-200">{sec.source_assignment?.branch?.name || 'Corporate'}</strong> ({sec.source_assignment?.job_title?.name})</span>
                      <span>➔</span>
                      <span>Destination: <strong className="text-blue-300">{sec.branch?.name || 'Corporate'}</strong> ({sec.department?.name || 'None'})</span>
                    </div>

                    <div className="text-[11px] font-mono text-zinc-500">
                      Deployment Term: {sec.starts_at?.split('T')[0]} → {sec.ends_at?.split('T')[0] || 'Open-ended'}
                    </div>

                    {sec.reason && (
                      <div className="text-xs text-zinc-400 italic">“{sec.reason}”</div>
                    )}
                  </div>

                  {canManage && sec.status === 'active' && (
                    <div className="flex items-center space-x-2 self-start md:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndSecondment(sec.id)}
                        disabled={isSubmitting}
                        className="text-xs h-8 bg-red-950/60 border-red-800 hover:bg-red-900 text-red-300"
                      >
                        Conclude Secondment
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

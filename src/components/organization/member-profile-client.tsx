'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreateAssignmentModal } from './modals/create-assignment-modal';
import { PrimaryTransitionModal } from './modals/primary-transition-modal';
import { ChangeManagerModal } from './modals/change-manager-modal';
import { ActingAssignmentModal } from './modals/acting-assignment-modal';
import { SecondmentModal } from './modals/secondment-modal';
import { AbsenceModal } from './modals/absence-modal';
import { endActingAssignmentAction, endSecondmentAction } from '@/server/actions/organization';

export type ProfileTab =
  | 'overview'
  | 'assignments'
  | 'reporting'
  | 'temporary'
  | 'absences'
  | 'history'
  | 'diagnostics';

export interface AssignmentRecord {
  id: string;
  business_membership_id?: string;
  is_primary?: boolean;
  assignment_type?: string;
  status?: string;
  starts_at?: string;
  ends_at?: string | null;
  reason?: string | null;
  branch?: { id?: string; name?: string; code?: string } | null;
  department?: { id?: string; name?: string; code?: string } | null;
  unit?: { id?: string; name?: string; code?: string } | null;
  position?: { id?: string; position_code?: string } | null;
  job_title?: { id?: string; name?: string; code?: string; hierarchy_level?: { id?: string; name?: string; rank?: number } } | null;
  reports_to?: {
    id: string;
    job_title?: { id?: string; name?: string } | null;
    branch?: { name?: string } | null;
    membership?: { id?: string; user_profiles?: unknown } | null;
  } | null;
  acting_for?: {
    id: string;
    job_title?: { id?: string; name?: string } | null;
    membership?: { id?: string; user_profiles?: unknown } | null;
  } | null;
  membership?: { id?: string; user_profiles?: unknown } | null;
  isActing?: boolean;
}

export interface AbsenceRecord {
  id: string;
  absence_type: string;
  starts_at: string;
  ends_at?: string | null;
  reason?: string | null;
  status?: string;
}

export interface EventRecord {
  id: string;
  event_type: string;
  created_at: string;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
}

export interface DiagnosticRecord {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface EffectiveManagerResult {
  substantiveManager: AssignmentRecord | null;
  effectiveManager: AssignmentRecord | null;
  isActingCoverage: boolean;
}

interface MemberProfileProps {
  membershipId: string;
  member: {
    id: string;
    userId: string;
    fullName: string;
    role: string;
    membershipStatus: string;
  };
  profile: {
    assignments: AssignmentRecord[];
    substantivePrimary: AssignmentRecord | null;
    actingAssignments: AssignmentRecord[];
    secondments: AssignmentRecord[];
    temporaryAssignments: AssignmentRecord[];
    absences: AbsenceRecord[];
    eventHistory: EventRecord[];
    diagnostics: DiagnosticRecord[];
  };
  effectiveManager: EffectiveManagerResult | null;
  directReports: AssignmentRecord[];
  effectiveDirectReports: AssignmentRecord[];
  reportingChain: AssignmentRecord[];
  effectiveReportingChain: AssignmentRecord[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; department_id: string }>;
  jobTitles: Array<{ id: string; name: string; is_management: boolean }>;
  positions: Array<{ id: string; position_code?: string; job_title_id: string; availableSlots?: number; isFull?: boolean }>;
  potentialManagers: Array<{ id: string; fullName: string; title: string }>;
  allActiveAssignmentsToCover: Array<{
    id: string;
    holderName: string;
    jobTitleName: string;
    branchName?: string;
  }>;
  canManage: boolean;
}

function getProfileName(up: unknown): string {
  if (!up) return '';
  if (Array.isArray(up)) {
    const first = up[0];
    return `${first?.first_name || ''} ${first?.last_name || ''}`.trim();
  }
  if (typeof up === 'object') {
    const obj = up as { first_name?: string; last_name?: string };
    return `${obj.first_name || ''} ${obj.last_name || ''}`.trim();
  }
  return '';
}

export function MemberProfileClient({
  membershipId,
  member,
  profile,
  effectiveManager,
  directReports,
  effectiveDirectReports,
  reportingChain,
  effectiveReportingChain,
  branches,
  departments,
  units,
  jobTitles,
  positions,
  potentialManagers,
  allActiveAssignmentsToCover,
  canManage,
}: MemberProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Modals visibility
  const [isCreateAssignOpen, setIsCreateAssignOpen] = useState(searchParams.get('action') === 'assign');
  const [isTransitionOpen, setIsTransitionOpen] = useState(false);
  const [isChangeMgrOpen, setIsChangeMgrOpen] = useState(false);
  const [isActingOpen, setIsActingOpen] = useState(false);
  const [isSecondmentOpen, setIsSecondmentOpen] = useState(false);
  const [isAbsenceOpen, setIsAbsenceOpen] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const pAssign = profile.substantivePrimary;

  const handleEndActing = async (id: string) => {
    if (!confirm('Are you sure you want to end this acting appointment early? Effective reporting will automatically restore to the substantive leader.')) return;
    try {
      const res = await endActingAssignmentAction({
        assignmentId: id,
        reason: 'Ended early via staff profile',
      });
      if (!res.success) {
        setActionError(res.message || 'Failed to end acting assignment');
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to end acting role');
    }
  };

  const handleEndSecondment = async (id: string) => {
    if (!confirm('Are you sure you want to conclude this secondment?')) return;
    try {
      const res = await endSecondmentAction({
        assignmentId: id,
        reason: 'Concluded via staff profile',
      });
      if (!res.success) {
        setActionError(res.message || 'Failed to end secondment');
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to end secondment');
    }
  };

  const subMgr = effectiveManager?.substantiveManager || pAssign?.reports_to;
  const subMgrName = getProfileName(subMgr?.membership?.user_profiles) || 'Assigned Manager';
  const subJobName = subMgr?.job_title?.name || 'Position';
  const subBranchName = subMgr?.branch?.name || 'Corporate';

  const effMgr = effectiveManager?.effectiveManager;
  const isCoverageActive = Boolean(effectiveManager?.isActingCoverage);
  const effMgrName = getProfileName(effMgr?.membership?.user_profiles) || 'Effective Manager';
  const effJobName = effMgr?.job_title?.name || 'Position';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Action Error Alert */}
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-xl bg-white border border-zinc-200 p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="h-16 w-16 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-2xl font-bold text-zinc-900 shrink-0">
              {member.fullName.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-900">{member.fullName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  member.membershipStatus === 'active' ? 'bg-zinc-100 text-zinc-800 border border-zinc-200' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  {member.membershipStatus}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-zinc-50 border border-zinc-200 text-zinc-700">
                  Role: {member.role}
                </span>
                <Link
                  href={`/dashboard/access/members/${membershipId}`}
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  🛡️ View Access Profile →
                </Link>
              </div>
              <div className="text-xs text-zinc-500 flex items-center space-x-2 flex-wrap">
                <span className="font-semibold text-zinc-900">
                  {pAssign ? `${pAssign.job_title?.name} (Primary)` : 'No Primary Placement'}
                </span>
                {pAssign?.branch && (
                  <>
                    <span>•</span>
                    <span>📍 {pAssign.branch.name}</span>
                  </>
                )}
                {pAssign?.department && (
                  <>
                    <span>•</span>
                    <span>🏢 {pAssign.department.name}</span>
                  </>
                )}
                {pAssign?.unit && (
                  <>
                    <span>•</span>
                    <span>🏷️ {pAssign.unit.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Hub Dropdown / Buttons */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setIsCreateAssignOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-sm"
              >
                + New Assignment
              </Button>

              {pAssign && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsTransitionOpen(true)}
                    className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-medium"
                  >
                    Promote / Transfer
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsChangeMgrOpen(true)}
                    className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-medium"
                  >
                    Change Manager
                  </Button>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsActingOpen(true)}
                className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-medium"
              >
                Appoint Acting
              </Button>

              {pAssign && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSecondmentOpen(true)}
                    className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-medium"
                  >
                    Secondment
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAbsenceOpen(true)}
                    className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-medium"
                  >
                    Log Absence
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-zinc-200 overflow-x-auto text-xs">
        {[
          { id: 'overview' as const, label: 'Overview' },
          { id: 'assignments' as const, label: `Assignments (${profile.assignments.length})` },
          { id: 'reporting' as const, label: 'Reporting & Hierarchy' },
          { id: 'temporary' as const, label: `Temporary & Acting (${profile.actingAssignments.length + profile.secondments.length})` },
          { id: 'absences' as const, label: `Absences (${profile.absences.length})` },
          { id: 'history' as const, label: `Event Log (${profile.eventHistory.length})` },
          { id: 'diagnostics' as const, label: `Diagnostics (${profile.diagnostics.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 font-semibold whitespace-nowrap transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Unassigned Placement Status Notice */}
          {!pAssign && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/90 p-5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl select-none">📌</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-zinc-950">
                        Operational Role Active • Unassigned Position
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Awaiting Placement
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
                      This staff member holds an active <strong>{member.role.replace(/_/g, ' ')}</strong> membership and can operate authorized modules normally. However, they have not yet been placed into a <strong>Job Title</strong>, <strong>Department</strong>, or <strong>Position Slot</strong> in the Organization Chart.
                    </p>
                  </div>
                </div>
                {canManage && (
                  <Button
                    onClick={() => setIsCreateAssignOpen(true)}
                    className="shrink-0 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm px-4 py-2"
                  >
                    + Assign Position & Department
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Substantive vs Effective Callout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-2 shadow-xs">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Substantive Supervisor</span>
              {subMgr ? (
                <div>
                  <div className="text-lg font-bold text-zinc-900">
                    👤 {subMgrName}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {subJobName} ({subBranchName})
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-400 italic">Direct to Board / Unassigned</div>
              )}
            </div>

            <div className="rounded-xl bg-purple-50/40 border border-purple-200 p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-700 uppercase tracking-wider">
                  Effective Reporting Supervisor
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 font-mono font-medium">
                  Live Resolution
                </span>
              </div>
              {effMgr ? (
                <div>
                  <div className="text-lg font-bold text-purple-950">
                    🎭 {effMgrName}
                  </div>
                  <div className="text-xs text-purple-700 mt-0.5">
                    {effJobName} {isCoverageActive ? '(Acting Coverage Active)' : '(Substantive)'}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-purple-700/60 italic">Direct to Board / Unassigned</div>
              )}
            </div>
          </div>

          {/* Direct Reports Section */}
          <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Direct Subordinates ({directReports.length} Substantive • {effectiveDirectReports.length} Effective)
            </h3>
            {directReports.length === 0 ? (
              <div className="text-xs text-zinc-400 py-3">No direct reports currently report to this position.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {directReports.map((dr) => {
                  const name = getProfileName(dr.membership?.user_profiles) || 'Staff Member';
                  return (
                    <div key={dr.id} className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between shadow-xs">
                      <div>
                        <div className="text-xs font-semibold text-zinc-900">👤 {name}</div>
                        <div className="text-[11px] text-zinc-500">{dr.job_title?.name} • {dr.branch?.name || 'Corporate'}</div>
                      </div>
                      <Link href={`/dashboard/people/${dr.business_membership_id}`}>
                        <Button size="sm" variant="outline" className="text-[11px] h-6 px-2.5 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium">
                          Profile &rarr;
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Assignments History */}
      {activeTab === 'assignments' && (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-zinc-700">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Role & Nature</th>
                <th className="py-3 px-4">Property & Dept</th>
                <th className="py-3 px-4">Timeline</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profile.assignments.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-zinc-900">{a.job_title?.name || 'Position Holder'}</div>
                    <div className="text-[10px] text-zinc-500 capitalize">{a.assignment_type} {a.is_primary ? '• Primary' : ''}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="text-zinc-900 font-medium">{a.branch?.name || 'Corporate'}</div>
                    <div className="text-[11px] text-zinc-500">{a.department?.name || 'None'}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-zinc-600">
                    {a.starts_at?.split('T')[0]} → {a.ends_at?.split('T')[0] || 'Present'}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      a.status === 'active' ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-50 text-zinc-400 border border-zinc-200'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{a.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Reporting & Hierarchy */}
      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Substantive Reporting Line
            </h3>
            <div className="space-y-3">
              {reportingChain.map((node, i) => {
                const nodeName = getProfileName(node.membership?.user_profiles) || 'Member';
                return (
                  <div key={node.id} className="flex items-center space-x-3 text-xs">
                    <div className="h-6 w-6 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-mono text-[10px] text-zinc-700 font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900">{nodeName}</div>
                      <div className="text-[11px] text-zinc-500">{node.job_title?.name} ({node.branch?.name || 'Corporate'})</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-purple-50/30 border border-purple-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Effective Reporting Line (With Acting Overlays)
            </h3>
            <div className="space-y-3">
              {effectiveReportingChain.map((node, i) => {
                const nodeName = getProfileName(node.membership?.user_profiles) || 'Member';
                const isActing = Boolean(node.isActing || node.assignment_type === 'acting');
                return (
                  <div key={node.id} className="flex items-center space-x-3 text-xs">
                    <div className="h-6 w-6 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center font-mono text-[10px] text-purple-800 font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900">
                        {nodeName}
                        {isActing && <span className="ml-2 text-[10px] text-purple-700 font-bold">[ACTING]</span>}
                      </div>
                      <div className="text-[11px] text-purple-700">{node.job_title?.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Temporary Roles */}
      {activeTab === 'temporary' && (
        <div className="space-y-6">
          {/* Acting Appointments */}
          <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Acting Leadership Appointments ({profile.actingAssignments.length})
            </h3>
            {profile.actingAssignments.length === 0 ? (
              <div className="text-xs text-zinc-400 py-3">No acting appointments assigned to this member.</div>
            ) : (
              <div className="space-y-3">
                {profile.actingAssignments.map((act) => (
                  <div key={act.id} className="rounded-lg bg-purple-50/40 border border-purple-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
                    <div>
                      <div className="text-sm font-bold text-purple-950">
                        🎭 Acting Role: {act.job_title?.name}
                      </div>
                      <div className="text-xs text-zinc-600 mt-0.5">
                        Covering: <span className="text-zinc-900 font-medium">{act.acting_for?.job_title?.name || 'Substantive Leader'}</span> • {act.branch?.name || 'Corporate'}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 mt-1">
                        Timeline: {act.starts_at?.split('T')[0]} → {act.ends_at?.split('T')[0] || 'Indefinite'}
                      </div>
                    </div>

                    {canManage && act.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndActing(act.id)}
                        className="text-xs border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                      >
                        End Acting
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Secondments */}
          <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Cross-Property Secondments ({profile.secondments.length})
            </h3>
            {profile.secondments.length === 0 ? (
              <div className="text-xs text-zinc-400 py-3">No secondments on record.</div>
            ) : (
              <div className="space-y-3">
                {profile.secondments.map((sec) => (
                  <div key={sec.id} className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
                    <div>
                      <div className="text-sm font-bold text-zinc-900">
                        ✈️ Deployment: {sec.branch?.name} ({sec.job_title?.name})
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Dept: {sec.department?.name || 'Unassigned'} • Reason: {sec.reason || 'Project Support'}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 mt-1">
                        Timeline: {sec.starts_at?.split('T')[0]} → {sec.ends_at?.split('T')[0] || 'Ongoing'}
                      </div>
                    </div>

                    {canManage && sec.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndSecondment(sec.id)}
                        className="text-xs border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                      >
                        Conclude Secondment
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Absences */}
      {activeTab === 'absences' && (
        <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-zinc-700">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Absence Type</th>
                <th className="py-3 px-4">Duration Period</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profile.absences.map((ab) => (
                <tr key={ab.id} className="hover:bg-zinc-50/70">
                  <td className="py-3.5 px-4 font-semibold text-zinc-900 capitalize">
                    {ab.absence_type.replace('_', ' ')}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                    {ab.starts_at.split('T')[0]} → {ab.ends_at?.split('T')[0] || 'Open'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      ab.status === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {ab.status || 'active'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{ab.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 6: History */}
      {activeTab === 'history' && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Assignment Lifecycle Event Audit Trail ({profile.eventHistory.length})
          </h3>
          <div className="space-y-3">
            {profile.eventHistory.map((ev) => (
              <div key={ev.id} className="rounded-lg bg-zinc-50 border border-zinc-200 p-3.5 text-xs flex items-start justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-zinc-900 capitalize">
                    🏷️ {ev.event_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-zinc-500 text-[11px]">{ev.reason || 'No additional note'}</div>
                </div>
                <div className="text-right shrink-0 font-mono text-[11px] text-zinc-400">
                  {new Date(ev.created_at).toLocaleDateString()} {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 7: Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          {profile.diagnostics.length === 0 ? (
            <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center space-y-2 shadow-sm">
              <span className="text-3xl">✅</span>
              <div className="text-sm font-semibold text-zinc-900">Clean Organizational Placement</div>
              <div className="text-xs text-zinc-500">
                No branch access mismatches or organizational anomalies detected for this member.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.diagnostics.map((d) => (
                <div key={d.id} className="rounded-lg bg-amber-50/60 border border-amber-200 p-4 text-xs space-y-1 shadow-xs">
                  <div className="font-bold text-amber-800 uppercase tracking-wider">
                    ⚠️ {d.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-zinc-700">{d.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateAssignmentModal
        isOpen={isCreateAssignOpen}
        onClose={() => setIsCreateAssignOpen(false)}
        onSuccess={() => startTransition(() => router.refresh())}
        membershipId={membershipId}
        memberName={member.fullName}
        hasActivePrimary={Boolean(pAssign)}
        jobTitles={jobTitles}
        positions={positions}
        branches={branches}
        departments={departments}
        units={units}
        potentialManagers={potentialManagers}
      />

      {pAssign && (
        <>
          <PrimaryTransitionModal
            isOpen={isTransitionOpen}
            onClose={() => setIsTransitionOpen(false)}
            onSuccess={() => startTransition(() => router.refresh())}
            currentAssignment={pAssign}
            memberName={member.fullName}
            jobTitles={jobTitles}
            positions={positions}
            branches={branches}
            departments={departments}
            units={units}
            potentialManagers={potentialManagers}
          />

          <ChangeManagerModal
            isOpen={isChangeMgrOpen}
            onClose={() => setIsChangeMgrOpen(false)}
            onSuccess={() => startTransition(() => router.refresh())}
            assignmentId={pAssign.id}
            memberName={member.fullName}
            currentManagerName={subMgrName}
            potentialManagers={potentialManagers}
          />

          <SecondmentModal
            isOpen={isSecondmentOpen}
            onClose={() => setIsSecondmentOpen(false)}
            onSuccess={() => startTransition(() => router.refresh())}
            sourceAssignment={{
              id: pAssign.id,
              membershipId,
              memberName: member.fullName,
              jobTitleName: pAssign.job_title?.name || 'Staff Member',
              branchName: pAssign.branch?.name,
            }}
            destinationBranches={branches}
            destinationDepartments={departments}
            destinationUnits={units}
            jobTitles={jobTitles}
            positions={positions}
            potentialManagers={potentialManagers}
          />

          <AbsenceModal
            isOpen={isAbsenceOpen}
            onClose={() => setIsAbsenceOpen(false)}
            onSuccess={() => startTransition(() => router.refresh())}
            assignmentId={pAssign.id}
            memberName={member.fullName}
            jobTitleName={pAssign.job_title?.name || 'Staff Member'}
          />
        </>
      )}

      <ActingAssignmentModal
        isOpen={isActingOpen}
        onClose={() => setIsActingOpen(false)}
        onSuccess={() => startTransition(() => router.refresh())}
        actingMembershipId={membershipId}
        actingMemberName={member.fullName}
        assignmentsToCover={allActiveAssignmentsToCover}
        positions={positions}
        absences={profile.absences.map((ab) => ({
          id: ab.id,
          staffName: member.fullName,
          absenceType: ab.absence_type,
          startsAt: ab.starts_at,
          endsAt: ab.ends_at || '',
        }))}
      />
    </div>
  );
}

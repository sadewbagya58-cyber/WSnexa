'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface StaffRow {
  membershipId: string;
  userId: string;
  fullName: string;
  role: string;
  status: string;
  primaryAssignment: {
    id: string;
    starts_at: string;
    ends_at?: string | null;
    branch?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    unit?: { id: string; name: string } | null;
    job_title?: { id: string; name: string; hierarchy_level?: { rank: number; name: string } } | null;
    reports_to?: {
      id: string;
      job_title?: { name: string } | null;
      membership?: { user_profiles?: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> } | null;
    } | null;
  } | null;
  actingAssignments: Array<{ id: string; acting_for?: { job_title?: { name: string } } | null }>;
  secondmentAssignments: Array<{ id: string; branch?: { name: string } | null }>;
  temporaryAssignments: Array<{ id: string }>;
  additionalAssignments: Array<{ id: string }>;
  totalActiveAssignments: number;
  hasBranchAccessMismatch: boolean;
}

interface PeopleDirectoryClientProps {
  staff: StaffRow[];
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  jobTitles: Array<{ id: string; name: string }>;
  canManage: boolean;
}

export function PeopleDirectoryClient({
  staff,
  branches,
  departments,
  jobTitles,
  canManage,
}: PeopleDirectoryClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedJob, setSelectedJob] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  const filteredStaff = staff.filter((s) => {
    if (selectedBranch !== 'all' && s.primaryAssignment?.branch?.id !== selectedBranch) return false;
    if (selectedDept !== 'all' && s.primaryAssignment?.department?.id !== selectedDept) return false;
    if (selectedJob !== 'all' && s.primaryAssignment?.job_title?.id !== selectedJob) return false;
    if (selectedTypeFilter === 'acting' && s.actingAssignments.length === 0) return false;
    if (selectedTypeFilter === 'secondment' && s.secondmentAssignments.length === 0) return false;
    if (selectedTypeFilter === 'mismatch' && !s.hasBranchAccessMismatch) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = s.fullName.toLowerCase().includes(q);
      const titleMatch = s.primaryAssignment?.job_title?.name.toLowerCase().includes(q);
      return nameMatch || titleMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            People & Workforce Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Organization-aware staff directory with primary roles, leadership coverage, and direct supervisors
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {canManage && (
            <Link href="/dashboard/organization/positions">
              <Button className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30">
                + Manage Positions
              </Button>
            </Link>
          )}
          <Link href="/dashboard/organization/chart">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              📊 Visual Org Chart
            </Button>
          </Link>
          <Link href="/dashboard/people/acting">
            <Button variant="outline" className="text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200">
              🎭 Acting Coverage
            </Button>
          </Link>
        </div>
      </div>

      {/* Multi-filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <input
            type="text"
            placeholder="Search employee name or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Properties</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Job Titles</option>
            {jobTitles.map((jt) => (
              <option key={jt.id} value={jt.id}>
                {jt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Work Statuses</option>
            <option value="acting">Active Acting Roles</option>
            <option value="secondment">Active Secondments</option>
            <option value="mismatch">Branch Access Mismatches</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">👥</span>
            <div className="text-sm font-semibold text-zinc-300">No staff members found</div>
            <div className="text-xs text-zinc-500">Try adjusting your search criteria or property filters.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Primary Role</th>
                  <th className="py-3 px-4">Property & Department</th>
                  <th className="py-3 px-4">Reporting Manager</th>
                  <th className="py-3 px-4">Active Deployments</th>
                  <th className="py-3 px-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredStaff.map((s) => {
                  const pAssign = s.primaryAssignment;
                  const mgrProfiles = pAssign?.reports_to?.membership?.user_profiles;
                  const mgrProf = Array.isArray(mgrProfiles) ? mgrProfiles[0] : mgrProfiles;
                  const mgrName = mgrProf ? `${mgrProf.first_name || ''} ${mgrProf.last_name || ''}`.trim() : null;

                  return (
                    <tr key={s.membershipId} className="hover:bg-zinc-850/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-xs font-bold text-emerald-300">
                            {s.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/people/${s.membershipId}`}
                              className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors"
                            >
                              {s.fullName}
                            </Link>
                            <div className="text-[10px] text-zinc-500 capitalize">
                              Auth Role: {s.role.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {pAssign?.job_title ? (
                          <div>
                            <div className="font-medium text-zinc-200">{pAssign.job_title.name}</div>
                            {pAssign.job_title.hierarchy_level && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Rank {pAssign.job_title.hierarchy_level.rank} ({pAssign.job_title.hierarchy_level.name})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic">No primary assignment</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-zinc-200">{pAssign?.branch?.name || 'Corporate / Group'}</div>
                        <div className="text-[11px] text-zinc-500">
                          {pAssign?.department?.name || 'No Dept'} {pAssign?.unit?.name ? `• ${pAssign.unit.name}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {mgrName ? (
                          <div>
                            <div className="text-zinc-200 font-medium">👤 {mgrName}</div>
                            {pAssign?.reports_to?.job_title?.name && (
                              <div className="text-[10px] text-zinc-500">{pAssign.reports_to.job_title.name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic">Direct to Board / Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          {s.actingAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-950/80 border border-purple-800 text-purple-300">
                              🎭 Acting Lead ({s.actingAssignments.length})
                            </span>
                          )}
                          {s.secondmentAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-950/80 border border-blue-800 text-blue-300">
                              ✈️ Seconded
                            </span>
                          )}
                          {s.hasBranchAccessMismatch && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-950/80 border border-amber-800 text-amber-300" title="Organization placement exists without operational branch access">
                              ⚠️ Access Mismatch
                            </span>
                          )}
                          {s.totalActiveAssignments <= 1 && s.actingAssignments.length === 0 && s.secondmentAssignments.length === 0 && !s.hasBranchAccessMismatch && (
                            <span className="text-[11px] text-zinc-500">Standard</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link href={`/dashboard/people/${s.membershipId}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                            View Profile →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

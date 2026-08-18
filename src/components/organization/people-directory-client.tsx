'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface StaffRow {
  membershipId: string;
  userId: string;
  fullName: string;
  role: string;
  status: string;
  hasPrimaryAssignment?: boolean;
  isCorporate?: boolean;
  isUnassigned?: boolean;
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
  initialBranch?: string;
  activeBranchId?: string | null;
  canViewAllProperties?: boolean;
}

export function PeopleDirectoryClient({
  staff,
  branches,
  departments,
  jobTitles,
  canManage,
  initialBranch = 'all',
  activeBranchId = null,
  canViewAllProperties = true,
}: PeopleDirectoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentBranchParam = searchParams.get('branch') || initialBranch;
  const currentDeptParam = searchParams.get('dept') || 'all';
  const currentJobParam = searchParams.get('job') || 'all';
  const currentSearchParam = searchParams.get('search') || '';

  const [searchQuery, setSearchQuery] = useState(currentSearchParam);
  const [selectedBranch, setSelectedBranch] = useState(currentBranchParam);
  const [selectedDept, setSelectedDept] = useState(currentDeptParam);
  const [selectedJob, setSelectedJob] = useState(currentJobParam);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  const updateFilters = (newBranch: string, newDept: string, newJob: string, newSearch: string) => {
    const params = new URLSearchParams();
    if (newBranch && newBranch !== 'all') params.set('branch', newBranch);
    if (newDept && newDept !== 'all') params.set('dept', newDept);
    if (newJob && newJob !== 'all') params.set('job', newJob);
    if (newSearch) params.set('search', newSearch);

    startTransition(() => {
      router.push(`/dashboard/people?${params.toString()}`);
    });
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId);
    updateFilters(branchId, selectedDept, selectedJob, searchQuery);
  };

  const handleDeptChange = (deptId: string) => {
    setSelectedDept(deptId);
    updateFilters(selectedBranch, deptId, selectedJob, searchQuery);
  };

  const handleJobChange = (jobId: string) => {
    setSelectedJob(jobId);
    updateFilters(selectedBranch, selectedDept, jobId, searchQuery);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters(selectedBranch, selectedDept, selectedJob, searchQuery);
  };

  const filteredStaff = staff.filter((s) => {
    if (selectedTypeFilter === 'acting' && s.actingAssignments.length === 0) return false;
    if (selectedTypeFilter === 'secondment' && s.secondmentAssignments.length === 0) return false;
    if (selectedTypeFilter === 'mismatch' && !s.hasBranchAccessMismatch) return false;

    // Client-side instant filter fallback
    if (selectedBranch === 'corporate' && (s.primaryAssignment === null || s.primaryAssignment.branch !== null)) return false;
    if (selectedBranch === 'unassigned' && s.primaryAssignment !== null) return false;
    if (selectedBranch !== 'all' && selectedBranch !== 'corporate' && selectedBranch !== 'unassigned') {
      const primaryMatches = s.primaryAssignment?.branch?.id === selectedBranch;
      const secondmentMatches = s.secondmentAssignments.some((sec) => (sec.branch as { id?: string } | undefined)?.id === selectedBranch);
      if (!primaryMatches && !secondmentMatches) return false;
    }
    if (selectedDept !== 'all' && s.primaryAssignment?.department?.id !== selectedDept) return false;
    if (selectedJob !== 'all' && s.primaryAssignment?.job_title?.id !== selectedJob) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = s.fullName.toLowerCase().includes(q);
      const titleMatch = s.primaryAssignment?.job_title?.name.toLowerCase().includes(q);
      return nameMatch || titleMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            People & Workforce Directory
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Organization-aware staff directory with primary roles, leadership coverage, and direct supervisors
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {canManage && (
            <Link href="/dashboard/organization/positions">
              <Button className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm">
                + Manage Positions
              </Button>
            </Link>
          )}
          <Link href="/dashboard/organization/chart">
            <Button variant="outline" className="text-xs bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium">
              Visual Org Chart
            </Button>
          </Link>
          <Link href="/dashboard/people/acting">
            <Button variant="outline" className="text-xs bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium">
              Acting Coverage
            </Button>
          </Link>
        </div>
      </div>

      {/* Multi-filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <form onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search employee name or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => updateFilters(selectedBranch, selectedDept, selectedJob, searchQuery)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </form>
        </div>
        <div>
          <select
            value={selectedBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {canViewAllProperties && (
              <option value="all">All Properties (Cross-Property)</option>
            )}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.id === activeBranchId ? '• Active Branch' : ''}
              </option>
            ))}
            <option value="corporate">Corporate / Head Office</option>
            <option value="unassigned">Unassigned Staff</option>
          </select>
        </div>
        <div>
          <select
            value={selectedDept}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            onChange={(e) => handleJobChange(e.target.value)}
            className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="all">All Work Statuses</option>
            <option value="acting">Active Acting Roles</option>
            <option value="secondment">Active Secondments</option>
            <option value="mismatch">Branch Access Mismatches</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden shadow-sm relative">
        {isPending && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="text-xs font-semibold text-zinc-700 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
              Updating directory...
            </span>
          </div>
        )}

        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl">👥</span>
            <div className="text-sm font-semibold text-zinc-900">No staff members found</div>
            <div className="text-xs text-zinc-500">
              Try adjusting your search criteria or selecting a different property scope.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-700">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Primary Role</th>
                  <th className="py-3 px-4">Property & Department</th>
                  <th className="py-3 px-4">Reporting Manager</th>
                  <th className="py-3 px-4">Active Deployments</th>
                  <th className="py-3 px-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredStaff.map((s) => {
                  const pAssign = s.primaryAssignment;
                  const mgrProfiles = pAssign?.reports_to?.membership?.user_profiles;
                  const mgrProf = Array.isArray(mgrProfiles) ? mgrProfiles[0] : mgrProfiles;
                  const mgrName = mgrProf ? `${mgrProf.first_name || ''} ${mgrProf.last_name || ''}`.trim() : null;

                  return (
                    <tr key={s.membershipId} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-800">
                            {s.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/people/${s.membershipId}`}
                              className="font-semibold text-zinc-900 hover:underline transition-colors"
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
                            <div className="font-semibold text-zinc-900">{pAssign.job_title.name}</div>
                            {pAssign.job_title.hierarchy_level && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Rank {pAssign.job_title.hierarchy_level.rank} ({pAssign.job_title.hierarchy_level.name})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">No primary assignment</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {pAssign ? (
                          <>
                            <div className="text-zinc-900 font-medium">
                              {pAssign.branch?.name || 'Corporate / Head Office'}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {pAssign.department?.name ? (
                                <>
                                  {pAssign.department.name}
                                  {pAssign.unit?.name ? ` • ${pAssign.unit.name}` : ''}
                                </>
                              ) : (
                                <span className="text-zinc-400 italic">No department assigned</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-zinc-400 italic font-normal">Unassigned</div>
                            <div className="text-[11px] text-zinc-400 italic">No organization placement</div>
                          </>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {mgrName ? (
                          <div>
                            <div className="text-zinc-900 font-medium">👤 {mgrName}</div>
                            {pAssign?.reports_to?.job_title?.name && (
                              <div className="text-[10px] text-zinc-500">{pAssign.reports_to.job_title.name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Direct to Board / Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          {s.actingAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-700">
                              Acting Lead ({s.actingAssignments.length})
                            </span>
                          )}
                          {s.secondmentAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 border border-zinc-200 text-zinc-800">
                              Seconded
                            </span>
                          )}
                          {s.hasBranchAccessMismatch && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-800" title="Organization placement exists without operational branch access">
                              Access Mismatch
                            </span>
                          )}
                          {s.totalActiveAssignments <= 1 && s.actingAssignments.length === 0 && s.secondmentAssignments.length === 0 && !s.hasBranchAccessMismatch && (
                            <span className="text-[11px] text-zinc-400">Standard</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link href={`/dashboard/people/${s.membershipId}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium">
                            View Profile &rarr;
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

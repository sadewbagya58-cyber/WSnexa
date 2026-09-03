'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { updateMemberRoleAction, setMembershipStatusAction } from '@/server/actions/permission';
import { assignStaffToAreasAction, getStaffAssignedAreaIdsAction } from '@/server/actions/service-area';

export interface StaffRow {
  membershipId: string;
  userId: string;
  fullName: string;
  role: string;
  customRoleId?: string | null;
  customRoleName?: string | null;
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
  customRoles?: Array<{ id: string; name: string; base_role?: string; description?: string | null }>;
  branchAreas?: Array<{ id: string; name: string; branch_id?: string }>;
  canManage: boolean;
  canAssignRoles?: boolean;
  canSuspend?: boolean;
  canAssignAreas?: boolean;
  userRole?: string;
  initialBranch?: string;
  activeBranchId?: string | null;
  canViewAllProperties?: boolean;
}

export function PeopleDirectoryClient({
  staff: initialStaff,
  branches,
  departments,
  jobTitles,
  customRoles = [],
  branchAreas = [],
  canManage,
  canAssignRoles = true,
  canSuspend = true,
  canAssignAreas = true,
  userRole = 'business_owner',
  initialBranch = 'all',
  activeBranchId = null,
  canViewAllProperties = true,
}: PeopleDirectoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [staff, setStaff] = useState<StaffRow[]>(initialStaff);

  // Sync state if initialStaff updates from props/server refresh
  React.useEffect(() => {
    setStaff(initialStaff);
  }, [initialStaff]);

  const currentBranchParam = searchParams.get('branch') || initialBranch;
  const currentDeptParam = searchParams.get('dept') || 'all';
  const currentJobParam = searchParams.get('job') || 'all';
  const currentSearchParam = searchParams.get('search') || '';

  const [searchQuery, setSearchQuery] = useState(currentSearchParam);
  const [selectedBranch, setSelectedBranch] = useState(currentBranchParam);
  const [selectedDept, setSelectedDept] = useState(currentDeptParam);
  const [selectedJob, setSelectedJob] = useState(currentJobParam);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Modals state
  const [editingRoleMember, setEditingRoleMember] = useState<StaffRow | null>(null);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<string>('cashier');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');

  const [managingAreaMember, setManagingAreaMember] = useState<StaffRow | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  // --- Staff Management Actions ---
  const handleOpenEditRole = (member: StaffRow) => {
    setEditingRoleMember(member);
    setSelectedBuiltInRole(member.role || 'cashier');
    setSelectedCustomRoleId(member.customRoleId || '');
    setModalError(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleMember) return;

    setIsSubmitting(true);
    setModalError(null);

    const res = await updateMemberRoleAction({
      membershipId: editingRoleMember.membershipId,
      builtInRole: selectedBuiltInRole as 'business_owner' | 'branch_manager' | 'cashier' | 'kitchen_staff' | 'waiter',
      customRoleId: selectedCustomRoleId || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      const customRoleObj = customRoles.find((r) => r.id === selectedCustomRoleId);
      setStaff((prev) =>
        prev.map((m) =>
          m.membershipId === editingRoleMember.membershipId
            ? {
                ...m,
                role: selectedBuiltInRole,
                customRoleId: selectedCustomRoleId || null,
                customRoleName: customRoleObj?.name || null,
              }
            : m
        )
      );
      setEditingRoleMember(null);
      startTransition(() => router.refresh());
    } else {
      setModalError(res.message || 'Failed to update staff member role.');
    }
  };

  const handleOpenManageAreas = async (member: StaffRow) => {
    setManagingAreaMember(member);
    setSelectedAreaIds([]);
    setModalError(null);
    setIsLoadingAreas(true);

    try {
      const res = await getStaffAssignedAreaIdsAction(member.membershipId);
      if (res.success && res.data) {
        setSelectedAreaIds(res.data);
      }
    } catch {
      // Fallback to empty if initial query fails
    } finally {
      setIsLoadingAreas(false);
    }
  };

  const handleToggleArea = (areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSaveAreas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingAreaMember) return;

    setIsSubmitting(true);
    setModalError(null);

    const res = await assignStaffToAreasAction(managingAreaMember.membershipId, selectedAreaIds);
    setIsSubmitting(false);

    if (res.success) {
      setManagingAreaMember(null);
      startTransition(() => router.refresh());
    } else {
      setModalError(res.message || 'Failed to update service area assignments.');
    }
  };

  const handleToggleStatus = async (member: StaffRow) => {
    const isCurrentlyActive = member.status === 'active';
    const newStatus = isCurrentlyActive ? 'suspended' : 'active';
    const actionText = isCurrentlyActive ? 'suspend' : 'reactivate';

    if (
      !confirm(
        `Are you sure you want to ${actionText} ${member.fullName}? ${
          isCurrentlyActive
            ? 'Their operational permissions will be immediately disabled.'
            : 'Their system access will be restored.'
        }`
      )
    ) {
      return;
    }

    const res = await setMembershipStatusAction({
      membershipId: member.membershipId,
      status: newStatus,
    });

    if (res.success) {
      setStaff((prev) =>
        prev.map((m) =>
          m.membershipId === member.membershipId ? { ...m, status: newStatus } : m
        )
      );
      startTransition(() => router.refresh());
    } else {
      alert(res.message || `Failed to ${actionText} staff member.`);
    }
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

  // Filter areas applicable to member's branch or global
  const relevantAreas = branchAreas.filter((a) => {
    if (!managingAreaMember) return true;
    const memberBranchId = managingAreaMember.primaryAssignment?.branch?.id;
    if (!memberBranchId) return true;
    return !a.branch_id || a.branch_id === memberBranchId;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            People & Workforce Directory
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative workforce directory with staff roles, position placements, and service area assignments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Link href="/dashboard/organization/positions">
              <Button className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm min-h-[38px] touch-manipulation">
                + Manage Positions
              </Button>
            </Link>
          )}
          <Link href="/dashboard/organization/chart">
            <Button variant="outline" className="text-xs bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium min-h-[38px] touch-manipulation">
              Visual Org Chart
            </Button>
          </Link>
          <Link href="/dashboard/people/acting">
            <Button variant="outline" className="text-xs bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium min-h-[38px] touch-manipulation">
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
              className="w-full rounded-xl bg-white border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
            />
          </form>
        </div>
        <div>
          <select
            value={selectedBranch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
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
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
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
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
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
            className="w-full rounded-xl bg-white border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[40px]"
          >
            <option value="all">All Work Statuses</option>
            <option value="acting">Active Acting Roles</option>
            <option value="secondment">Active Secondments</option>
            <option value="mismatch">Branch Access Mismatches</option>
          </select>
        </div>
      </div>

      {/* Directory Content Area */}
      <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden shadow-sm relative">
        {isPending && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center z-10">
            <span className="text-xs font-semibold text-zinc-700 bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm">
              Updating directory...
            </span>
          </div>
        )}

        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-3xl select-none">👥</span>
            <div className="text-sm font-bold text-zinc-900">No staff members found</div>
            <div className="text-xs text-zinc-500 max-w-sm mx-auto">
              Try adjusting your search criteria or selecting a different property/department.
            </div>
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* MOBILE VIEW: Touch-friendly Responsive Cards (md:hidden) */}
            {/* ========================================================= */}
            <div className="block md:hidden p-3 space-y-3.5 divide-y divide-zinc-100">
              {filteredStaff.map((s) => {
                const pAssign = s.primaryAssignment;
                const rawReportsTo = pAssign?.reports_to;
                const reportsTo = Array.isArray(rawReportsTo) ? rawReportsTo[0] : rawReportsTo;
                const repMembership = Array.isArray(reportsTo?.membership) ? reportsTo?.membership[0] : reportsTo?.membership;
                const mgrProfiles = repMembership?.user_profiles;
                const mgrProf = Array.isArray(mgrProfiles) ? mgrProfiles[0] : mgrProfiles;
                const mgrName = mgrProf ? `${mgrProf.first_name || ''} ${mgrProf.last_name || ''}`.trim() : null;
                const rawJobTitle = reportsTo?.job_title;
                const mgrJobTitle = (Array.isArray(rawJobTitle) ? rawJobTitle[0]?.name : rawJobTitle?.name) || null;

                const isSuspended = s.status === 'suspended';

                return (
                  <div key={s.membershipId} className="pt-3.5 first:pt-0 space-y-3">
                    {/* Card Header: Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-900 shrink-0">
                          {s.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/people/${s.membershipId}`}
                            className="font-bold text-sm text-zinc-950 hover:underline block truncate"
                          >
                            {s.fullName}
                          </Link>
                          <div className="text-[11px] text-zinc-500 truncate">
                            Role: <strong className="text-zinc-800 font-semibold">{s.customRoleName || s.role.replace(/_/g, ' ')}</strong>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          isSuspended
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {isSuspended ? '● Suspended' : '● Active'}
                      </span>
                    </div>

                    {/* Card Details: Placement, Department, Job, Supervisor */}
                    <div className="bg-zinc-50/70 rounded-xl p-3 space-y-2 text-xs border border-zinc-100">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Property</span>
                          <span className="font-semibold text-zinc-900 break-words">
                            {pAssign?.branch?.name || 'Corporate / Head Office'}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Department</span>
                          <span className="font-semibold text-zinc-900 break-words">
                            {pAssign?.department?.name || <span className="text-zinc-400 italic">Unassigned</span>}
                            {pAssign?.unit?.name ? ` • ${pAssign.unit.name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-zinc-200/60">
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Position Slot</span>
                          {pAssign?.job_title ? (
                            <div>
                              <span className="font-semibold text-zinc-900">{pAssign.job_title.name}</span>
                              {pAssign.job_title.hierarchy_level && (
                                <span className="text-[10px] text-zinc-500 font-mono block">
                                  Rank {pAssign.job_title.hierarchy_level.rank} ({pAssign.job_title.hierarchy_level.name})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              ⚡ Unassigned Slot
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px] font-medium uppercase tracking-wider">Supervisor</span>
                          <span className="text-zinc-800 font-medium break-words">
                            {mgrName ? (
                              <>👤 {mgrName} {mgrJobTitle ? `(${mgrJobTitle})` : ''}</>
                            ) : (
                              <span className="text-zinc-400 italic">Direct / None</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Deployments Tags on Mobile */}
                      {(s.actingAssignments.length > 0 || s.secondmentAssignments.length > 0 || s.hasBranchAccessMismatch) && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-zinc-200/60">
                          {s.actingAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 border border-purple-200 text-purple-700">
                              Acting Lead ({s.actingAssignments.length})
                            </span>
                          )}
                          {s.secondmentAssignments.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-200/80 text-zinc-800">
                              Seconded
                            </span>
                          )}
                          {s.hasBranchAccessMismatch && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-900">
                              Access Mismatch
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mobile Action Buttons Grid (min-h-[44px] touch targets) */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {canAssignRoles && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditRole(s)}
                          className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation border border-zinc-200/60"
                        >
                          ✏️ Edit Staff
                        </button>
                      )}
                      {canAssignAreas && (
                        <button
                          type="button"
                          onClick={() => handleOpenManageAreas(s)}
                          className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation border border-zinc-200/60"
                        >
                          📍 Areas
                        </button>
                      )}
                      <Link
                        href={`/dashboard/access/members/${s.membershipId}`}
                        className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation border border-emerald-200"
                      >
                        🛡️ Access
                      </Link>
                      {canSuspend && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl active:scale-98 transition-all flex items-center justify-center gap-1.5 touch-manipulation border ${
                            s.status === 'active'
                              ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                          }`}
                        >
                          {s.status === 'active' ? '⛔ Suspend' : '⚡ Reactivate'}
                        </button>
                      )}
                    </div>

                    {/* Direct Placement Action for Unassigned Staff */}
                    {!pAssign && canManage && (
                      <Link
                        href={`/dashboard/people/${s.membershipId}?action=assign`}
                        className="min-h-[44px] w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white transition-all flex items-center justify-center gap-1.5 shadow-xs touch-manipulation"
                      >
                        + Assign Position Slot & Department &rarr;
                      </Link>
                    )}

                    <Link
                      href={`/dashboard/people/${s.membershipId}`}
                      className="min-h-[44px] w-full px-3 py-2.5 text-xs font-semibold rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 transition-all flex items-center justify-center gap-1 touch-manipulation"
                    >
                      View Full Profile &rarr;
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* ========================================================= */}
            {/* DESKTOP VIEW: Data Table (hidden md:block) */}
            {/* ========================================================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Primary Role</th>
                    <th className="py-3 px-4">Property & Department</th>
                    <th className="py-3 px-4">Reporting Manager</th>
                    <th className="py-3 px-4">Deployments</th>
                    <th className="py-3 px-4 text-right">Management Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredStaff.map((s) => {
                    const pAssign = s.primaryAssignment;
                    const rawReportsTo = pAssign?.reports_to;
                    const reportsTo = Array.isArray(rawReportsTo) ? rawReportsTo[0] : rawReportsTo;
                    const repMembership = Array.isArray(reportsTo?.membership) ? reportsTo?.membership[0] : reportsTo?.membership;
                    const mgrProfiles = repMembership?.user_profiles;
                    const mgrProf = Array.isArray(mgrProfiles) ? mgrProfiles[0] : mgrProfiles;
                    const mgrName = mgrProf ? `${mgrProf.first_name || ''} ${mgrProf.last_name || ''}`.trim() : null;
                    const rawJobTitle = reportsTo?.job_title;
                    const mgrJobTitle = (Array.isArray(rawJobTitle) ? rawJobTitle[0]?.name : rawJobTitle?.name) || null;

                    const isSuspended = s.status === 'suspended';

                    return (
                      <tr key={s.membershipId} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-800 shrink-0">
                              {s.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/dashboard/people/${s.membershipId}`}
                                  className="font-semibold text-zinc-900 hover:underline transition-colors"
                                >
                                  {s.fullName}
                                </Link>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    isSuspended
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                >
                                  {isSuspended ? 'Suspended' : 'Active'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500 capitalize mt-0.5">
                                <span>Role: <strong className="text-zinc-800 font-semibold">{s.customRoleName || s.role.replace(/_/g, ' ')}</strong></span>
                                <span>•</span>
                                <Link
                                  href={`/dashboard/access/members/${s.membershipId}`}
                                  className="text-emerald-700 hover:underline font-bold"
                                >
                                  🛡️ Access Profile →
                                </Link>
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
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                ⚡ Role Active • Unassigned
                              </span>
                              <div className="text-[10px] text-zinc-500 font-medium">No position slot in Org Chart</div>
                            </div>
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
                            <div>
                              <div className="text-zinc-900 text-xs font-semibold">Unassigned Position</div>
                              {canManage ? (
                                <Link
                                  href={`/dashboard/people/${s.membershipId}?action=assign`}
                                  className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-2xs"
                                >
                                  + Assign Position Slot &rarr;
                                </Link>
                              ) : (
                                <div className="text-[11px] text-zinc-400 italic">Awaiting position placement</div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {mgrName ? (
                            <div>
                              <div className="text-zinc-900 font-medium">👤 {mgrName}</div>
                              {mgrJobTitle && (
                                <div className="text-[10px] text-zinc-500">{mgrJobTitle}</div>
                              )}
                            </div>
                          ) : reportsTo ? (
                            <div>
                              <div className="text-zinc-900 font-medium">👤 {mgrJobTitle || 'Manager'}</div>
                              <div className="text-[10px] text-zinc-500 italic">(Assigned Manager)</div>
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
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canAssignRoles && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditRole(s)}
                                className="text-[11px] h-7 px-2.5 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-semibold"
                                title="Edit Staff Member Role"
                              >
                                ✏️ Edit
                              </Button>
                            )}
                            {canAssignAreas && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenManageAreas(s)}
                                className="text-[11px] h-7 px-2.5 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-semibold"
                                title="Assign Service Areas"
                              >
                                📍 Areas
                              </Button>
                            )}
                            <Link href={`/dashboard/access/members/${s.membershipId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2.5 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-semibold"
                                title="Access Profile"
                              >
                                🛡️ Access
                              </Button>
                            </Link>
                            {canSuspend && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleStatus(s)}
                                className={`text-[11px] h-7 px-2.5 font-semibold ${
                                  s.status === 'active'
                                    ? 'bg-red-50/60 border-red-200 hover:bg-red-100 text-red-700'
                                    : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100 text-amber-800'
                                }`}
                                title={s.status === 'active' ? 'Suspend Staff Member' : 'Reactivate Staff Member'}
                              >
                                {s.status === 'active' ? '⛔ Suspend' : '⚡ Reactivate'}
                              </Button>
                            )}
                            <Link href={`/dashboard/people/${s.membershipId}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] h-7 px-2.5 bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-medium"
                              >
                                Profile &rarr;
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: Edit Staff Role Modal */}
      {/* ========================================================= */}
      {editingRoleMember && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                ✏️ Edit Staff Role: {editingRoleMember.fullName}
              </h3>
              <button
                onClick={() => setEditingRoleMember(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Built-In Role Template</label>
                <select
                  value={selectedBuiltInRole}
                  onChange={(e) => setSelectedBuiltInRole(e.target.value)}
                  className="w-full rounded-xl bg-white border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[44px]"
                >
                  <option value="business_owner">Business Owner (Full Access)</option>
                  <option value="branch_manager">Branch Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                  <option value="waiter">Waiter</option>
                </select>
                <p className="text-[11px] text-zinc-500">
                  Defines default operational capabilities for POS, KDS, and tables.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Custom Role Bundle (Optional)</label>
                <select
                  value={selectedCustomRoleId}
                  onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                  className="w-full rounded-xl bg-white border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[44px]"
                >
                  <option value="">None (Standard Built-In Role)</option>
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name} ({cr.base_role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500">
                  Attach an enterprise permission bundle created in Access Control Hub.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingRoleMember(null)}
                  disabled={isSubmitting}
                  className="text-xs min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-bold min-h-[44px]"
                >
                  {isSubmitting ? 'Saving...' : 'Save Role Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Service Areas Modal */}
      {/* ========================================================= */}
      {managingAreaMember && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  📍 Service Areas: {managingAreaMember.fullName}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Select which dining service areas this staff member is assigned to operate.
                </p>
              </div>
              <button
                onClick={() => setManagingAreaMember(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            {isLoadingAreas ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                Loading assigned service areas...
              </div>
            ) : relevantAreas.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <span className="text-2xl select-none">📍</span>
                <div className="text-xs font-semibold text-zinc-800">No service areas created</div>
                <p className="text-[11px] text-zinc-500">
                  Create dining areas in Table Management before assigning staff.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveAreas} className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {relevantAreas.map((area) => {
                    const isChecked = selectedAreaIds.includes(area.id);
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors min-h-[44px] ${
                          isChecked
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-900'
                        }`}
                      >
                        <span className="text-xs font-bold">{area.name}</span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleArea(area.id)}
                          className="h-4 w-4 rounded accent-zinc-900"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setManagingAreaMember(null)}
                    disabled={isSubmitting}
                    className="text-xs min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-xs bg-zinc-900 hover:bg-zinc-800 text-white font-bold min-h-[44px]"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Area Assignments'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

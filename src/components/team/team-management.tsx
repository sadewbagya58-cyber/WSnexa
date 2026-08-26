'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SimplePermissionEditor } from '@/components/team/simple-permission-editor';
import {
  FormattedMemberDetail,
  FormattedCustomRole,
  FormattedPermission,
} from '@/server/services/permission.service';
import {
  updateMemberRoleAction,
  setMembershipStatusAction,
  setMemberOverrideAction,
} from '@/server/actions/permission';
import { PermissionKey } from '@/lib/validation/permission';

interface TeamManagementProps {
  catalog: FormattedPermission[];
  initialMembers: FormattedMemberDetail[];
  customRoles: FormattedCustomRole[];
  userRole: string;
  activeBranchName?: string;
  branchAreas?: Array<{ id: string; name: string }>;
}

export function TeamManagement({
  catalog,
  initialMembers,
  customRoles,
  userRole,
  activeBranchName = 'Main Branch',
  branchAreas = [],
}: TeamManagementProps) {
  const [members, setMembers] = useState<FormattedMemberDetail[]>(initialMembers);

  // Edit Role Modal State
  const [editingRoleMember, setEditingRoleMember] = useState<FormattedMemberDetail | null>(null);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<string>('cashier');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');

  // Overrides Modal State
  const [overridesMember, setOverridesMember] = useState<FormattedMemberDetail | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<PermissionKey[]>([]);

  // Manage Service Areas Modal State
  const [managingAreaMember, setManagingAreaMember] = useState<FormattedMemberDetail | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = userRole === 'business_owner';

  const handleOpenManageAreas = (member: FormattedMemberDetail) => {
    setManagingAreaMember(member);
    setSelectedAreaIds(member.assignedAreaIds || []);
    setErrorMsg(null);
  };

  const handleToggleArea = (areaId: string) => {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSaveStaffAreas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingAreaMember) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const { assignStaffToAreasAction } = await import('@/server/actions/service-area');
    const res = await assignStaffToAreasAction(managingAreaMember.id, selectedAreaIds);

    if (res.success) {
      const assignedNames = branchAreas
        .filter((a) => selectedAreaIds.includes(a.id))
        .map((a) => a.name);

      setMembers((prev) =>
        prev.map((m) =>
          m.id === managingAreaMember.id
            ? { ...m, assignedAreaIds: selectedAreaIds, assignedAreaNames: assignedNames }
            : m
        )
      );
      setManagingAreaMember(null);
    } else {
      setErrorMsg(res.message || 'Failed to update staff area assignments.');
    }
    setIsSubmitting(false);
  };

  // Open Edit Role Modal
  const handleOpenEditRole = (member: FormattedMemberDetail) => {
    setEditingRoleMember(member);
    setSelectedBuiltInRole(member.role);
    setSelectedCustomRoleId(member.customRoleId || '');
    setErrorMsg(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleMember) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updateMemberRoleAction({
      membershipId: editingRoleMember.id,
      builtInRole: selectedBuiltInRole as 'business_owner' | 'branch_manager' | 'cashier' | 'kitchen_staff' | 'waiter',
      customRoleId: selectedCustomRoleId || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      const customRoleObj = customRoles.find((r) => r.id === selectedCustomRoleId);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingRoleMember.id
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
    } else {
      setErrorMsg(res.message || 'Failed to update member role.');
    }
  };

  // Open Overrides Modal
  const handleOpenOverrides = (member: FormattedMemberDetail) => {
    setOverridesMember(member);
    setMemberPermissions([...member.effectivePermissions]);
    setErrorMsg(null);
  };

  const handleToggleOverride = (updatedPermissions: PermissionKey[]) => {
    if (!overridesMember) return;

    // 1. Instant local UI update (<10ms visual response)
    const targetMemberId = overridesMember.id;
    const prevMemberPermissions = [...memberPermissions];
    setMemberPermissions(updatedPermissions);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === targetMemberId
          ? { ...m, effectivePermissions: updatedPermissions }
          : m
      )
    );

    // 2. Identify diffs against pre-toggle active state
    const addedKey = updatedPermissions.find((k) => !prevMemberPermissions.includes(k));
    const removedKey = prevMemberPermissions.find((k) => !updatedPermissions.includes(k));

    // 3. Dispatch server action asynchronously
    (async () => {
      let res;
      if (addedKey) {
        res = await setMemberOverrideAction({
          membershipId: targetMemberId,
          permissionKey: addedKey,
          effect: 'allow',
        });
      } else if (removedKey) {
        res = await setMemberOverrideAction({
          membershipId: targetMemberId,
          permissionKey: removedKey,
          effect: 'deny',
        });
      }

      if (res && !res.success) {
        // Rollback state if server request failed
        setErrorMsg(res.message || 'Failed to set permission override');
        setMemberPermissions(prevMemberPermissions);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === targetMemberId
              ? { ...m, effectivePermissions: prevMemberPermissions }
              : m
          )
        );
      }
    })();
  };

  // Toggle Suspend / Reactivate Status
  const handleToggleStatus = async (member: FormattedMemberDetail) => {
    const newStatus = member.membershipStatus === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'suspended' ? 'suspend' : 'reactivate';

    if (!confirm(`Are you sure you want to ${actionText} ${member.userName}?`)) {
      return;
    }

    const res = await setMembershipStatusAction({
      membershipId: member.id,
      status: newStatus,
    });

    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, membershipStatus: newStatus } : m))
      );
    } else {
      alert(res.message || `Failed to ${actionText} member.`);
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'business_owner':
        return 'Business Owner';
      case 'branch_manager':
        return 'Branch Manager';
      case 'cashier':
        return 'Cashier';
      case 'kitchen_staff':
        return 'Kitchen Staff';
      case 'waiter':
        return 'Waiter';
      default:
        return role;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">Team & Staff Directory</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-zinc-100 text-zinc-900 border border-zinc-200">
              📍 {activeBranchName}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Showing staff assigned to <strong className="text-zinc-800">{activeBranchName}</strong>. View directory, assign roles, configure permission overrides, and manage account statuses.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link href="/dashboard/team/roles">
            <Button variant="outline" className="flex items-center gap-2 text-xs min-h-[44px]">
              🛡️ Roles & Permissions Matrix
            </Button>
          </Link>
          <Link href="/dashboard/team/invites">
            <Button variant="primary" className="flex items-center gap-2 text-xs min-h-[44px]">
              🔑 Staff Invitations
            </Button>
          </Link>
        </div>
      </div>

      {/* Team Workspace Sub-Groups Navigation */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mr-1">Workspace Areas:</span>
        <Link href="/dashboard/team" className="min-h-[44px] inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-zinc-950 text-white shadow-xs">
          👥 Staff & Invitations
        </Link>
        <Link href="/dashboard/people" className="min-h-[44px] inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors">
          📁 People Directory
        </Link>
        <Link href="/dashboard/access/roles" className="min-h-[44px] inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors">
          🛡️ Roles & Permissions
        </Link>
        <Link href="/dashboard/organization/structure" className="min-h-[44px] inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors">
          🏛️ Organization & Positions
        </Link>
      </div>

      {/* Staff Directory Cards (Responsive Mobile & Desktop Grid) */}
      <div className="space-y-4 min-w-0">
        {members.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-500 text-xs space-y-2 shadow-2xs">
            <div className="text-3xl mb-2">👥</div>
            <div>No staff members registered for this branch yet.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
            {members.map((m) => {
              const isOwnerMember = m.role === 'business_owner';
              const isSuspended = m.membershipStatus === 'suspended';
              const assignedAreas = m.assignedAreaNames || [];

              const initial = (m.userName || 'S').trim().charAt(0).toUpperCase();

              return (
                <div
                  key={m.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between hover:border-zinc-300 transition-all"
                >
                  {/* Card Header: Avatar, Name, Email, Status */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 text-white font-black text-lg flex items-center justify-center shadow-xs">
                          {initial}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-zinc-950 leading-snug truncate max-w-[170px] sm:max-w-[200px]">
                            {m.userName}
                          </h3>
                          <p className="text-[11px] font-mono text-zinc-400 truncate max-w-[170px] sm:max-w-[200px]">
                            {m.userEmail}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                          isSuspended
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        }`}
                      >
                        {m.membershipStatus}
                      </span>
                    </div>

                    {/* Meta Details: Role & Branch */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-100">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Role</span>
                        <span className="font-extrabold text-zinc-900">{formatRoleLabel(m.role)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Branch</span>
                        <span className="font-bold text-zinc-700 truncate block">📍 {m.branchName}</span>
                      </div>
                    </div>

                    {/* Service Areas Section */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Service Areas</span>
                      <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                        {assignedAreas.length > 0 ? (
                          assignedAreas.map((areaName, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-zinc-100 text-zinc-900 border border-zinc-200"
                            >
                              📍 {areaName}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">All Areas (Branch-wide)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2">
                    {isOwner && !isOwnerMember ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditRole(m)}
                          className="min-h-[44px] rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 active:scale-98 transition-all touch-manipulation flex items-center justify-center gap-1"
                        >
                          ✏️ Edit Staff
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenManageAreas(m)}
                          className="min-h-[44px] rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 active:scale-98 transition-all touch-manipulation flex items-center justify-center gap-1"
                        >
                          📍 Areas
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenOverrides(m)}
                          className="min-h-[44px] rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100 active:scale-98 transition-all touch-manipulation flex items-center justify-center gap-1"
                        >
                          🛡️ Access
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(m)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold active:scale-98 transition-all touch-manipulation flex items-center justify-center gap-1 ${
                            isSuspended
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                              : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
                          }`}
                        >
                          {isSuspended ? '⚡ Reactivate' : '🚫 Suspend'}
                        </button>
                      </>
                    ) : (
                      <div className="col-span-2 text-center py-2 text-xs text-zinc-400 font-bold bg-zinc-50 rounded-xl">
                        👑 Business Owner (Primary)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT MEMBER ROLE MODAL (Responsive Bottom-Sheet on Mobile / Dialog on Desktop) */}
      {editingRoleMember && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setEditingRoleMember(null)}
        >
          <div
            className="bg-white border border-zinc-200 rounded-t-3xl sm:rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950">
                  Edit Staff: {editingRoleMember.userName}
                </h3>
                <p className="text-[11px] text-zinc-500">{editingRoleMember.userEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoleMember(null)}
                className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-500 font-bold text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-700 font-bold mb-1">Built-in Role *</label>
                <select
                  value={selectedBuiltInRole}
                  onChange={(e) => setSelectedBuiltInRole(e.target.value)}
                  className="w-full h-11 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none touch-manipulation"
                  required
                >
                  <option value="branch_manager">Branch Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                  <option value="waiter">Waiter</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">
                  Custom Role <span className="text-zinc-400 font-normal">(Optional Override)</span>
                </label>
                <select
                  value={selectedCustomRoleId}
                  onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none touch-manipulation"
                >
                  <option value="">-- No Custom Role (Use Built-in Template) --</option>
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name} ({cr.permissions.length} permissions)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white py-2">
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs font-bold min-h-[44px]"
                  onClick={() => setEditingRoleMember(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="text-xs font-bold min-h-[44px]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : '💾 Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER PERMISSION OVERRIDES MODAL */}
      {overridesMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-t-3xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-950">
                  Permission Overrides: {overridesMember.userName}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Base Role: <strong className="text-zinc-800 font-bold">{formatRoleLabel(overridesMember.role)}</strong>
                  {overridesMember.customRoleName && (
                    <span className="text-zinc-600 font-medium"> ({overridesMember.customRoleName})</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverridesMember(null)}
                className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs leading-relaxed">
                💡 Toggling a capability ON applies an explicit <strong>allow</strong> override. Toggling OFF applies an explicit <strong>deny</strong> override, overriding role defaults for this member.
              </div>

              <SimplePermissionEditor
                catalog={catalog}
                selectedPermissions={memberPermissions}
                onChange={handleToggleOverride}
              />
            </div>

            {/* Sticky Footer */}
            <div className="p-4 border-t border-zinc-100 bg-white flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-zinc-500">
                {memberPermissions.length} Active Capabilities
              </span>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setOverridesMember(null)}
                className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold px-6"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE SERVICE AREAS MODAL */}
      {managingAreaMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-zinc-200 rounded-t-3xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-base font-extrabold text-zinc-950">
                  Assign Service Areas: {managingAreaMember.userName}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Select which operational sections this staff member operates in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagingAreaMember(null)}
                className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaffAreas} className="p-4 sm:p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {branchAreas.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500">
                  No active service areas found for this branch. Create service areas first under <strong className="text-zinc-900">Dining & Tables → Service Areas</strong>.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {branchAreas.map((area) => {
                    const isChecked = selectedAreaIds.includes(area.id);
                    return (
                      <label
                        key={area.id}
                        onClick={() => handleToggleArea(area.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                            : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="font-bold text-sm">{area.name}</div>
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                            isChecked ? 'bg-emerald-500' : 'bg-zinc-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              isChecked ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSelectedAreaIds([])}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-900"
                >
                  Clear All (All Areas Access)
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setManagingAreaMember(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    className="bg-zinc-950 text-white font-extrabold"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Assignments'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

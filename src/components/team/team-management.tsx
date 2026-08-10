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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Team & Staff Directory</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-zinc-100 text-zinc-900 border border-zinc-200">
              📍 {activeBranchName}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Showing staff assigned to <strong className="text-zinc-800">{activeBranchName}</strong>. View directory, assign roles, configure permission overrides, and manage account statuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/team/roles">
            <Button variant="outline" className="flex items-center gap-2 text-xs">
              🛡️ Roles & Permissions Matrix
            </Button>
          </Link>
          <Link href="/dashboard/team/invites">
            <Button variant="primary" className="flex items-center gap-2 text-xs">
              🔑 Staff Invitations
            </Button>
          </Link>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        {members.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2">
            <div className="text-3xl mb-2">👥</div>
            <div>No staff members registered for this business yet.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Built-in Role</th>
                  <th className="py-3 px-4">Service Areas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Effective Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {members.map((m) => {
                  const isOwnerMember = m.role === 'business_owner';
                  const isSuspended = m.membershipStatus === 'suspended';
                  const assignedAreas = m.assignedAreaNames || [];

                  return (
                    <tr key={m.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{m.userName}</div>
                        <div className="text-[11px] font-mono text-zinc-400">{m.userEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 font-medium">{m.branchName}</td>
                      <td className="py-3 px-4 font-bold text-zinc-800">
                        {formatRoleLabel(m.role)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {assignedAreas.length > 0 ? (
                            assignedAreas.map((areaName, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-zinc-100 text-zinc-800 border border-zinc-200"
                              >
                                {areaName}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-400 italic">All Areas</span>
                          )}
                          {isOwner && !isOwnerMember && branchAreas && branchAreas.length > 0 && (
                            <button
                              onClick={() => handleOpenManageAreas(m)}
                              className="ml-1 text-[10px] font-bold text-zinc-900 underline hover:text-zinc-600"
                            >
                              Manage
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isSuspended
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          }`}
                        >
                          {m.membershipStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-500 font-medium">
                        {isOwnerMember ? (
                          <span className="text-purple-600 font-bold">All Permissions (Owner)</span>
                        ) : (
                          `${m.effectivePermissions.length} Active`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isOwner && !isOwnerMember && (
                          <>
                            <button
                              onClick={() => handleOpenEditRole(m)}
                              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                            >
                              Edit Role
                            </button>
                            <button
                              onClick={() => handleOpenOverrides(m)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              Overrides
                            </button>
                            <button
                              onClick={() => handleToggleStatus(m)}
                              className={`text-xs font-semibold transition-colors ${
                                isSuspended
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-rose-600 hover:text-rose-700'
                              }`}
                            >
                              {isSuspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MEMBER ROLE MODAL */}
      {editingRoleMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">
                Edit Role: {editingRoleMember.userName}
              </h3>
              <button
                onClick={() => setEditingRoleMember(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
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
                <label className="block text-zinc-700 font-bold mb-1">Built-in Base Role *</label>
                <select
                  value={selectedBuiltInRole}
                  onChange={(e) => setSelectedBuiltInRole(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
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
                  Assign Custom Role <span className="text-zinc-400 font-normal">(Optional Override)</span>
                </label>
                <select
                  value={selectedCustomRoleId}
                  onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
                >
                  <option value="">-- No Custom Role (Use Built-in Template) --</option>
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name} ({cr.permissions.length} permissions)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRoleMember(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Member Role'}
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

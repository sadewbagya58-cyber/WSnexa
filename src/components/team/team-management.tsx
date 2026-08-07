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
}

export function TeamManagement({
  catalog,
  initialMembers,
  customRoles,
  userRole,
}: TeamManagementProps) {
  const [members, setMembers] = useState<FormattedMemberDetail[]>(initialMembers);

  // Edit Role Modal State
  const [editingRoleMember, setEditingRoleMember] = useState<FormattedMemberDetail | null>(null);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<string>('cashier');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');

  // Overrides Modal State
  const [overridesMember, setOverridesMember] = useState<FormattedMemberDetail | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<PermissionKey[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = userRole === 'business_owner';

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

  const handleToggleOverride = async (updatedPermissions: PermissionKey[]) => {
    if (!overridesMember) return;

    // Find added or removed key
    const prevKeys = overridesMember.effectivePermissions;
    const addedKey = updatedPermissions.find((k) => !prevKeys.includes(k));
    const removedKey = prevKeys.find((k) => !updatedPermissions.includes(k));

    if (addedKey) {
      await setMemberOverrideAction({
        membershipId: overridesMember.id,
        permissionKey: addedKey,
        effect: 'allow',
      });
    } else if (removedKey) {
      await setMemberOverrideAction({
        membershipId: overridesMember.id,
        permissionKey: removedKey,
        effect: 'deny',
      });
    }

    setMemberPermissions(updatedPermissions);
    setMembers((prev) =>
      prev.map((m) =>
        m.id === overridesMember.id
          ? { ...m, effectivePermissions: updatedPermissions }
          : m
      )
    );
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Team & Staff Directory</h1>
          <p className="text-xs text-zinc-500">
            View staff directory, assign built-in & custom roles, configure permission overrides, and manage account statuses.
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
                  <th className="py-3 px-4">Custom Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Effective Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {members.map((m) => {
                  const isOwnerMember = m.role === 'business_owner';
                  const isSuspended = m.membershipStatus === 'suspended';

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
                        {m.customRoleName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                            {m.customRoleName}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">None</span>
                        )}
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-950">
                  Permission Overrides: {overridesMember.userName}
                </h3>
                <p className="text-xs text-zinc-500">
                  Base Role: <strong className="text-zinc-800">{formatRoleLabel(overridesMember.role)}</strong>
                  {overridesMember.customRoleName && (
                    <span> ({overridesMember.customRoleName})</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setOverridesMember(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              💡 Checking a permission grants an explicit <strong>allow</strong> override. Unchecking a permission applies an explicit <strong>deny</strong> override, revoking that specific capability regardless of role defaults.
            </div>

            <SimplePermissionEditor
              catalog={catalog}
              selectedPermissions={memberPermissions}
              onChange={handleToggleOverride}
            />

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setOverridesMember(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

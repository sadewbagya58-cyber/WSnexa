'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedInvitation } from '@/server/services/staff-invitation.service';
import {
  createInvitationAction,
  revokeInvitationAction,
  regenerateInvitationAction,
} from '@/server/actions/staff-invitation';
import { listCustomRolesAction } from '@/server/actions/permission';
import { StaffRole, ExpiryOption } from '@/lib/validation/staff-invitation';

export interface BranchOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AreaOption {
  id: string;
  branchId: string;
  name: string;
  code: string;
}

export interface CustomRoleOption {
  id: string;
  name: string;
  description?: string;
}

interface StaffInvitesManagementProps {
  branches: BranchOption[];
  branchAreas?: AreaOption[];
  customRoles?: CustomRoleOption[];
  initialInvitations: FormattedInvitation[];
  userRole: string;
  activeBranchId?: string;
}

export function StaffInvitesManagement({
  branches,
  branchAreas = [],
  customRoles: initialCustomRoles = [],
  initialInvitations,
  userRole,
  activeBranchId,
}: StaffInvitesManagementProps) {
  const [invitations, setInvitations] = useState<FormattedInvitation[]>(initialInvitations);
  const [customRoles, setCustomRoles] = useState<CustomRoleOption[]>(initialCustomRoles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdCodeModal, setCreatedCodeModal] = useState<{
    rawCode: string;
    tokenPrefix: string;
    role: string;
    branchName: string;
  } | null>(null);

  // Form states
  const [branchId, setBranchId] = useState<string>(activeBranchId || branches[0]?.id || '');
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('builtin:cashier');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('48h');
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isOwner = userRole === 'business_owner';

  // Refresh active custom roles when modal opens to ensure any freshly created custom role appears immediately
  useEffect(() => {
    if (isModalOpen) {
      let isMounted = true;
      listCustomRolesAction({ includeArchived: false }).then((res) => {
        if (isMounted && res.success && res.data) {
          const activeOnly = res.data
            .filter((r) => r.isActive && !r.isArchived)
            .map((r) => ({
              id: r.id,
              name: r.name,
              description: r.description || undefined,
            }));
          setCustomRoles(activeOnly);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [isModalOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setErrorMsg('Please select a branch.');
      return;
    }

    let assignedRole: StaffRole = 'cashier';
    let customRoleId: string | undefined = undefined;

    if (selectedRoleKey.startsWith('builtin:')) {
      assignedRole = selectedRoleKey.replace('builtin:', '') as StaffRole;
    } else if (selectedRoleKey.startsWith('custom:')) {
      customRoleId = selectedRoleKey.replace('custom:', '');
      assignedRole = 'cashier'; // Base staff role for custom role assignment
    } else {
      assignedRole = selectedRoleKey as StaffRole;
    }

    if (assignedRole === 'waiter' && !customRoleId && selectedAreaIds.length === 0) {
      setErrorMsg('At least one Service Area is required when inviting a Waiter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createInvitationAction({
      branchId,
      assignedRole,
      customRoleId,
      invitedEmail,
      expiryOption,
      serviceAreaIds: selectedAreaIds,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      const selectedBranch = branches.find((b) => b.id === branchId);
      const selectedCustomRole = customRoles.find((cr) => cr.id === customRoleId);
      const displayRoleLabel = selectedCustomRole ? selectedCustomRole.name : formatRoleLabel(assignedRole);

      setInvitations([res.data.invitation, ...invitations]);
      setIsModalOpen(false);
      setCreatedCodeModal({
        rawCode: res.data.rawCode,
        tokenPrefix: res.data.tokenPrefix,
        role: displayRoleLabel,
        branchName: selectedBranch?.name || 'Selected Branch',
      });
      // Reset form
      setInvitedEmail('');
      setSelectedAreaIds([]);
      setSelectedRoleKey('builtin:cashier');
    } else {
      setErrorMsg(res.message || 'Failed to generate invitation.');
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation code? It will immediately become unclaimable.')) {
      return;
    }

    const res = await revokeInvitationAction({ invitationId });
    if (res.success) {
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId
            ? { ...inv, status: 'revoked', revokedAt: new Date().toISOString() }
            : inv
        )
      );
    } else {
      alert(res.message || 'Failed to revoke invitation.');
    }
  };

  const handleRegenerate = async (invitation: FormattedInvitation) => {
    if (
      !confirm(
        'Regenerating will immediately invalidate the previous code and issue a brand-new code. Proceed?'
      )
    ) {
      return;
    }

    const res = await regenerateInvitationAction({ invitationId: invitation.id });
    if (res.success && res.data) {
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitation.id
            ? { ...inv, tokenPrefix: res.data!.tokenPrefix, status: 'pending' }
            : inv
        )
      );
      setCreatedCodeModal({
        rawCode: res.data.rawCode,
        tokenPrefix: res.data.tokenPrefix,
        role: formatRoleLabel(invitation.assignedRole, invitation.customRoleName),
        branchName: invitation.branchName,
      });
    } else {
      alert(res.message || 'Failed to regenerate invitation token.');
    }
  };

  const copyToClipboard = (text: string, isFullInstruction = false) => {
    navigator.clipboard.writeText(text);
    if (isFullInstruction) {
      setCopiedInstructions(true);
      setTimeout(() => setCopiedInstructions(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyCodeToClipboard = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatRoleLabel = (role: string, customRoleName?: string | null) => {
    if (customRoleName) {
      return customRoleName;
    }
    switch (role) {
      case 'branch_manager':
        return 'Branch Manager';
      case 'cashier':
        return 'Cashier';
      case 'kitchen_staff':
        return 'Kitchen Staff';
      case 'waiter':
        return 'Waiter';
      case 'business_owner':
        return 'Business Owner';
      default:
        return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const getStatusBadge = (status: FormattedInvitation['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'claimed':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'expired':
        return 'bg-zinc-100 text-zinc-500 border-zinc-200';
      case 'revoked':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
      default:
        return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  };

  const isWaiterSelected = selectedRoleKey === 'builtin:waiter';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Staff & Manager Invitations</h1>
          <p className="text-xs text-zinc-500">
            Generate secure, single-use invitation codes bound to specific branches and built-in or custom roles.
          </p>
        </div>

        {isOwner && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <span>➕</span> Invite Staff
          </Button>
        )}
      </div>

      {/* Invitation Table / List */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        {invitations.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2">
            <div className="text-3xl mb-2">🔑</div>
            <div>No staff invitations generated yet.</div>
            {isOwner && (
              <div className="text-[11px] text-zinc-400">
                Click <strong>Invite Staff</strong> to invite Branch Managers, Cashiers, Kitchen Staff, Waiters, or custom role staff.
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Service Areas</th>
                    <th className="py-3 px-4">Code / Copy</th>
                    <th className="py-3 px-4">Bound Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        <div className="flex items-center gap-1.5">
                          <span>{formatRoleLabel(inv.assignedRole, inv.customRoleName)}</span>
                          {inv.customRoleName && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 font-medium">{inv.branchName}</td>
                      <td className="py-3 px-4">
                        {inv.serviceAreaNames && inv.serviceAreaNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {inv.serviceAreaNames.map((areaName, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {areaName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">Branch Wide</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {inv.status === 'pending' ? (
                          inv.rawCode ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-zinc-900 font-bold tracking-wider">{inv.rawCode}</span>
                              <button
                                type="button"
                                onClick={() => copyCodeToClipboard(inv.id, inv.rawCode!)}
                                className="inline-flex min-h-[30px] items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 rounded-lg transition-colors cursor-pointer border border-zinc-200"
                                title="Copy invitation code"
                              >
                                {copiedId === inv.id ? '✓ Copied' : '📋 Copy Code'}
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-zinc-500 font-semibold">{inv.tokenPrefix}</span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <span className="font-mono">{inv.tokenPrefix}</span>
                            <span className="text-[10px] italic">(Code unavailable)</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono">
                        {inv.invitedEmail || <span className="text-zinc-400 italic">Any email</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                            inv.status
                          )}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(inv.expiresAt).toLocaleDateString()} {new Date(inv.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isOwner && inv.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRegenerate(inv)}
                              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                            >
                              Regenerate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(inv.id)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                        {inv.status === 'claimed' && (
                          <span className="text-[11px] text-zinc-400 font-medium">Claimed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block md:hidden divide-y divide-zinc-200">
              {invitations.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 text-sm">{formatRoleLabel(inv.assignedRole, inv.customRoleName)}</span>
                      {inv.customRoleName && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          Custom
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Branch: <strong>{inv.branchName}</strong></span>
                  </div>

                  {/* Mobile Invitation Code & Persistent Copy Button */}
                  {inv.status === 'pending' ? (
                    inv.rawCode ? (
                      <div className="flex items-center justify-between bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 my-1">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Invitation Code</div>
                          <div className="font-mono text-zinc-900 font-bold text-xs tracking-wider">{inv.rawCode}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyCodeToClipboard(inv.id, inv.rawCode!)}
                          className="flex min-h-[36px] items-center gap-1 px-3 py-1 text-xs font-bold text-zinc-800 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors cursor-pointer shadow-xs"
                        >
                          {copiedId === inv.id ? '✓ Copied' : '📋 Copy Code'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between text-zinc-600">
                        <span>Code: <strong className="font-mono">{inv.tokenPrefix}</strong></span>
                      </div>
                    )
                  ) : (
                    <div className="flex justify-between items-center text-zinc-400 text-xs py-0.5">
                      <span>Code: <strong className="font-mono font-normal">{inv.tokenPrefix}</strong></span>
                      <span className="text-[10px] italic">Code unavailable</span>
                    </div>
                  )}

                  {inv.serviceAreaNames && inv.serviceAreaNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {inv.serviceAreaNames.map((areaName, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {areaName}
                        </span>
                      ))}
                    </div>
                  )}
                  {inv.invitedEmail && (
                    <div className="text-zinc-500 font-mono text-[11px]">
                      Email: {inv.invitedEmail}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[11px] text-zinc-400">
                    <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                    <div className="space-x-2">
                      {isOwner && inv.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(inv)}
                            className="font-bold text-amber-600 hover:underline cursor-pointer"
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id)}
                            className="font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE INVITATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">New Staff Invite</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-700 font-bold mb-1">Target Branch *</label>
                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setSelectedAreaIds([]);
                  }}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">Assigned Role *</label>
                <select
                  value={selectedRoleKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedRoleKey(val);
                    if (val !== 'builtin:waiter') {
                      setErrorMsg(null);
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none cursor-pointer"
                  required
                >
                  <optgroup label="Built-in Roles">
                    <option value="builtin:branch_manager">Branch Manager</option>
                    <option value="builtin:cashier">Cashier</option>
                    <option value="builtin:kitchen_staff">Kitchen Staff</option>
                    <option value="builtin:waiter">Waiter</option>
                  </optgroup>
                  {customRoles.length > 0 && (
                    <optgroup label="Custom Roles">
                      {customRoles.map((cr) => (
                        <option key={cr.id} value={`custom:${cr.id}`}>
                          {cr.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Service Areas Checklist */}
              <div className="space-y-2 border-t border-b border-zinc-100 py-3">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 font-bold text-xs">
                    Service Area Assignments {isWaiterSelected && <span className="text-rose-600">*</span>}
                  </label>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    {isWaiterSelected ? 'Required for Waiters' : 'Optional'}
                  </span>
                </div>

                {branchAreas.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl leading-relaxed">
                    ⚠️ No active service areas found for this branch. Create areas in{' '}
                    <strong className="underline">/dashboard/areas</strong> first.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {branchAreas.map((area) => {
                      const isChecked = selectedAreaIds.includes(area.id);
                      return (
                        <label
                          key={area.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer min-h-[44px] ${
                            isChecked
                              ? 'bg-blue-50/60 border-blue-300 text-blue-900'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <span className="font-semibold text-xs">{area.name}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAreaIds([...selectedAreaIds, area.id]);
                              } else {
                                setSelectedAreaIds(selectedAreaIds.filter((id) => id !== area.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">
                  Email <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. cashier@example.com"
                  value={invitedEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvitedEmail(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  If provided, only an account registered with this email can claim this code.
                </p>
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">Invite expires in *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['24h', '48h', '7d'] as ExpiryOption[]).map((exp) => (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => setExpiryOption(exp)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        expiryOption === exp
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED CODE SUCCESS MODAL */}
      {createdCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <h3 className="text-lg font-bold text-zinc-950">Invitation Code Ready</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedCodeModal(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="text-[11px] text-emerald-800 font-medium">
                Single-use invitation code generated for <strong>{createdCodeModal.role}</strong> at{' '}
                <strong>{createdCodeModal.branchName}</strong>:
              </div>

              <div className="flex items-center justify-between bg-white border border-emerald-300 rounded-xl p-3">
                <span className="text-lg font-mono font-bold tracking-widest text-emerald-950 select-all">
                  {createdCodeModal.rawCode}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdCodeModal.rawCode)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>

            <div className="text-xs text-zinc-600 space-y-2">
              <div className="font-bold text-zinc-900">How to share:</div>
              <ol className="list-decimal list-inside space-y-1 text-zinc-500 pl-1">
                <li>Send this single-use code to the team member.</li>
                <li>Direct them to register or login at WSNexa.</li>
                <li>They enter this code in their invitation onboarding prompt.</li>
              </ol>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold"
                onClick={() => {
                  const shareText = `You've been invited to join WSNexa as a ${createdCodeModal.role} at ${createdCodeModal.branchName}!\n\nYour single-use Invitation Code is:\n${createdCodeModal.rawCode}\n\nClaim your invite at: ${window.location.origin}/register`;
                  copyToClipboard(shareText, true);
                }}
              >
                {copiedInstructions ? '✅ Instructions Copied!' : '📋 Copy Full Invitation Instructions'}
              </Button>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setCreatedCodeModal(null)}
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

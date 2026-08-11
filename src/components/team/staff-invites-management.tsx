'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedInvitation } from '@/server/services/staff-invitation.service';
import {
  createInvitationAction,
  revokeInvitationAction,
  regenerateInvitationAction,
} from '@/server/actions/staff-invitation';
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

interface StaffInvitesManagementProps {
  branches: BranchOption[];
  branchAreas?: AreaOption[];
  initialInvitations: FormattedInvitation[];
  userRole: string;
  activeBranchId?: string;
}

export function StaffInvitesManagement({
  branches,
  branchAreas = [],
  initialInvitations,
  userRole,
  activeBranchId,
}: StaffInvitesManagementProps) {
  const [invitations, setInvitations] = useState<FormattedInvitation[]>(initialInvitations);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdCodeModal, setCreatedCodeModal] = useState<{
    rawCode: string;
    tokenPrefix: string;
    role: string;
    branchName: string;
  } | null>(null);

  // Form states
  const [branchId, setBranchId] = useState<string>(activeBranchId || branches[0]?.id || '');
  const [assignedRole, setAssignedRole] = useState<StaffRole>('cashier');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('48h');
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);

  const isOwner = userRole === 'business_owner';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setErrorMsg('Please select a branch.');
      return;
    }

    if (assignedRole === 'waiter' && selectedAreaIds.length === 0) {
      setErrorMsg('At least one Service Area is required when inviting a Waiter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createInvitationAction({
      branchId,
      assignedRole,
      invitedEmail,
      expiryOption,
      serviceAreaIds: selectedAreaIds,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      const selectedBranch = branches.find((b) => b.id === branchId);
      setInvitations([res.data.invitation, ...invitations]);
      setIsModalOpen(false);
      setCreatedCodeModal({
        rawCode: res.data.rawCode,
        tokenPrefix: res.data.tokenPrefix,
        role: assignedRole,
        branchName: selectedBranch?.name || 'Selected Branch',
      });
      // Reset form
      setInvitedEmail('');
      setSelectedAreaIds([]);
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
        role: invitation.assignedRole,
        branchName: invitation.branchName,
      });
    } else {
      alert(res.message || 'Failed to regenerate invitation code.');
    }
  };

  const handleCopyCode = () => {
    if (!createdCodeModal) return;
    navigator.clipboard.writeText(createdCodeModal.rawCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInstructions = () => {
    if (!createdCodeModal) return;
    const text = `Join our team on WSNexa!

Workspace Role: ${formatRoleLabel(createdCodeModal.role)}
Branch: ${createdCodeModal.branchName}

Your Single-Use Invitation Code: ${createdCodeModal.rawCode}

Instructions:
1. Log in or create an account at WSNexa.
2. Select "${formatRoleLabel(createdCodeModal.role)}" on account setup.
3. Enter your Invitation Code on the Authorization screen.`;
    navigator.clipboard.writeText(text);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2000);
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
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

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Staff & Manager Invitations</h1>
          <p className="text-xs text-zinc-500">
            Generate secure, single-use invitation codes bound to specific branches and roles.
          </p>
        </div>

        {isOwner && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <span>➕</span> Generate New Invitation
          </Button>
        )}
      </div>

      {/* Invitation Table / List */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        {invitations.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-2">
            <div className="text-3xl mb-2">🔑</div>
            <div>No staff invitations generated yet.</div>
            {isOwner && (
              <div className="text-[11px] text-zinc-400">
                Click <strong>Generate New Invitation</strong> to invite Branch Managers, Cashiers, Kitchen Staff, or Waiters.
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
                    <th className="py-3 px-4">Code Prefix</th>
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
                        {formatRoleLabel(inv.assignedRole)}
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
                      <td className="py-3 px-4 font-mono text-zinc-500 font-semibold">{inv.tokenPrefix}</td>
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
                              onClick={() => handleRegenerate(inv)}
                              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
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
                    <span className="font-bold text-zinc-900 text-sm">{formatRoleLabel(inv.assignedRole)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Branch: <strong>{inv.branchName}</strong></span>
                    <span className="font-mono text-zinc-500">{inv.tokenPrefix}</span>
                  </div>
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
                            onClick={() => handleRegenerate(inv)}
                            className="font-bold text-amber-600 hover:underline"
                          >
                            Regenerate
                          </button>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            className="font-bold text-rose-600 hover:underline"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Generate Staff Invitation</h3>
              <button
                onClick={() => setIsModalOpen(false)}
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
                  value={assignedRole}
                  onChange={(e) => {
                    const role = e.target.value as StaffRole;
                    setAssignedRole(role);
                    if (role !== 'waiter') {
                      setErrorMsg(null);
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  required
                >
                  <option value="branch_manager">Branch Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                  <option value="waiter">Waiter</option>
                </select>
              </div>

              {/* Service Areas Checklist */}
              <div className="space-y-2 border-t border-b border-zinc-100 py-3">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 font-bold text-xs">
                    Service Area Assignments {assignedRole === 'waiter' && <span className="text-rose-600">*</span>}
                  </label>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    {assignedRole === 'waiter' ? 'Required for Waiters' : 'Optional'}
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
                  Invited Email <span className="text-zinc-400 font-normal">(Optional Binding)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. cashier@example.com"
                  value={invitedEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvitedEmail(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  If set, only an account registered with this exact email can claim this code.
                </p>
              </div>

              <div>
                <label className="block text-zinc-700 font-bold mb-1">Code Expiry Duration *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['24h', '48h', '7d'] as ExpiryOption[]).map((exp) => (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => setExpiryOption(exp)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        expiryOption === exp
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {exp === '24h' ? '24 Hours' : exp === '48h' ? '48 Hours' : '7 Days'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Generating...' : 'Generate Code'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME RAW CODE DISPLAY MODAL */}
      {createdCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl font-bold mx-auto">
              🔑
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white uppercase tracking-wider">Invitation Code Generated</h3>
              <p className="text-xs text-zinc-400">
                Bound for <strong className="text-white">{formatRoleLabel(createdCodeModal.role)}</strong> at{' '}
                <strong className="text-white">{createdCodeModal.branchName}</strong>
              </p>
            </div>

            {/* Prominent One-Time Code Box */}
            <div className="p-4 bg-zinc-900 border border-amber-500/30 rounded-xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Single-Use Code</span>
              <div className="text-xl font-black font-mono text-white tracking-widest selection:bg-amber-500 selection:text-black">
                {createdCodeModal.rawCode}
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 leading-relaxed text-left">
              ⚠️ <strong>IMPORTANT:</strong> This invitation code is displayed <strong>ONLY ONCE</strong> and is not stored in plaintext. Copy it now and send it to your staff member.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                onClick={handleCopyCode}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
              >
                {copiedCode ? '✓ Code Copied!' : '📋 Copy Invitation Code'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyInstructions}
                className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-900"
              >
                {copiedInstructions ? '✓ Instructions Copied!' : '💬 Copy Full Invite Text'}
              </Button>
              <button
                onClick={() => setCreatedCodeModal(null)}
                className="text-xs text-zinc-500 hover:text-zinc-400 font-medium py-1 transition-colors"
              >
                Close & Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMemberBranchAssignmentAction,
  removeMemberBranchAssignmentAction,
} from '@/server/actions/permission';

export interface BranchAssignmentItem {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  isPrimary: boolean;
  isDefault?: boolean;
  status?: string;
  createdAt?: string;
}

export interface TemporaryBranchItem {
  id: string;
  branchId: string;
  branchName: string;
  type: 'secondment' | 'acting';
  roleName?: string;
  dates?: string;
}

interface MemberBranchManagerProps {
  membershipId: string;
  memberName: string;
  assignments: BranchAssignmentItem[];
  allBranches: Array<{ id: string; name: string; code: string; is_default?: boolean }>;
  temporaryBranches?: TemporaryBranchItem[];
  canManage?: boolean;
}

export const MemberBranchManager: React.FC<MemberBranchManagerProps> = ({
  membershipId,
  memberName,
  assignments,
  allBranches,
  temporaryBranches = [],
  canManage = true,
}) => {
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Set of already assigned branch IDs (primary + additional)
  const assignedBranchIds = new Set(assignments.map((a) => a.branchId));
  const availableBranches = allBranches.filter((b) => !assignedBranchIds.has(b.id));

  const handleAddBranch = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await addMemberBranchAssignmentAction({
        membershipId,
        branchId: selectedBranchId,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to add branch assignment.');
      } else {
        setSuccessMsg(res.message || 'Branch assignment added successfully.');
        setIsAddModalOpen(false);
        setSelectedBranchId('');
        router.refresh();
      }
    } catch {
      setErrorMsg('An unexpected error occurred while adding branch.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Are you sure you want to remove operational access to "${branchName}" for ${memberName}?`)) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await removeMemberBranchAssignmentAction({
        membershipId,
        branchId,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to remove branch assignment.');
      } else {
        setSuccessMsg(res.message || 'Branch assignment removed successfully.');
        router.refresh();
      }
    } catch {
      setErrorMsg('An unexpected error occurred while removing branch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center justify-between">
          <span>❌ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between">
          <span>✅ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Operational Branch Access
          </h4>
          <p className="text-[11px] text-zinc-500">
            Locations where this staff member has active operational reach.
          </p>
        </div>

        {canManage && availableBranches.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setSelectedBranchId(availableBranches[0]?.id || '');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors min-h-[44px] sm:min-h-[38px] touch-manipulation cursor-pointer shrink-0"
          >
            <span>+</span>
            <span>Add Additional Branch</span>
          </button>
        )}
      </div>

      {/* Assigned Branches List */}
      <div className="grid grid-cols-1 gap-2.5">
        {assignments.map((assign) => (
          <div
            key={assign.id || assign.branchId}
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              assign.isPrimary
                ? 'bg-blue-50/70 border-blue-200'
                : 'bg-white border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-zinc-950 truncate">
                  📍 {assign.branchName}
                </span>
                {assign.branchCode && (
                  <span className="font-mono text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded border border-zinc-200">
                    {assign.branchCode}
                  </span>
                )}
                {assign.isPrimary ? (
                  <span className="font-bold text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                    Primary Branch
                  </span>
                ) : (
                  <span className="font-bold text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Permanent Operational
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                {assign.isPrimary
                  ? 'Main organizational home base. Transferred via position assignment.'
                  : 'Additional authorized property for multi-unit/floating operational access.'}
              </p>
            </div>

            {/* Remove Action for Non-Primary */}
            {!assign.isPrimary && canManage && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleRemoveBranch(assign.branchId, assign.branchName)}
                className="self-start sm:self-auto px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors min-h-[44px] sm:min-h-[34px] flex items-center gap-1 touch-manipulation cursor-pointer shrink-0"
              >
                <span>🗑️</span>
                <span>Remove Access</span>
              </button>
            )}
          </div>
        ))}

        {/* Temporary Authority (Secondments & Acting) */}
        {temporaryBranches.map((temp) => (
          <div
            key={temp.id}
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              temp.type === 'secondment'
                ? 'bg-indigo-50/60 border-indigo-200'
                : 'bg-amber-50/60 border-amber-200'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-xs text-zinc-950 truncate">
                  {temp.type === 'secondment' ? '✈️' : '🎭'} {temp.branchName}
                </span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                  temp.type === 'secondment'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  {temp.type === 'secondment' ? 'Secondment Host' : 'Acting Coverage'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-600">
                Temporary cross-property reach ({temp.roleName || 'Active Deployment'}{temp.dates ? ` • ${temp.dates}` : ''}).
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Additional Branch Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Add Operational Branch Access
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Grant <strong>{memberName}</strong> operational access to an additional branch. This will allow them to view and operate in this branch according to their assigned role.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700">
                Select Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 min-h-[44px]"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 rounded-xl min-h-[44px] touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !selectedBranchId}
                onClick={handleAddBranch}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors min-h-[44px] touch-manipulation cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Assigning...' : 'Grant Operational Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

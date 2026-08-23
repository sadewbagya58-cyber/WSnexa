'use client';

import React, { useState } from 'react';
import { FormattedPermission, ScopeType } from '@/types/authorization.types';
import { IconShieldAlert, IconAlertTriangle } from './access-icons';
import { setScopedMemberOverrideAction } from '@/server/actions/permission';

interface MemberOverrideModalProps {
  membershipId: string;
  memberName: string;
  catalog: FormattedPermission[];
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export const MemberOverrideModal: React.FC<MemberOverrideModalProps> = ({
  membershipId,
  memberName,
  catalog,
  branches = [],
  departments = [],
  onClose,
  onSuccess,
}) => {
  const [permissionKey, setPermissionKey] = useState<string>(catalog[0]?.key || '');
  const [isAllowed, setIsAllowed] = useState<boolean>(false); // default to DENY override for safety
  const [scopeType, setScopeType] = useState<ScopeType>('PROPERTY');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [departmentId, setDepartmentId] = useState<string>(departments[0]?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await setScopedMemberOverrideAction({
      membershipId,
      permissionKey: permissionKey as unknown as Parameters<typeof setScopedMemberOverrideAction>[0]['permissionKey'],
      effect: isAllowed ? 'allow' : 'deny',
      scopeType,
      branchId: scopeType === 'PROPERTY' ? branchId : undefined,
      departmentId: scopeType === 'DEPARTMENT' ? departmentId : undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to save permission override.');
      return;
    }

    onClose();
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-zinc-200 space-y-4">
        <div className="flex items-center gap-2">
          <IconShieldAlert className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-zinc-900">Set Member Permission Override</h3>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 font-medium">
            {errorMsg}
          </div>
        )}

        {/* DENY Warning Banner */}
        {!isAllowed && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
            <IconAlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">This will block this staff member from this action.</span>
              This restriction overrides the staff member&apos;s normal role and applies regardless of other permissions. It takes immediate effect for the selected location.
            </div>
          </div>
        )}

        {/* Permission Key (WHAT) */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">Permission Key (WHAT)</label>
          <select
            value={permissionKey}
            onChange={(e) => setPermissionKey(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {catalog.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} ({p.name})
              </option>
            ))}
          </select>
        </div>

        {/* Effect & Scope Type */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Override Effect</label>
            <select
              value={isAllowed ? 'ALLOW' : 'DENY'}
              onChange={(e) => setIsAllowed(e.target.value === 'ALLOW')}
              className={`w-full px-3 py-2 text-xs font-bold border rounded-xl focus:outline-none ${
                isAllowed ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              <option value="DENY">Explicit DENY</option>
              <option value="ALLOW">Explicit ALLOW</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Scope Level</label>
            <select
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as ScopeType)}
              className="w-full px-3 py-2 text-xs font-semibold border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="ORGANIZATION">ORGANIZATION</option>
              <option value="PROPERTY">PROPERTY</option>
              <option value="DEPARTMENT">DEPARTMENT</option>
            </select>
          </div>
        </div>

        {/* Scope Target Selector */}
        {scopeType === 'PROPERTY' && branches.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Branch / Property</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {scopeType === 'DEPARTMENT' && departments.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 flex items-center gap-1.5 ${
              isAllowed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Set Member Override'}
          </button>
        </div>
      </form>
    </div>
  );
};

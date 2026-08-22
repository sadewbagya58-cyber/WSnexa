'use client';

import React, { useState, useEffect } from 'react';
import { CustomRoleDetail, BuiltInRoleTemplate, RoleUsageInfo } from '@/types/authorization.types';
import { IconAlertTriangle, IconArchive, IconUsers, IconArrowRight, IconShieldCheck } from './access-icons';
import { getRoleUsageAction, archiveCustomRoleAction } from '@/server/actions/permission';

interface RoleArchiveModalProps {
  role: CustomRoleDetail;
  availableRoles: Array<{ id: string; name: string; isBuiltIn?: boolean }>;
  builtInTemplates: BuiltInRoleTemplate[];
  onClose: () => void;
  onSuccess: () => void;
}

export const RoleArchiveModal: React.FC<RoleArchiveModalProps> = ({
  role,
  availableRoles,
  builtInTemplates,
  onClose,
  onSuccess,
}) => {
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [usageInfo, setUsageInfo] = useState<RoleUsageInfo | null>(null);
  const [selectedTargetRole, setSelectedTargetRole] = useState<string>('branch_manager');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadUsage() {
      setLoadingUsage(true);
      const res = await getRoleUsageAction({ customRoleId: role.id });
      if (isMounted) {
        setLoadingUsage(false);
        if (res.success && res.data) {
          setUsageInfo(res.data);
        }
      }
    }
    loadUsage();
    return () => {
      isMounted = false;
    };
  }, [role.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const isTargetBuiltIn = builtInTemplates.some((t) => t.roleKey === selectedTargetRole);

    const res = await archiveCustomRoleAction({
      roleId: role.id,
      reassignToRoleKey: isTargetBuiltIn ? selectedTargetRole : undefined,
      reassignToCustomRoleId: !isTargetBuiltIn ? selectedTargetRole : undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to archive custom role.');
      return;
    }

    onSuccess();
  };

  const memberCount = usageInfo?.activeMembers || 0;
  const pendingCount = usageInfo?.pendingInvitations || 0;
  const requiresReassignment = memberCount > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-zinc-200 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
            <IconArchive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">Archive Custom Role: {role.name}</h3>
            <p className="text-xs text-zinc-500">Safely retire role and reassign affected members.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 font-medium">
            {errorMsg}
          </div>
        )}

        {loadingUsage ? (
          <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200 animate-pulse">
            Analyzing active members and invitation usage...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Usage Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Active Members</span>
                <span className={`text-xl font-bold font-mono ${memberCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {memberCount}
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Pending Invites</span>
                <span className="text-xl font-bold font-mono text-zinc-700">{pendingCount}</span>
              </div>
            </div>

            {requiresReassignment ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <IconAlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Reassignment Required Before Archival</span>
                </div>
                <p className="leading-relaxed text-amber-800">
                  This role is currently assigned to {memberCount} active staff member{memberCount > 1 ? 's' : ''}. Select a target role to reassign them to automatically before archiving.
                </p>

                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Target Reassignment Role
                  </label>
                  <select
                    value={selectedTargetRole}
                    onChange={(e) => setSelectedTargetRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium"
                  >
                    <optgroup label="Built-in Standard Roles">
                      {builtInTemplates
                        .filter((t) => t.roleKey !== 'business_owner')
                        .map((t) => (
                          <option key={t.roleKey} value={t.roleKey}>
                            {t.displayName} (Built-in)
                          </option>
                        ))}
                    </optgroup>
                    {availableRoles.filter((r) => r.id !== role.id && !r.isBuiltIn).length > 0 && (
                      <optgroup label="Other Custom Roles">
                        {availableRoles
                          .filter((r) => r.id !== role.id && !r.isBuiltIn)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name} (Custom)
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="pt-2 text-[11px] font-medium text-amber-950 flex items-center gap-1 bg-amber-100/60 p-2 rounded-lg border border-amber-200">
                  <IconUsers className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                  <span>
                    Summary: <strong>{memberCount}</strong> active member{memberCount > 1 ? 's' : ''} will move from <strong>{role.name}</strong> <IconArrowRight className="w-3 h-3 inline mx-0.5" /> <strong>{selectedTargetRole}</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <IconShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Safe to Archive:</span> No active staff members are currently assigned to this role.
                </div>
              </div>
            )}
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
            disabled={isSubmitting || loadingUsage}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Archiving...' : 'Confirm Archival'}
          </button>
        </div>
      </form>
    </div>
  );
};

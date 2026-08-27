'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { EffectiveAccessPreview, BuiltInRoleTemplate, CustomRoleDetail, FormattedPermission } from '@/types/authorization.types';
import { MemberOverrideModal } from '@/components/access/member-override-modal';
import {
  IconUser,
  IconBuildingSkyscraper,
  IconShieldCheck,
  IconZap,
  IconShieldAlert,
  IconEdit,
  IconTrash,
  IconPlus,
  IconCircleCheck,
  IconCircleX,
} from './access-icons';
import { removeMemberOverrideAction, updateMemberRoleAction } from '@/server/actions/permission';
import { useRouter } from 'next/navigation';

interface MemberAccessDetailClientProps {
  preview: EffectiveAccessPreview;
  catalog: FormattedPermission[];
  builtInTemplates: BuiltInRoleTemplate[];
  customRoles: CustomRoleDetail[];
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
}

export const MemberAccessDetailClient: React.FC<MemberAccessDetailClientProps> = ({
  preview,
  catalog,
  builtInTemplates,
  customRoles,
  branches = [],
  departments = [],
}) => {
  const router = useRouter();
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showRoleAssignModal, setShowRoleAssignModal] = useState(false);
  const [selectedRoleType, setSelectedRoleType] = useState<'BUILT_IN' | 'CUSTOM'>('BUILT_IN');
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(preview.role || 'waiter');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>(customRoles[0]?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRemoveOverride = async (permissionKey: string) => {
    if (!confirm(`Are you sure you want to remove the override for '${permissionKey}'?`)) return;
    setIsSubmitting(true);
    await removeMemberOverrideAction(preview.membershipId, permissionKey as unknown as Parameters<typeof removeMemberOverrideAction>[1]);
    setIsSubmitting(false);
    router.refresh();
  };

  const handleAssignRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updateMemberRoleAction({
      membershipId: preview.membershipId,
      builtInRole: selectedRoleType === 'BUILT_IN' ? (selectedRoleKey as unknown as Parameters<typeof updateMemberRoleAction>[0]['builtInRole']) : 'waiter',
      customRoleId: selectedRoleType === 'CUSTOM' ? selectedCustomRoleId : undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to update member role.');
      return;
    }

    setShowRoleAssignModal(false);
    router.refresh();
  };

  const isOwner = preview.role === 'business_owner';
  const memberDisplayName = preview.memberName || 'Staff Member';
  const nameParts = memberDisplayName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : memberDisplayName.slice(0, 2).toUpperCase();
  const actingAssignments = preview.temporaryAuthority?.actingAssignments || [];
  const secondments = preview.temporaryAuthority?.secondmentAssignments || preview.temporaryAuthority?.secondments || [];
  const overridesList = preview.scopedOverrides || preview.overrides || [];

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shadow-2xs">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900">{memberDisplayName}</h2>
              {isOwner && (
                <span className="text-[10px] font-bold font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Business Owner
                </span>
              )}
              <Link
                href={`/dashboard/people/${preview.membershipId}`}
                className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 hover:underline border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 rounded-full"
              >
                👤 View People Profile →
              </Link>
            </div>
            {preview.userEmail ? (
              <p className="text-xs text-zinc-600 font-mono">{preview.userEmail}</p>
            ) : null}
            <p className="text-[11px] text-zinc-400 font-mono">Membership ID: {preview.membershipId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setShowRoleAssignModal(true)}
            className="flex-1 md:flex-none px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <IconEdit className="w-3.5 h-3.5" /> Reassign Role
          </button>
          <button
            type="button"
            onClick={() => setShowOverrideModal(true)}
            className="flex-1 md:flex-none px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <IconPlus className="w-3.5 h-3.5" /> Add Override
          </button>
        </div>
      </div>

      {/* Grid of 4 Distinct Authorization Aspects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. ORGANIZATION IDENTITY */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <IconBuildingSkyscraper className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              1. Organization & Reporting Identity
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Position Title</span>
              <span className="font-semibold text-zinc-900">{preview.position || 'Unassigned Title'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Primary Branch</span>
              <span className="font-semibold text-zinc-900">
                {branches.find((b) => b.id === preview.primaryBranchId)?.name || 'Default Branch'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Department</span>
              <span className="font-semibold text-zinc-900">
                {departments.find((d) => d.id === preview.departmentId)?.name || 'General'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">User Email</span>
              <span className="font-mono text-zinc-800 truncate">{preview.userEmail}</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 italic bg-zinc-50/80 p-2.5 rounded-lg border border-zinc-200/80">
            Note: Job Titles and Positions establish reporting structure and identity. They do NOT dictate permission capabilities directly.
          </p>
        </div>

        {/* 2. ACCESS CONTROL & ROLES */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <IconShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              2. Access Control & Role Capability (WHAT)
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <span className="block text-[10px] text-emerald-700 font-medium uppercase">Role Standard</span>
              <span className="font-bold text-emerald-950 capitalize">{preview.role}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Custom Role</span>
              <span className="font-semibold text-zinc-900">
                {preview.customRoleName || 'None (Standard Role)'}
              </span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Default Scope</span>
              <span className="font-mono font-semibold text-zinc-900">{preview.preset?.defaultScope || preview.defaultScope || 'PROPERTY'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Role Capabilities</span>
              <span className="font-mono font-bold text-emerald-700">{preview.rolePermissions.length} keys</span>
            </div>
          </div>
        </div>

        {/* 3. TEMPORARY AUTHORITY */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <IconZap className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              3. Temporary Authority (WHERE Expansion)
            </h3>
          </div>

          <div className="space-y-3">
            {actingAssignments.length === 0 && secondments.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-50 rounded-xl border border-zinc-200">
                No active acting assignments or secondments.
              </p>
            ) : (
              <>
                {actingAssignments.map((a: Record<string, unknown>) => (
                  <div key={String(a.id)} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-amber-900">
                      <span>Acting Position Coverage</span>
                      <span className="font-mono text-[10px] bg-amber-200 px-1.5 py-0.5 rounded">Active</span>
                    </div>
                    <p className="text-amber-800 text-[11px]">
                      Expands reach to department/unit position. Temporary authority does NOT inherit position owner permissions.
                    </p>
                  </div>
                ))}

                {secondments.map((s: Record<string, unknown>) => (
                  <div key={String(s.id)} className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-indigo-900">
                      <span>Property Secondment</span>
                      <span className="font-mono text-[10px] bg-indigo-200 px-1.5 py-0.5 rounded">Host Branch</span>
                    </div>
                    <p className="text-indigo-800 text-[11px]">
                      Expands access to host branch without altering base role permissions.
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 4. MEMBER PERMISSION OVERRIDES */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <IconShieldAlert className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                4. Member Permission Overrides
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowOverrideModal(true)}
              className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <IconPlus className="w-3.5 h-3.5" /> Add Override
            </button>
          </div>

          {overridesList.length === 0 ? (
            <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-50 rounded-xl border border-zinc-200">
              No member permission overrides set. Member uses standard role evaluation.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {overridesList.map((o: Record<string, unknown>) => {
                const isAllowed = o.effect === 'allow' || o.effect === 'ALLOW' || o.isAllowed === true;

                return (
                  <div
                    key={String(o.id || o.permissionKey)}
                    className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isAllowed ? (
                        <IconCircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <IconCircleX className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span className="font-mono font-semibold text-zinc-900 truncate">
                        {String(o.permissionKey)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isAllowed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isAllowed ? 'ALLOW' : 'DENY'}
                      </span>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleRemoveOverride(String(o.permissionKey))}
                        className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                        title="Remove Override"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Role Assignment Modal */}
      {showRoleAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAssignRoleSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-base font-bold text-zinc-900">Reassign Member Role</h3>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 font-medium">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Role Type</label>
              <select
                value={selectedRoleType}
                onChange={(e) => setSelectedRoleType(e.target.value as 'BUILT_IN' | 'CUSTOM')}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
              >
                <option value="BUILT_IN">Built-In Role</option>
                <option value="CUSTOM">Custom Role</option>
              </select>
            </div>

            {selectedRoleType === 'BUILT_IN' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Built-In Role</label>
                <select
                  value={selectedRoleKey}
                  onChange={(e) => setSelectedRoleKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none font-medium"
                >
                  {builtInTemplates.map((t) => (
                    <option key={t.roleKey} value={t.roleKey}>{t.displayName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Custom Role</label>
                <select
                  value={selectedCustomRoleId}
                  onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none font-medium"
                >
                  {customRoles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowRoleAssignModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                {isSubmitting ? 'Saving...' : 'Update Member Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <MemberOverrideModal
          membershipId={preview.membershipId}
          memberName={memberDisplayName}
          catalog={catalog}
          branches={branches}
          departments={departments}
          onClose={() => setShowOverrideModal(false)}
          onSuccess={() => {
            setShowOverrideModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
};

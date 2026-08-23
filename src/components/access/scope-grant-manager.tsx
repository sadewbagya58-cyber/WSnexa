'use client';

import React, { useState } from 'react';
import { ScopeGrantDetail, ScopeType, BuiltInRoleTemplate, CustomRoleDetail, FormattedPermission } from '@/types/authorization.types';
import { ScopePresetSelector } from '@/components/access/scope-preset-selector';
import {
  IconShieldAlert,
  IconPlus,
  IconTrash,
  IconEdit,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconUsers,
  IconMapPin,
  IconCircleCheck,
  IconCircleX,
} from './access-icons';
import {
  createPermissionScopeGrantAction,
  updatePermissionScopeGrantAction,
  revokePermissionScopeGrantAction,
} from '@/server/actions/permission';
import { useRouter } from 'next/navigation';

interface ScopeGrantManagerProps {
  grants: ScopeGrantDetail[];
  catalog: FormattedPermission[];
  builtInTemplates: BuiltInRoleTemplate[];
  customRoles: CustomRoleDetail[];
  branches?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
}

export const ScopeGrantManager: React.FC<ScopeGrantManagerProps> = ({
  grants,
  catalog,
  builtInTemplates,
  customRoles,
  branches = [],
  departments = [],
}) => {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingGrant, setEditingGrant] = useState<ScopeGrantDetail | null>(null);

  // Form states
  const [targetType, setTargetType] = useState<'BUILT_IN' | 'CUSTOM'>('BUILT_IN');
  const [roleKey, setRoleKey] = useState<string>('branch_manager');
  const [customRoleId, setCustomRoleId] = useState<string>(customRoles[0]?.id || '');
  const [permissionKey, setPermissionKey] = useState<string>(catalog[0]?.key || '');
  const [scopeType, setScopeType] = useState<ScopeType>('PROPERTY');
  const [effect, setEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [departmentId, setDepartmentId] = useState<string>(departments[0]?.id || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingGrant(null);
    setTargetType('BUILT_IN');
    setRoleKey('branch_manager');
    setCustomRoleId(customRoles[0]?.id || '');
    setPermissionKey(catalog[0]?.key || '');
    setScopeType('PROPERTY');
    setEffect('ALLOW');
    setBranchId(branches[0]?.id || '');
    setDepartmentId(departments[0]?.id || '');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (g: ScopeGrantDetail) => {
    setEditingGrant(g);
    if (g.customRoleId) {
      setTargetType('CUSTOM');
      setCustomRoleId(g.customRoleId);
    } else {
      setTargetType('BUILT_IN');
      setRoleKey(g.roleKey || 'branch_manager');
    }
    setPermissionKey(g.permissionKey);
    setScopeType(g.scopeType);
    setEffect(g.effect.toUpperCase() as 'ALLOW' | 'DENY');
    setBranchId(g.branchId || branches[0]?.id || '');
    setDepartmentId(g.departmentId || departments[0]?.id || '');
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleRevoke = async (grantId: string) => {
    if (!confirm('Are you sure you want to revoke this scoped permission grant?')) return;
    setRevokingGrantId(grantId);
    const res = await revokePermissionScopeGrantAction(grantId);
    setRevokingGrantId(null);
    if (!res.success) {
      setErrorMsg(res.message || 'Failed to revoke grant. Please try again.');
      return;
    }
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      roleKey: targetType === 'BUILT_IN' ? roleKey : undefined,
      customRoleId: targetType === 'CUSTOM' ? customRoleId : undefined,
      permissionKey: permissionKey as unknown as Parameters<typeof createPermissionScopeGrantAction>[0]['permissionKey'],
      scopeType,
      effect: effect.toLowerCase() as 'allow' | 'deny',
      grantSource: targetType === 'BUILT_IN' ? ('role_preset' as const) : ('custom_role' as const),
      branchId: scopeType === 'PROPERTY' ? branchId : undefined,
      departmentId: scopeType === 'DEPARTMENT' ? departmentId : undefined,
    };

    if (editingGrant) {
      const res = await updatePermissionScopeGrantAction({
        grantId: editingGrant.id,
        ...payload,
      });
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to update grant.');
        return;
      }
    } else {
      const res = await createPermissionScopeGrantAction(payload);
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to create grant.');
        return;
      }
    }

    setShowModal(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Scoped Permission Grants</h3>
          <p className="text-xs text-zinc-500">Configure target permission reach (ALLOW / DENY) for roles across properties or departments.</p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
        >
          <IconPlus className="w-4 h-4" /> Create Scope Grant
        </button>
      </div>

      {/* Scope Grants List */}
      {grants.length === 0 ? (
        <div className="p-12 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <IconShieldAlert className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-zinc-700">No Scoped Permission Grants Defined</h4>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            Permission grants allow fine-grained ALLOW/DENY authorization rules for specific branches or departments.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center gap-1.5"
          >
            <IconPlus className="w-4 h-4" /> Create First Scope Grant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grants.map((g) => {
            const isDeny = String(g.effect).toUpperCase() === 'DENY';
            const roleName = g.roleKey
              ? builtInTemplates.find((t) => t.roleKey === g.roleKey)?.displayName || g.roleKey
              : customRoles.find((c) => c.id === g.customRoleId)?.name || 'Custom Role';

            return (
              <div
                key={g.id}
                className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs hover:border-zinc-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* WHO & EFFECT */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <IconUsers className="w-3.5 h-3.5 text-zinc-500" />
                      {roleName}
                    </span>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isDeny ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isDeny ? <IconCircleX className="w-3 h-3 text-red-600" /> : <IconCircleCheck className="w-3 h-3 text-emerald-600" />}
                      {g.effect}
                    </span>
                  </div>

                  {/* WHAT */}
                  <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 mb-3">
                    <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Permission Key (WHAT)
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-900 break-all">
                      {g.permissionKey}
                    </span>
                  </div>

                  {/* WHERE */}
                  <div className="space-y-1.5 text-xs text-zinc-600 mb-4">
                    <div className="flex justify-between">
                      <span>Scope Level:</span>
                      <span className="font-semibold text-zinc-900">{g.scopeType}</span>
                    </div>
                    {g.branchId && (
                      <div className="flex justify-between">
                        <span>Target Property:</span>
                        <span className="font-mono text-zinc-800">
                          {branches.find((b) => b.id === g.branchId)?.name || g.branchId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                    {g.departmentId && (
                      <div className="flex justify-between">
                        <span>Target Department:</span>
                        <span className="font-mono text-zinc-800">
                          {departments.find((d) => d.id === g.departmentId)?.name || g.departmentId.slice(0, 8)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    disabled={isSubmitting || revokingGrantId !== null}
                    onClick={() => handleOpenEdit(g)}
                    className="flex-1 py-1.5 px-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <IconEdit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={revokingGrantId !== null || isSubmitting}
                    onClick={() => handleRevoke(g.id)}
                    className="py-1.5 px-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                    {revokingGrantId === g.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2">
              <IconShieldAlert className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-zinc-900">
                {editingGrant ? 'Edit Permission Scope Grant' : 'Create Permission Scope Grant'}
              </h3>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 font-medium">
                {errorMsg}
              </div>
            )}

            {/* Target Role */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Type</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as 'BUILT_IN' | 'CUSTOM')}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="BUILT_IN">Built-In Role</option>
                  <option value="CUSTOM">Custom Role</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Role</label>
                {targetType === 'BUILT_IN' ? (
                  <select
                    value={roleKey}
                    onChange={(e) => setRoleKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  >
                    {builtInTemplates.map((t) => (
                      <option key={t.roleKey} value={t.roleKey}>{t.displayName}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={customRoleId}
                    onChange={(e) => setCustomRoleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  >
                    {customRoles.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Permission Key */}
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
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Grant Effect</label>
                <select
                  value={effect}
                  onChange={(e) => setEffect(e.target.value as 'ALLOW' | 'DENY')}
                  className="w-full px-3 py-2 text-xs font-bold border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="DENY">DENY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Scope Level</label>
                <select
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value as ScopeType)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="ORGANIZATION">ORGANIZATION</option>
                  <option value="PROPERTY">PROPERTY</option>
                  <option value="DEPARTMENT">DEPARTMENT</option>
                  <option value="AREA_TEAM">AREA / TEAM</option>
                </select>
              </div>
            </div>

            {/* Target Property / Department */}
            {scopeType === 'PROPERTY' && branches.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Target Property / Branch</label>
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
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? 'Saving...' : editingGrant ? 'Update Grant' : 'Create Grant'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

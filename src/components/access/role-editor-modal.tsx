'use client';

import React, { useState } from 'react';
import { CustomRoleDetail, ScopeType } from '@/types/authorization.types';
import { FormattedPermission } from '@/server/services/permission.service';
import { ScopePresetSelector } from '@/components/access/scope-preset-selector';
import { PermissionMatrix } from '@/components/access/permission-matrix';
import { IconShield, IconSparkles, IconAlertCircle } from './access-icons';
import { createCustomRoleAction, updateCustomRoleAction } from '@/server/actions/permission';

interface RoleEditorModalProps {
  mode: 'create' | 'edit';
  role?: CustomRoleDetail;
  catalog: FormattedPermission[];
  onClose: () => void;
  onSuccess: (updatedRoleId?: string) => void;
}

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
  mode,
  role,
  catalog,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [defaultScope, setDefaultScope] = useState<ScopeType>(role?.defaultScope || 'PROPERTY');
  const [maxScope, setMaxScope] = useState<ScopeType>(role?.maxScope || 'PROPERTY');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Role name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    if (mode === 'create') {
      const res = await createCustomRoleAction({
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions as any,
        defaultScope,
        maxScope,
      });

      setIsSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to create custom role.');
        return;
      }
      onSuccess(res.data?.id);
    } else {
      if (!role?.id) return;
      const res = await updateCustomRoleAction({
        roleId: role.id,
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions as any,
        defaultScope,
        maxScope,
      });

      setIsSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.message || 'Failed to update custom role.');
        return;
      }
      onSuccess(role.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-4xl w-full my-auto shadow-xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {mode === 'create' ? 'Create Custom Role' : `Edit Role: ${role?.name}`}
              </h3>
              <p className="text-xs text-zinc-500">Configure permission capabilities and scope boundaries.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl font-medium leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
              <IconAlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Basic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                Custom Role Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Floor Manager"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Operational purpose of this custom role..."
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Scope Presets */}
          <div className="space-y-4 pt-2 border-t border-zinc-100">
            <ScopePresetSelector
              label="Default Authority Scope"
              value={defaultScope}
              onChange={setDefaultScope}
              helpText="Initial scope evaluated when a member is assigned this role."
            />

            <ScopePresetSelector
              label="Maximum Scope Ceiling"
              value={maxScope}
              onChange={setMaxScope}
              helpText="Upper limit boundary that scope grants or overrides cannot exceed for this role."
            />
          </div>

          {/* Permission Bundle Matrix */}
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Bundled Permissions Selection
            </label>
            <PermissionMatrix
              catalog={catalog}
              selectedPermissions={selectedPermissions}
              onChange={setSelectedPermissions}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">
            {selectedPermissions.length} permission keys selected
          </span>

          <div className="flex gap-2">
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
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
            >
              <IconSparkles className="w-3.5 h-3.5" />
              {isSubmitting ? 'Saving Role...' : mode === 'create' ? 'Create Custom Role' : 'Save Role Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

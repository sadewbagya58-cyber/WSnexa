'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PermissionKey } from '@/lib/validation/permission';
import { ROLE_PRESETS, getPermissionsForPreset } from '@/lib/validation/permission-presets';
import { FormattedPermission } from '@/server/services/permission.service';
import { SimplePermissionEditor } from '@/components/team/simple-permission-editor';

interface RoleCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: FormattedPermission[];
  editingRoleName?: string;
  editingRoleDescription?: string;
  initialPermissions?: PermissionKey[];
  onSave: (name: string, description: string, permissions: PermissionKey[]) => Promise<void>;
  isEditing?: boolean;
}

export function RoleCreationWizard({
  isOpen,
  onClose,
  catalog,
  editingRoleName = '',
  editingRoleDescription = '',
  initialPermissions = [],
  onSave,
  isEditing = false,
}: RoleCreationWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 3 : 1);
  const [roleName, setRoleName] = useState(editingRoleName);
  const [roleDescription, setRoleDescription] = useState(editingRoleDescription);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [permissions, setPermissions] = useState<PermissionKey[]>(initialPermissions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTemplateSelect = (tplKey: string) => {
    setSelectedTemplate(tplKey);
    if (tplKey !== 'custom') {
      const presetPerms = getPermissionsForPreset(tplKey);
      setPermissions(presetPerms);
    }
  };

  const handleFinalSave = async () => {
    if (!roleName.trim()) {
      setErrorMsg('Role name is required.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onSave(roleName.trim(), roleDescription.trim(), permissions);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] flex flex-col shadow-2xl">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-white tracking-wide">
              {isEditing ? 'Edit Custom Role' : 'Create Custom Role'}
            </h2>
            <p className="text-xs text-zinc-400">
              Step {step} of 3 — {step === 1 ? 'Role Details' : step === 2 ? 'Starting Template' : 'Fine-Tune Permissions'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-amber-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-amber-500' : 'bg-zinc-800'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-amber-500' : 'bg-zinc-800'}`} />
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Shift Supervisor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full bg-zinc-950 text-white text-sm border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  Role Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what staff assigned to this role can do..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full bg-zinc-950 text-white text-xs border border-zinc-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-zinc-400">
                Choose a starting template to pre-fill permission toggles:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ...ROLE_PRESETS,
                  {
                    key: 'custom',
                    name: 'Custom (Blank)',
                    description: 'Start with no pre-selected permissions and configure manually.',
                    permissions: [],
                  },
                ].map((tpl) => {
                  const isSel = selectedTemplate === tpl.key;
                  return (
                    <div
                      key={tpl.key}
                      onClick={() => handleTemplateSelect(tpl.key)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all space-y-1.5 ${
                        isSel
                          ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{tpl.name}</span>
                        {isSel && <span className="text-amber-400 text-xs">✓</span>}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{tpl.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Toggle capability permissions ON or OFF for <strong className="text-white">{roleName || 'Custom Role'}</strong>:
                </p>
                <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {permissions.length} Enabled
                </span>
              </div>
              <SimplePermissionEditor
                catalog={catalog}
                selectedPermissions={permissions}
                onChange={setPermissions}
              />
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 | 3 : 1))}
              disabled={isSubmitting}
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              ← Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 border-zinc-800"
            >
              Cancel
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && !roleName.trim()) {
                  setErrorMsg('Role name is required.');
                  return;
                }
                setErrorMsg(null);
                setStep((s) => (s < 3 ? (s + 1) as 1 | 2 | 3 : 3));
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Next Step →
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSave}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold"
            >
              {isSubmitting ? 'Saving Role...' : isEditing ? 'Update Role ✓' : 'Create Role ✓'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

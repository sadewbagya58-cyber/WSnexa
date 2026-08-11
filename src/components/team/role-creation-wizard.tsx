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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-zinc-200 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-black text-zinc-950 tracking-wide">
              {isEditing ? 'Edit Custom Role' : 'Create Custom Role'}
            </h2>
            <p className="text-xs text-zinc-500">
              Step {step} of 3 — {step === 1 ? 'Role Details' : step === 2 ? 'Starting Template' : 'Fine-Tune Permissions'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold text-center shrink-0">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Shift Supervisor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full bg-white text-zinc-950 text-sm border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-950 shadow-xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-1">
                  Role Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe what staff assigned to this role can do..."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full bg-white text-zinc-950 text-xs border border-zinc-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-zinc-950 shadow-xs"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-zinc-600">
                Choose a starting template to pre-fill permission toggles:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ...ROLE_PRESETS,
                  {
                    key: 'custom',
                    name: 'Custom (Blank)',
                    description: 'Start with no pre-selected permissions and configure manually.',
                    permissions: [],
                  },
                ].map((tpl) => {
                  const isSelected = selectedTemplate === tpl.key;
                  return (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => handleTemplateSelect(tpl.key)}
                      className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] min-h-[44px] touch-manipulation flex flex-col justify-between ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-xs flex items-center justify-between">
                          <span className="truncate">{tpl.name}</span>
                          {isSelected && <span className="text-[10px] shrink-0">✓</span>}
                        </div>
                        <p className={`text-[10px] mt-1 line-clamp-2 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {tpl.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600">
                  Toggle capability permissions ON or OFF for <strong className="text-zinc-950">{roleName || 'Custom Role'}</strong>:
                </p>
                <span className="text-xs font-mono text-zinc-900 font-bold bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200">
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
        <div className="flex items-center justify-between border-t border-zinc-100 pt-4 shrink-0">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 | 3 : 1))}
              disabled={isSubmitting}
              className="border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            >
              ← Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-900 border-zinc-200"
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
              className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold px-5"
            >
              Next Step →
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSave}
              disabled={isSubmitting}
              className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold px-5"
            >
              {isSubmitting ? 'Saving Role...' : isEditing ? 'Update Role ✓' : 'Create Role ✓'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

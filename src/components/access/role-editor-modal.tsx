'use client';

import React, { useState } from 'react';
import { CustomRoleDetail, ScopeType, FormattedPermission } from '@/types/authorization.types';
import { ScopePresetSelector } from '@/components/access/scope-preset-selector';
import { PermissionMatrix } from '@/components/access/permission-matrix';
import { IconShield, IconSparkles, IconAlertCircle, IconChevronDown, IconChevronUp } from './access-icons';
import { createCustomRoleAction, updateCustomRoleAction } from '@/server/actions/permission';
import { ROLE_PRESETS, getPermissionsForPreset } from '@/lib/validation/permission-presets';

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
  // Wizard state for create mode
  const [step, setStep] = useState<1 | 2 | 3>(mode === 'create' ? 1 : 3);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');

  // Role form fields
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [defaultScope, setDefaultScope] = useState<ScopeType>(role?.defaultScope || 'PROPERTY');
  const [maxScope, setMaxScope] = useState<ScopeType>(role?.maxScope || 'PROPERTY');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role?.permissions || []);

  // Advanced panel toggle state (collapsed by default for clean small-business UX)
  const [showAdvancedScopes, setShowAdvancedScopes] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    if (templateKey !== 'custom') {
      const presetPerms = getPermissionsForPreset(templateKey);
      setSelectedPermissions(presetPerms);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!name.trim()) {
        setErrorMsg('Role name is required.');
        return;
      }
      setErrorMsg(null);
      setStep(2);
    } else if (step === 2) {
      setErrorMsg(null);
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleFinalSubmit = async () => {
    // Critical Guard: In create mode, submission is strictly forbidden unless the user is on Step 3
    if (mode === 'create' && step !== 3) {
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Role name is required.');
      setStep(1);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (mode === 'create') {
        const res = await createCustomRoleAction({
          name: name.trim(),
          description: description.trim(),
          permissions: selectedPermissions as unknown as Parameters<typeof createCustomRoleAction>[0]['permissions'],
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
        if (!role?.id) {
          setIsSubmitting(false);
          return;
        }
        const res = await updateCustomRoleAction({
          roleId: role.id,
          name: name.trim(),
          description: description.trim(),
          permissions: selectedPermissions as unknown as Parameters<typeof updateCustomRoleAction>[0]['permissions'],
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
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred while saving.';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full my-auto shadow-xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {mode === 'create' ? 'Create Custom Role' : `Edit Role: ${role?.name}`}
              </h3>
              <p className="text-xs text-zinc-500">
                {mode === 'create'
                  ? `Step ${step} of 3 — ${step === 1 ? 'Role Details' : step === 2 ? 'Start From Template' : 'Fine-Tune Permissions & Scopes'}`
                  : 'Configure permission capabilities and access scope boundaries.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            key="close-modal-x"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl font-medium leading-none p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step Progress Indicator for Create Mode */}
        {mode === 'create' && (
          <div className="grid grid-cols-3 gap-2 px-6 pt-4 shrink-0">
            <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-zinc-950' : 'bg-zinc-100'}`} />
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
              <IconAlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: ROLE DETAILS */}
          {(mode === 'edit' || step === 1) && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Role Identity</h4>
                <p className="text-xs text-zinc-500">Name and describe the job role for your business.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (mode === 'create' && step === 1 && name.trim()) {
                          handleNextStep();
                        }
                      }
                    }}
                    placeholder="e.g. Senior Cashier"
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (mode === 'create' && step === 1 && name.trim()) {
                          handleNextStep();
                        }
                      }
                    }}
                    placeholder="e.g. Front-of-house lead cashier with refund authority"
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: START FROM TEMPLATE (Create Mode Only) */}
          {mode === 'create' && step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Choose a Starting Template</h4>
                <p className="text-xs text-zinc-500">
                  Select a ready-made template to prefill common permissions, or start empty to pick from scratch.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLE_PRESETS.map((preset) => {
                  const isSelected = selectedTemplate === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleTemplateSelect(preset.key)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-zinc-900">{preset.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {preset.permissions.length} perms
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2">{preset.description}</p>
                    </button>
                  );
                })}

                <button
                  type="button"
                  key="custom-scratch-template"
                  onClick={() => handleTemplateSelect('custom')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTemplate === 'custom'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600 shadow-xs'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-zinc-900">Start from Scratch</span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                      Custom
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">Pick every permission manually with an empty selection.</p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINE-TUNE PERMISSIONS & ADVANCED SCOPES */}
          {(mode === 'edit' || step === 3) && (
            <div className="space-y-6">
              {/* Permission Bundle Matrix */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">Fine-Tune Permissions</h4>
                    <p className="text-xs text-zinc-500">
                      Check or uncheck the specific features this custom role can access.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {selectedPermissions.length} permissions active
                  </span>
                </div>

                <PermissionMatrix
                  catalog={catalog}
                  selectedPermissions={selectedPermissions}
                  onChange={setSelectedPermissions}
                />
              </div>

              {/* ADVANCED ACCESS SETTINGS (COLLAPSIBLE PANEL) */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50">
                <button
                  type="button"
                  key="toggle-advanced-scopes"
                  onClick={() => setShowAdvancedScopes((prev) => !prev)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-zinc-100/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚙️</span>
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">Advanced Access Settings (Scopes & Ceilings)</span>
                      <span className="text-[11px] text-zinc-500">
                        Configure organizational boundaries, branch limits, or department reach. Default is Property / Branch.
                      </span>
                    </div>
                  </div>
                  {showAdvancedScopes ? (
                    <IconChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <IconChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </button>

                {showAdvancedScopes && (
                  <div className="p-4 bg-white border-t border-zinc-200 space-y-4 animate-in fade-in duration-150">
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div>
            {mode === 'create' && step > 1 && (
              <button
                type="button"
                key="back-step-btn"
                onClick={handlePrevStep}
                className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-xl cursor-pointer"
              >
                ← Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              key="cancel-modal-btn"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            {mode === 'create' && step < 3 ? (
              <button
                type="button"
                key={`next-step-${step}-btn`}
                disabled={step === 1 && !name.trim()}
                onClick={handleNextStep}
                className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                key="final-submit-save-btn"
                disabled={isSubmitting || !name.trim()}
                onClick={handleFinalSubmit}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <IconSparkles className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving Role...' : mode === 'create' ? 'Create Custom Role' : 'Save Role Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

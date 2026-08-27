'use client';

import React, { useState } from 'react';
import { BuiltInRoleTemplate } from '@/types/authorization.types';
import {
  IconShieldCheck,
  IconEye,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconUsers,
  IconMapPin,
  IconUserCheck,
  IconAlertTriangle,
  IconCopy,
} from './access-icons';
import { cloneRoleAction } from '@/server/actions/permission';
import { useRouter } from 'next/navigation';

interface BuiltInRolesViewProps {
  templates: BuiltInRoleTemplate[];
}

export const BuiltInRolesView: React.FC<BuiltInRolesViewProps> = ({ templates }) => {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<BuiltInRoleTemplate | null>(null);
  const [cloningTemplate, setCloningTemplate] = useState<BuiltInRoleTemplate | null>(null);

  // Form states for cloning
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenClone = (tmpl: BuiltInRoleTemplate) => {
    setCloningTemplate(tmpl);
    setCloneName(`${tmpl.displayName} Copy`);
    setCloneDescription(`Custom role cloned from built-in template ${tmpl.displayName}.`);
    setErrorMsg(null);
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloningTemplate) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await cloneRoleAction({
      sourceType: 'built_in',
      sourceRoleKey: cloningTemplate.roleKey,
      name: cloneName.trim(),
      description: cloneDescription.trim(),
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to clone role template.');
      return;
    }

    setCloningTemplate(null);
    if (res.data?.id) {
      router.push(`/dashboard/access/roles/${res.data.id}`);
    } else {
      router.refresh();
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'ORGANIZATION': return IconBuildingSkyscraper;
      case 'PROPERTY': return IconBuildingStore;
      case 'DEPARTMENT': return IconUsers;
      case 'AREA_TEAM': return IconMapPin;
      case 'SELF': return IconUserCheck;
      default: return IconBuildingStore;
    }
  };

  const formatScopeName = (scope: string) => {
    switch (scope) {
      case 'ORGANIZATION': return 'Organization Wide';
      case 'PROPERTY': return 'Property / Branch';
      case 'DEPARTMENT': return 'Department';
      case 'AREA_TEAM': return 'Service Area / Team';
      case 'SELF': return 'Self Only';
      default: return scope;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-950 flex items-start gap-2.5">
        <IconShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Ready-Made Built-in Roles:</span> Standard protected roles for common restaurant and hospitality staff jobs. You can view their details or clone them as custom roles to adapt to your venue.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tmpl) => {
          const ScopeIcon = getScopeIcon(tmpl.defaultScope);
          const isOwnerRole = tmpl.roleKey === 'business_owner';
          const permCount = (tmpl.permissions || []).length;

          return (
            <div
              key={tmpl.roleKey}
              className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs hover:border-zinc-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Badges & Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold font-mono bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded-md">
                    <IconShieldCheck className="w-3 h-3 text-emerald-600" />
                    Built-in Standard
                  </span>
                  {isOwnerRole && (
                    <span className="text-[10px] font-bold font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                      Owner Authority
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-zinc-900 mb-1">{tmpl.displayName}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4 min-h-[36px]">
                  {tmpl.description}
                </p>

                {/* Permissions & Scope Specs */}
                <div className="space-y-2 text-xs border-t border-zinc-100 pt-3 mb-4">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Access Scope:</span>
                    <span className="font-semibold text-zinc-900 flex items-center gap-1">
                      <ScopeIcon className="w-3.5 h-3.5 text-emerald-600" />
                      {formatScopeName(tmpl.defaultScope)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Permissions Included:</span>
                    <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                      {permCount} capabilities
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <IconEye className="w-3.5 h-3.5" /> View Details
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenClone(tmpl)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <IconCopy className="w-3.5 h-3.5" /> Clone Role
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Inspect Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-zinc-200 overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <IconShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">{selectedTemplate.displayName} Role Details</h3>
                  <p className="text-xs text-zinc-500 font-mono">System Key: {selectedTemplate.roleKey}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Description</span>
                <p className="text-sm text-zinc-700 mt-1">{selectedTemplate.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                <div>
                  <span className="text-zinc-500 block">Default Access Scope:</span>
                  <span className="font-bold text-zinc-900">{formatScopeName(selectedTemplate.defaultScope)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Max Scope Ceiling:</span>
                  <span className="font-bold text-zinc-900">{formatScopeName(selectedTemplate.maxScope)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Included Capabilities ({(selectedTemplate.permissions || []).length})
                  </span>
                </div>

                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 max-h-60 overflow-y-auto space-y-1.5 font-mono text-xs text-zinc-800">
                  {selectedTemplate.permissions && selectedTemplate.permissions.length > 0 ? (
                    selectedTemplate.permissions.map((p) => (
                      <div key={p} className="flex items-center gap-2 py-0.5">
                        <span className="text-emerald-600">✓</span>
                        <span>{p}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-400 italic">Owner authority covers all business permissions.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const tmpl = selectedTemplate;
                  setSelectedTemplate(null);
                  handleOpenClone(tmpl);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-2xs"
              >
                <IconCopy className="w-3.5 h-3.5" /> Clone as Custom Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Role Modal */}
      {cloningTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCloneSubmit}
            className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-zinc-200 overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconCopy className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Clone Role Template</h3>
                  <p className="text-xs text-zinc-500">
                    Cloning from built-in template: <strong className="text-zinc-800">{cloningTemplate.displayName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloningTemplate(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 font-medium">
                  <IconAlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                  New Custom Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g. Senior Cashier"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="Operational purpose of this cloned role..."
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-900">What gets copied?</div>
                <div>• All {(cloningTemplate.permissions || []).length} permissions from {cloningTemplate.displayName}</div>
                <div>• Default access scope: {formatScopeName(cloningTemplate.defaultScope)}</div>
                <div>• You can freely customize all permissions after cloning.</div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCloningTemplate(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !cloneName.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
              >
                <IconCopy className="w-3.5 h-3.5" />
                {isSubmitting ? 'Cloning Role...' : 'Create Cloned Role'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

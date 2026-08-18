'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createJobTitleAction, updateJobTitleAction } from '@/server/actions/organization';

interface JobTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    name: string;
    code?: string | null;
    hierarchy_level_id: string;
    department_type?: string | null;
    description?: string | null;
    is_management?: boolean;
    is_active?: boolean;
  } | null;
  hierarchyLevels: Array<{ id: string; name: string; rank: number; is_management: boolean }>;
}

function JobTitleModalForm({
  onClose,
  onSuccess,
  initialData,
  hierarchyLevels,
}: Omit<JobTitleModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [hierarchyLevelId, setHierarchyLevelId] = useState(
    initialData?.hierarchy_level_id || hierarchyLevels[0]?.id || ''
  );
  const [departmentType, setDepartmentType] = useState(initialData?.department_type || 'operations');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isManagement, setIsManagement] = useState(initialData?.is_management ?? false);
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && initialData) {
        const res = await updateJobTitleAction({
          id: initialData.id,
          name: name.trim(),
          code: code.trim() || undefined,
          hierarchyLevelId,
          departmentType: departmentType.trim() || undefined,
          description: description.trim() || undefined,
          isManagement,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to update job title.');
          return;
        }
      } else {
        const res = await createJobTitleAction({
          name: name.trim(),
          code: code.trim() || undefined,
          hierarchyLevelId,
          departmentType: departmentType.trim() || undefined,
          description: description.trim() || undefined,
          isManagement,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create job title.');
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">
              {isEditing ? 'Edit Job Title' : 'Create Job Title'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isEditing
                ? 'Update job role classification, rank, and management attributes'
                : 'Define a standardized enterprise job role'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-950/50 border border-red-800/80 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Job Title Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive Chef, General Manager, Line Cook"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Job Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. EXEC-CHEF, GM-01"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Seniority Rank Level <span className="text-red-400">*</span>
              </label>
              <select
                value={hierarchyLevelId}
                onChange={(e) => {
                  setHierarchyLevelId(e.target.value);
                  const selectedLvl = hierarchyLevels.find((h) => h.id === e.target.value);
                  if (selectedLvl && !isEditing) {
                    setIsManagement(selectedLvl.is_management);
                  }
                }}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {hierarchyLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    Rank {lvl.rank}: {lvl.name} {lvl.is_management ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Department Category
            </label>
            <select
              value={departmentType}
              onChange={(e) => setDepartmentType(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="operations">Operations & Front of House</option>
              <option value="culinary">Culinary & Kitchen</option>
              <option value="service">Food & Beverage Service</option>
              <option value="management">Executive & General Management</option>
              <option value="finance">Finance & Accounting</option>
              <option value="hr">Human Resources & Talent</option>
              <option value="logistics">Supply Chain & Inventory</option>
              <option value="other">Other Domain</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Role Description & Key Responsibilities
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline standard operational duties, qualifications, and oversight responsibilities..."
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="job_is_management"
                checked={isManagement}
                onChange={(e) => setIsManagement(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="job_is_management" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Management Tier Role
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="job_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="job_is_active" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Active Job Title
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Job Title'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function JobTitleModal(props: JobTitleModalProps) {
  if (!props.isOpen) return null;
  return <JobTitleModalForm key={props.initialData?.id || 'new'} {...props} />;
}

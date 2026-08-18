'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createDepartmentAction, updateDepartmentAction } from '@/server/actions/organization';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    name: string;
    code?: string | null;
    department_type?: string | null;
    branch_id?: string | null;
    parent_department_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  departments: Array<{ id: string; name: string; branch_id?: string | null }>;
  branches: Array<{ id: string; name: string }>;
}

function DepartmentModalForm({
  onClose,
  onSuccess,
  initialData,
  departments,
  branches,
}: Omit<DepartmentModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [departmentType, setDepartmentType] = useState(initialData?.department_type || 'operations');
  const [branchId, setBranchId] = useState<string>(initialData?.branch_id || 'corporate');
  const [parentDepartmentId, setParentDepartmentId] = useState<string>(initialData?.parent_department_id || '');
  const [sortOrder, setSortOrder] = useState(String(initialData?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadBranchId = branchId === 'corporate' ? null : branchId;
      const payloadParentId = parentDepartmentId || null;

      if (isEditing && initialData) {
        const res = await updateDepartmentAction({
          id: initialData.id,
          name: name.trim(),
          code: code.trim() || undefined,
          departmentType: departmentType.trim() || undefined,
          branchId: payloadBranchId,
          parentDepartmentId: payloadParentId,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to update department.');
          return;
        }
      } else {
        const res = await createDepartmentAction({
          name: name.trim(),
          code: code.trim() || undefined,
          departmentType: departmentType.trim() || undefined,
          branchId: payloadBranchId,
          parentDepartmentId: payloadParentId,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create department.');
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

  const availableParents = departments.filter((d) => !initialData || d.id !== initialData.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">
              {isEditing ? 'Edit Department' : 'Create Department'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isEditing
                ? 'Update corporate or property department details'
                : 'Define a new corporate division or branch department'}
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
          {/* Scope selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Organizational Scope <span className="text-red-400">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="corporate">Corporate / Head Office (Multi-Branch)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Property Specific: {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Department Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Food & Beverage, Culinary Arts, Front Office"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Department Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FNB, CUL, FO"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
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
                <option value="operations">Operations</option>
                <option value="culinary">Culinary & Kitchen</option>
                <option value="service">Food & Beverage Service</option>
                <option value="management">Executive & Management</option>
                <option value="finance">Finance & Accounting</option>
                <option value="hr">Human Resources</option>
                <option value="logistics">Supply & Logistics</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Parent Department (Optional Nesting)
            </label>
            <select
              value={parentDepartmentId}
              onChange={(e) => setParentDepartmentId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No Parent (Top-Level Division)</option>
              {availableParents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Display Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="dept_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="dept_is_active" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Active Department
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
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DepartmentModal(props: DepartmentModalProps) {
  if (!props.isOpen) return null;
  return <DepartmentModalForm key={props.initialData?.id || 'new'} {...props} />;
}

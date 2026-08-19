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
  activeBranchId?: string | null;
}

function DepartmentModalForm({
  onClose,
  onSuccess,
  initialData,
  departments,
  branches,
  activeBranchId,
}: Omit<DepartmentModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [departmentType, setDepartmentType] = useState(initialData?.department_type || 'operations');
  const [branchId, setBranchId] = useState<string>(
    initialData?.branch_id ?? activeBranchId ?? 'corporate'
  );
  const [parentDepartmentId, setParentDepartmentId] = useState<string>(initialData?.parent_department_id || '');
  const [sortOrder, setSortOrder] = useState(String(initialData?.sort_order ?? 0));
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter available parents based on the selected branch scope:
  // corporate  -> only corporate departments (branch_id IS NULL)
  // <uuid>     -> corporate departments + departments belonging to this specific branch
  const availableParents = departments.filter((d) => {
    if (initialData && d.id === initialData.id) return false;
    if (branchId === 'corporate') return !d.branch_id;
    return !d.branch_id || d.branch_id === branchId;
  });

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">
              {isEditing ? 'Edit Department' : 'Create Department'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isEditing
                ? 'Update corporate or property department details'
                : 'Define a new corporate division or branch department'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scope selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Organizational Scope <span className="text-red-500">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => {
                const newBranch = e.target.value;
                setBranchId(newBranch);
                // Clear parent department if it is not valid in the new branch scope
                const validInNewScope = departments.some((d) => {
                  if (initialData && d.id === initialData.id) return false;
                  if (newBranch === 'corporate') return !d.branch_id && d.id === parentDepartmentId;
                  return (!d.branch_id || d.branch_id === newBranch) && d.id === parentDepartmentId;
                });
                if (!validInNewScope) {
                  setParentDepartmentId('');
                }
              }}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Food & Beverage, Culinary Arts, Front Office"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Department Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FNB, CUL, FO"
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Department Category
              </label>
              <select
                value={departmentType}
                onChange={(e) => setDepartmentType(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Parent Department (Optional Nesting)
            </label>
            <select
              value={parentDepartmentId}
              onChange={(e) => setParentDepartmentId(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Display Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="dept_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <label htmlFor="dept_is_active" className="text-xs font-medium text-zinc-700 cursor-pointer">
                Active Department
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-sm"
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

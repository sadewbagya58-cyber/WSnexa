'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createOrganizationUnitAction, updateOrganizationUnitAction } from '@/server/actions/organization';

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    department_id: string;
    parent_unit_id?: string | null;
    unit_type: string;
    name: string;
    code?: string | null;
    branch_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  departments: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; department_id: string }>;
  branches: Array<{ id: string; name: string }>;
  defaultDepartmentId?: string;
}

function UnitModalForm({
  onClose,
  onSuccess,
  initialData,
  departments,
  units,
  branches,
  defaultDepartmentId,
}: Omit<UnitModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [unitType, setUnitType] = useState(initialData?.unit_type || 'section');
  const [departmentId, setDepartmentId] = useState(
    initialData?.department_id || defaultDepartmentId || departments[0]?.id || ''
  );
  const [parentUnitId, setParentUnitId] = useState(initialData?.parent_unit_id || '');
  const [branchId, setBranchId] = useState<string>(initialData?.branch_id || 'corporate');
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
      const payloadParentId = parentUnitId || null;

      if (isEditing && initialData) {
        const res = await updateOrganizationUnitAction({
          id: initialData.id,
          departmentId,
          parentUnitId: payloadParentId,
          branchId: payloadBranchId,
          unitType: unitType as 'team' | 'area' | 'section' | 'station' | 'outlet' | 'operational_unit' | 'other',
          name: name.trim(),
          code: code.trim() || undefined,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to update organization unit.');
          return;
        }
      } else {
        const res = await createOrganizationUnitAction({
          departmentId,
          parentUnitId: payloadParentId,
          branchId: payloadBranchId,
          unitType: unitType as 'team' | 'area' | 'section' | 'station' | 'outlet' | 'operational_unit' | 'other',
          name: name.trim(),
          code: code.trim() || undefined,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create organization unit.');
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

  const availableParents = units.filter(
    (u) => (!initialData || u.id !== initialData.id) && (!departmentId || u.department_id === departmentId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">
              {isEditing ? 'Edit Operational Unit' : 'Create Operational Unit'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isEditing
                ? 'Update subunit, station, or team parameters'
                : 'Define a sub-unit, kitchen station, or service team within a department'}
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
          {/* Department Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Parent Department <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setParentUnitId('');
              }}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>
                Select Department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scope selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Location Scope
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="corporate">Corporate / Inherited from Department</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Property: {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Unit / Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pastry Station, Grill Team, VIP Dining Service"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Unit Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. PST-01, GRL-TEAM"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Unit Type
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="section">Section</option>
                <option value="station">Station</option>
                <option value="team">Team</option>
                <option value="area">Area</option>
                <option value="outlet">Outlet</option>
                <option value="operational_unit">Operational Unit</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Parent Unit (Optional Nesting)
            </label>
            <select
              value={parentUnitId}
              onChange={(e) => setParentUnitId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No Parent Unit</option>
              {availableParents.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
                id="unit_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="unit_is_active" className="text-xs font-medium text-zinc-300 cursor-pointer">
                Active Unit
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
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UnitModal(props: UnitModalProps) {
  if (!props.isOpen) return null;
  return <UnitModalForm key={props.initialData?.id || 'new'} {...props} />;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">
              {isEditing ? 'Edit Operational Unit' : 'Create Operational Unit'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isEditing
                ? 'Update subunit, station, or team parameters'
                : 'Define a sub-unit, kitchen station, or service team within a department'}
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
          {/* Department Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Parent Department <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setParentUnitId('');
              }}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Location Scope
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Unit / Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pastry Station, Grill Team, VIP Dining Service"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Unit Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. PST-01, GRL-TEAM"
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Unit Type
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Parent Unit (Optional Nesting)
            </label>
            <select
              value={parentUnitId}
              onChange={(e) => setParentUnitId(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
                id="unit_is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <label htmlFor="unit_is_active" className="text-xs font-medium text-zinc-700 cursor-pointer">
                Active Unit
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

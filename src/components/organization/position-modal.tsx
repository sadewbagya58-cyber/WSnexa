'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createPositionAction, updatePositionAction } from '@/server/actions/organization';

interface PositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    job_title_id: string;
    branch_id?: string | null;
    department_id?: string | null;
    unit_id?: string | null;
    position_code?: string | null;
    name_override?: string | null;
    headcount_limit?: number;
    status?: 'active' | 'vacant' | 'frozen' | 'archived';
  } | null;
  jobTitles: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; branch_id?: string | null }>;
  units: Array<{ id: string; name: string; department_id: string; branch_id?: string | null }>;
  activeBranchId?: string | null;
}

function PositionModalForm({
  onClose,
  onSuccess,
  initialData,
  jobTitles,
  branches,
  departments,
  units,
  activeBranchId,
}: Omit<PositionModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [jobTitleId, setJobTitleId] = useState(
    initialData?.job_title_id || jobTitles[0]?.id || ''
  );
  const [branchId, setBranchId] = useState<string>(
    initialData?.branch_id ?? activeBranchId ?? 'corporate'
  );
  const [departmentId, setDepartmentId] = useState(
    initialData?.department_id || ''
  );
  const [unitId, setUnitId] = useState(
    initialData?.unit_id || ''
  );
  const [positionCode, setPositionCode] = useState(
    initialData?.position_code || ''
  );
  const [nameOverride, setNameOverride] = useState(
    initialData?.name_override || ''
  );
  const [headcountLimit, setHeadcountLimit] = useState(
    String(initialData?.headcount_limit ?? 1)
  );
  const [status, setStatus] = useState<'active' | 'vacant' | 'frozen' | 'archived'>(
    initialData?.status || 'active'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredDepartments = departments.filter((d) => {
    if (branchId === 'corporate') return !d.branch_id;
    return !d.branch_id || d.branch_id === branchId;
  });

  const filteredUnits = units.filter((u) => {
    if (departmentId && u.department_id !== departmentId) return false;
    if (branchId === 'corporate') return !u.branch_id;
    return !u.branch_id || u.branch_id === branchId;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadBranchId = branchId === 'corporate' ? null : branchId;
      const payloadDeptId = departmentId || null;
      const payloadUnitId = unitId || null;
      const limit = Number(headcountLimit) || 1;

      // Pre-submit consistency validation
      if (payloadUnitId) {
        const selectedUnit = units.find((u) => u.id === payloadUnitId);
        if (!selectedUnit) {
          setErrorMsg('Selected unit does not exist.');
          setIsSubmitting(false);
          return;
        }
        if (!payloadBranchId && selectedUnit.branch_id) {
          setErrorMsg('Cannot assign a property-scoped unit to a Corporate position.');
          setIsSubmitting(false);
          return;
        }
        if (payloadBranchId && selectedUnit.branch_id && selectedUnit.branch_id !== payloadBranchId) {
          setErrorMsg('Selected unit belongs to a different branch than the position placement.');
          setIsSubmitting(false);
          return;
        }
        if (payloadDeptId && selectedUnit.department_id !== payloadDeptId) {
          setErrorMsg('Selected unit does not belong to the selected department.');
          setIsSubmitting(false);
          return;
        }
      }

      if (payloadDeptId) {
        const selectedDept = departments.find((d) => d.id === payloadDeptId);
        if (!selectedDept) {
          setErrorMsg('Selected department does not exist.');
          setIsSubmitting(false);
          return;
        }
        if (!payloadBranchId && selectedDept.branch_id) {
          setErrorMsg('Cannot assign a property-scoped department to a Corporate position.');
          setIsSubmitting(false);
          return;
        }
        if (payloadBranchId && selectedDept.branch_id && selectedDept.branch_id !== payloadBranchId) {
          setErrorMsg('Selected department belongs to a different branch than the position placement.');
          setIsSubmitting(false);
          return;
        }
      }

      if (isEditing && initialData) {
        const res = await updatePositionAction({
          id: initialData.id,
          jobTitleId,
          branchId: payloadBranchId,
          departmentId: payloadDeptId,
          unitId: payloadUnitId,
          positionCode: positionCode.trim() || undefined,
          nameOverride: nameOverride.trim() || undefined,
          headcountLimit: limit,
          status,
          isActive: status === 'active',
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to update position.');
          return;
        }
      } else {
        const res = await createPositionAction({
          jobTitleId,
          branchId: payloadBranchId,
          departmentId: payloadDeptId,
          unitId: payloadUnitId,
          positionCode: positionCode.trim() || undefined,
          nameOverride: nameOverride.trim() || undefined,
          headcountLimit: limit,
          status,
          isActive: status === 'active',
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create position.');
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
      <div className="w-full max-w-xl rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">
              {isEditing ? 'Edit Position Slot' : 'Create Position Slot'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isEditing
                ? 'Update headcount capacity, organizational placement, and slot status'
                : 'Define a specific budgeted role slot in a branch, department, or unit'}
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
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Job Title <span className="text-red-500">*</span>
            </label>
            <select
              value={jobTitleId}
              onChange={(e) => setJobTitleId(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {jobTitles.map((jt) => (
                <option key={jt.id} value={jt.id}>
                  {jt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Location / Branch Placement <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  const newBranch = e.target.value;
                  setBranchId(newBranch);
                  const isDeptValid = departments.some((d) => {
                    if (newBranch === 'corporate') return !d.branch_id && d.id === departmentId;
                    return (!d.branch_id || d.branch_id === newBranch) && d.id === departmentId;
                  });
                  const updatedDept = isDeptValid ? departmentId : '';
                  if (!isDeptValid) setDepartmentId('');

                  const isUnitValid = units.some((u) => {
                    if (updatedDept && u.department_id !== updatedDept) return false;
                    if (newBranch === 'corporate') return !u.branch_id && u.id === unitId;
                    return (!u.branch_id || u.branch_id === newBranch) && u.id === unitId;
                  });
                  if (!isUnitValid) setUnitId('');
                }}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="corporate">Corporate / Head Office</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setDepartmentId(newDept);
                  const isUnitValid = units.some((u) => {
                    if (newDept && u.department_id !== newDept) return false;
                    if (branchId === 'corporate') return !u.branch_id && u.id === unitId;
                    return (!u.branch_id || u.branch_id === branchId) && u.id === unitId;
                  });
                  if (!isUnitValid) setUnitId('');
                }}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">No Department (Direct Branch Position)</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Unit / Station
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">No Unit Assigned</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Position Code (Optional)
              </label>
              <input
                type="text"
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value.toUpperCase())}
                placeholder="e.g. POS-EXEC-01"
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Custom Name Override (Optional)
            </label>
            <input
              type="text"
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              placeholder="e.g. Head of Pastry & Bakery Production"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Headcount Capacity Limit <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={headcountLimit}
                onChange={(e) => setHeadcountLimit(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <p className="text-[11px] text-zinc-500 mt-1">Maximum simultaneous substantive occupants.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Position Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'vacant' | 'frozen' | 'archived')}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="active">Active (Recruiting / Filled)</option>
                <option value="vacant">Vacant</option>
                <option value="frozen">Frozen</option>
                <option value="archived">Archived</option>
              </select>
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
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Position'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PositionModal(props: PositionModalProps) {
  if (!props.isOpen) return null;
  return <PositionModalForm key={props.initialData?.id || 'new'} {...props} />;
}

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
  units: Array<{ id: string; name: string; department_id: string }>;
}

function PositionModalForm({
  onClose,
  onSuccess,
  initialData,
  jobTitles,
  branches,
  departments,
  units,
}: Omit<PositionModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);

  const [jobTitleId, setJobTitleId] = useState(
    initialData?.job_title_id || jobTitles[0]?.id || ''
  );
  const [branchId, setBranchId] = useState<string>(
    initialData?.branch_id || 'corporate'
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

  const filteredUnits = units.filter((u) => !departmentId || u.department_id === departmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadBranchId = branchId === 'corporate' ? null : branchId;
      const payloadDeptId = departmentId || null;
      const payloadUnitId = unitId || null;
      const limit = Number(headcountLimit) || 1;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">
              {isEditing ? 'Edit Position Slot' : 'Create Position Slot'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isEditing
                ? 'Update headcount capacity, organizational placement, and slot status'
                : 'Define a specific budgeted role slot in a branch, department, or unit'}
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
              Job Title <span className="text-red-400">*</span>
            </label>
            <select
              value={jobTitleId}
              onChange={(e) => setJobTitleId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Location / Branch Placement <span className="text-red-400">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDepartmentId('');
                  setUnitId('');
                }}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setUnitId('');
                }}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Unit / Station
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Position Code (Optional)
              </label>
              <input
                type="text"
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value.toUpperCase())}
                placeholder="e.g. POS-EXEC-01"
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Custom Name Override (Optional)
            </label>
            <input
              type="text"
              value={nameOverride}
              onChange={(e) => setNameOverride(e.target.value)}
              placeholder="e.g. Head of Pastry & Bakery Production"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Headcount Capacity Limit <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={headcountLimit}
                onChange={(e) => setHeadcountLimit(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-zinc-500 mt-1">Maximum simultaneous substantive occupants.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Position Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'vacant' | 'frozen' | 'archived')}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">Active (Recruiting / Filled)</option>
                <option value="vacant">Vacant</option>
                <option value="frozen">Frozen</option>
                <option value="archived">Archived</option>
              </select>
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

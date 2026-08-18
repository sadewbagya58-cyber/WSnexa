'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createStaffAssignmentAction, createAdditionalAssignmentAction } from '@/server/actions/organization';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  membershipId: string;
  memberName: string;
  hasActivePrimary: boolean;
  jobTitles: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; position_code?: string; job_title_id: string; availableSlots?: number; isFull?: boolean }>;
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; department_id: string }>;
  potentialManagers: Array<{ id: string; fullName: string; title: string }>;
}

export function CreateAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  membershipId,
  memberName,
  hasActivePrimary,
  jobTitles,
  positions,
  branches,
  departments,
  units,
  potentialManagers,
}: CreateAssignmentModalProps) {
  const [assignmentType, setAssignmentType] = useState<'primary' | 'additional' | 'temporary'>(
    hasActivePrimary ? 'additional' : 'primary'
  );
  const [jobTitleId, setJobTitleId] = useState(jobTitles[0]?.id || '');
  const [positionId, setPositionId] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [departmentId, setDepartmentId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [reportsToAssignmentId, setReportsToAssignmentId] = useState('');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().split('T')[0]);
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredPositions = positions.filter((p) => !jobTitleId || p.job_title_id === jobTitleId);
  const filteredUnits = units.filter((u) => !departmentId || u.department_id === departmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const isPrimary = assignmentType === 'primary';
      const startsIso = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
      const endsIso = endsAt ? new Date(endsAt).toISOString() : undefined;

      if (isPrimary) {
        const res = await createStaffAssignmentAction({
          businessMembershipId: membershipId,
          jobTitleId,
          positionId: positionId || undefined,
          branchId: branchId || undefined,
          departmentId: departmentId || undefined,
          unitId: unitId || undefined,
          reportsToAssignmentId: reportsToAssignmentId || undefined,
          assignmentType: 'primary',
          isPrimary: true,
          status: 'active',
          startsAt: startsIso,
          endsAt: endsIso,
          reason: reason.trim() || undefined,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create primary assignment.');
          return;
        }
      } else {
        const res = await createAdditionalAssignmentAction({
          businessMembershipId: membershipId,
          jobTitleId,
          positionId: positionId || undefined,
          branchId: branchId || undefined,
          departmentId: departmentId || undefined,
          unitId: unitId || undefined,
          reportsToAssignmentId: reportsToAssignmentId || undefined,
          assignmentType: assignmentType === 'temporary' ? 'temporary' : 'additional',
          status: 'active',
          startsAt: startsIso,
          endsAt: endsIso,
          reason: reason.trim() || undefined,
        });

        if (!res.success) {
          setErrorMsg(res.message || 'Failed to create additional assignment.');
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">Create Staff Assignment</h3>
            <p className="text-xs text-zinc-400 mt-1">Assigning role to <span className="text-emerald-400 font-semibold">{memberName}</span></p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-950/50 border border-red-800/80 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Assignment Nature</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType('primary')}
                disabled={hasActivePrimary}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  assignmentType === 'primary'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                } ${hasActivePrimary ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Primary Role {hasActivePrimary ? '(Exists)' : ''}
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('additional')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  assignmentType === 'additional'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Additional
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('temporary')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  assignmentType === 'temporary'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Temporary Role
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Job Title <span className="text-red-400">*</span></label>
              <select
                value={jobTitleId}
                onChange={(e) => {
                  setJobTitleId(e.target.value);
                  setPositionId('');
                }}
                required
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {jobTitles.map((jt) => (
                  <option key={jt.id} value={jt.id}>{jt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Position Slot (Optional)</label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Position Slot</option>
                {filteredPositions.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.isFull}>
                    {p.position_code || p.id.slice(0, 8)} {p.isFull ? '(Full)' : `(${p.availableSlots ?? 1} slot avail)`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Branch / Property</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All / Multi-Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Department</label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setUnitId('');
                }}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Unit / Station</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={!departmentId || filteredUnits.length === 0}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">No Unit</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Reporting Manager</label>
              <select
                value={reportsToAssignmentId}
                onChange={(e) => setReportsToAssignmentId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Direct Manager (Top-level)</option>
                {potentialManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">End Date (Optional)</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Reason / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Initial onboard placement, station assignment"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              {isSubmitting ? 'Creating...' : 'Create Assignment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

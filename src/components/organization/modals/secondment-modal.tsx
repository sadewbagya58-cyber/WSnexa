'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSecondmentAction } from '@/server/actions/organization';

interface SecondmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceAssignment: {
    id: string;
    membershipId: string;
    memberName: string;
    jobTitleName: string;
    branchName?: string;
  };
  destinationBranches: Array<{ id: string; name: string }>;
  destinationDepartments: Array<{ id: string; name: string }>;
  destinationUnits: Array<{ id: string; name: string; department_id: string }>;
  jobTitles: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; position_code?: string; job_title_id: string; availableSlots?: number; isFull?: boolean }>;
  potentialManagers: Array<{ id: string; fullName: string; title: string }>;
}

export function SecondmentModal({
  isOpen,
  onClose,
  onSuccess,
  sourceAssignment,
  destinationBranches,
  destinationDepartments,
  destinationUnits,
  jobTitles,
  positions,
  potentialManagers,
}: SecondmentModalProps) {
  const [destinationBranchId, setDestinationBranchId] = useState(destinationBranches[0]?.id || '');
  const [jobTitleId, setJobTitleId] = useState(jobTitles[0]?.id || '');
  const [positionId, setPositionId] = useState('');
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
  const filteredUnits = destinationUnits.filter((u) => !departmentId || u.department_id === departmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const startsIso = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
      const endsIso = endsAt ? new Date(endsAt).toISOString() : undefined;

      const res = await createSecondmentAction({
        businessMembershipId: sourceAssignment.membershipId,
        sourceAssignmentId: sourceAssignment.id,
        branchId: destinationBranchId || undefined,
        departmentId: departmentId || undefined,
        unitId: unitId || undefined,
        positionId: positionId || undefined,
        jobTitleId,
        reportsToAssignmentId: reportsToAssignmentId || undefined,
        startsAt: startsIso,
        endsAt: endsIso,
        reason: reason.trim() || 'Cross-property secondment placement',
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to create secondment.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create secondment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-100">Cross-Property Secondment</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Seconding <span className="text-emerald-400 font-semibold">{sourceAssignment.memberName}</span> ({sourceAssignment.jobTitleName})
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-950/50 border border-red-800/80 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="rounded-xl bg-blue-950/40 border border-blue-800/60 p-3 text-xs text-blue-300/90 leading-relaxed">
          🏢 <strong>Home Property:</strong> {sourceAssignment.branchName || 'Corporate'} — Home primary assignment remains active.
          <br />
          ⚠️ <strong>Access Notice:</strong> Secondment establishes organizational placement at the destination property. Operational branch access (POS/Kitchen/Waiter) must be granted separately in Branch Assignments if system access is required.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Property <span className="text-red-400">*</span></label>
              <select
                value={destinationBranchId}
                onChange={(e) => setDestinationBranchId(e.target.value)}
                required
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {destinationBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Job Title <span className="text-red-400">*</span></label>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Department</label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setUnitId('');
                }}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Department</option>
                {destinationDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Unit</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Unit Assigned</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Position (Optional)</label>
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

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Destination Reporting Manager</label>
            <select
              value={reportsToAssignmentId}
              onChange={(e) => setReportsToAssignmentId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No Manager (Unassigned / Direct Top-level)</option>
              {potentialManagers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.title})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Secondment Start Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Secondment End Date</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Reason / Project Mandate</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Resort pre-opening taskforce, kitchen cross-training"
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              {isSubmitting ? 'Creating...' : 'Authorize Secondment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

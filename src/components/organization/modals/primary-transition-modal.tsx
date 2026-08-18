'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { transitionPrimaryAssignmentAction } from '@/server/actions/organization';

interface PrimaryTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAssignment: {
    id: string;
    job_title?: { name?: string } | null;
    position?: { position_code?: string } | null;
    branch?: { name?: string } | null;
    department?: { name?: string } | null;
    unit?: { name?: string } | null;
  };
  memberName: string;
  jobTitles: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; position_code?: string; job_title_id: string; availableSlots?: number; isFull?: boolean }>;
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; department_id: string }>;
  potentialManagers: Array<{ id: string; fullName: string; title: string }>;
}

export function PrimaryTransitionModal({
  isOpen,
  onClose,
  onSuccess,
  currentAssignment,
  memberName,
  jobTitles,
  positions,
  branches,
  departments,
  units,
  potentialManagers,
}: PrimaryTransitionModalProps) {
  const [transitionType, setTransitionType] = useState<'promotion' | 'transfer' | 'demotion'>('promotion');
  const [newJobTitleId, setNewJobTitleId] = useState(jobTitles[0]?.id || '');
  const [newPositionId, setNewPositionId] = useState('');
  const [newBranchId, setNewBranchId] = useState(branches[0]?.id || '');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newReportsToId, setNewReportsToId] = useState('');
  const [transitionTime, setTransitionTime] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredPositions = positions.filter((p) => !newJobTitleId || p.job_title_id === newJobTitleId);
  const filteredUnits = units.filter((u) => !newDepartmentId || u.department_id === newDepartmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const transIso = transitionTime ? new Date(transitionTime).toISOString() : new Date().toISOString();

      const res = await transitionPrimaryAssignmentAction({
        currentAssignmentId: currentAssignment.id,
        newJobTitleId: newJobTitleId || undefined,
        newPositionId: newPositionId || undefined,
        newBranchId: newBranchId || undefined,
        newDepartmentId: newDepartmentId || undefined,
        newUnitId: newUnitId || undefined,
        newReportsToId: newReportsToId || undefined,
        transitionType,
        transitionTime: transIso,
        reason: reason.trim() || `Staff ${transitionType}`,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to execute primary transition.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to execute primary transition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Primary Assignment Transition</h3>
            <p className="text-xs text-zinc-500 mt-1">Atomic promotion or lateral transfer for <span className="text-zinc-900 font-semibold">{memberName}</span></p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Current State Summary */}
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3.5 space-y-1 text-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Current Primary Role</span>
          <div className="text-zinc-900 font-semibold">{currentAssignment.job_title?.name || 'Position Holder'}</div>
          <div className="text-zinc-600">
            Branch: {currentAssignment.branch?.name || 'Corporate'} • Dept: {currentAssignment.department?.name || 'None'} {currentAssignment.unit?.name ? `• Unit: ${currentAssignment.unit.name}` : ''}
          </div>
          <div className="text-[11px] text-zinc-500 pt-1">
            Note: This operation will atomically end the current role and activate the target role preserving complete history.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Transition Nature</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTransitionType('promotion')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all shadow-xs ${
                  transitionType === 'promotion'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Promotion
              </button>
              <button
                type="button"
                onClick={() => setTransitionType('transfer')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all shadow-xs ${
                  transitionType === 'transfer'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Lateral Transfer
              </button>
              <button
                type="button"
                onClick={() => setTransitionType('demotion')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all shadow-xs ${
                  transitionType === 'demotion'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Reassignment
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Job Title <span className="text-red-500">*</span></label>
              <select
                value={newJobTitleId}
                onChange={(e) => {
                  setNewJobTitleId(e.target.value);
                  setNewPositionId('');
                }}
                required
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {jobTitles.map((jt) => (
                  <option key={jt.id} value={jt.id}>{jt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Position Slot (Optional)</label>
              <select
                value={newPositionId}
                onChange={(e) => setNewPositionId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Destination Branch</label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">All / Multi-Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Department</label>
              <select
                value={newDepartmentId}
                onChange={(e) => {
                  setNewDepartmentId(e.target.value);
                  setNewUnitId('');
                }}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Unit / Station</label>
              <select
                value={newUnitId}
                onChange={(e) => setNewUnitId(e.target.value)}
                disabled={!newDepartmentId || filteredUnits.length === 0}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50"
              >
                <option value="">No Unit</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Manager</label>
              <select
                value={newReportsToId}
                onChange={(e) => setNewReportsToId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">No Direct Manager (Top-level)</option>
                {potentialManagers.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName} ({m.title})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Effective Date</label>
              <input
                type="date"
                value={transitionTime}
                onChange={(e) => setTransitionTime(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Reason / Justification</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Annual promotion review, transfer to new wing"
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-sm">
              {isSubmitting ? 'Transitioning...' : `Execute ${transitionType.replace('_', ' ')}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

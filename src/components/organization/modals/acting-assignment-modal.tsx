'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createActingAssignmentAction } from '@/server/actions/organization';

interface ActingAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actingMembershipId: string;
  actingMemberName: string;
  assignmentsToCover: Array<{
    id: string;
    holderName: string;
    jobTitleName: string;
    branchName?: string;
    departmentName?: string;
  }>;
  positions: Array<{ id: string; position_code?: string; job_title_id: string; titleName?: string }>;
  absences?: Array<{ id: string; staffName: string; absenceType: string; startsAt: string; endsAt: string }>;
}

export function ActingAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  actingMembershipId,
  actingMemberName,
  assignmentsToCover,
  positions,
  absences = [],
}: ActingAssignmentModalProps) {
  const [targetAssignmentId, setTargetAssignmentId] = useState(assignmentsToCover[0]?.id || '');
  const [positionId, setPositionId] = useState('');
  const [coverageAbsenceId, setCoverageAbsenceId] = useState('');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().split('T')[0]);
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const startsIso = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
      const endsIso = endsAt ? new Date(endsAt).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();

      const res = await createActingAssignmentAction({
        businessMembershipId: actingMembershipId,
        actingForAssignmentId: targetAssignmentId,
        coverageAbsenceId: coverageAbsenceId || undefined,
        startsAt: startsIso,
        endsAt: endsIso,
        reason: reason.trim() || 'Temporary leadership coverage',
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to create acting assignment.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create acting assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Assign Acting Leadership Role</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Appoint <span className="text-zinc-900 font-semibold">{actingMemberName}</span> to cover a role temporarily
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600 leading-relaxed">
          <strong className="text-zinc-900 font-semibold">Acting Engine Guarantee:</strong> Substantive home assignment remains active. Position capacity is NOT consumed by acting roles. Effective reporting automatically re-routes through the acting leader and restores seamlessly upon conclusion.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Substantive Role Being Covered <span className="text-red-500">*</span>
            </label>
            <select
              value={targetAssignmentId}
              onChange={(e) => setTargetAssignmentId(e.target.value)}
              required
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {assignmentsToCover.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.holderName} — {a.jobTitleName} ({a.branchName || 'Corporate'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Target Position Slot (Optional)
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">Auto-inherit from Covered Role</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.position_code || p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Linked Absence (Optional)
              </label>
              <select
                value={coverageAbsenceId}
                onChange={(e) => setCoverageAbsenceId(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">No Linked Absence</option>
                {absences.map((ab) => (
                  <option key={ab.id} value={ab.id}>
                    {ab.staffName}: {ab.absenceType} ({ab.startsAt.split('T')[0]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Coverage Reason / Mandate</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. GM medical leave coverage, temporary operational delegation"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-sm">
              {isSubmitting ? 'Assigning...' : 'Confirm Acting Appointment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

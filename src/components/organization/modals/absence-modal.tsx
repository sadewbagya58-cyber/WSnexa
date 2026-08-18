'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createAssignmentAbsenceAction } from '@/server/actions/organization';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignmentId: string;
  memberName: string;
  jobTitleName: string;
}

export function AbsenceModal({
  isOpen,
  onClose,
  onSuccess,
  assignmentId,
  memberName,
  jobTitleName,
}: AbsenceModalProps) {
  const [absenceType, setAbsenceType] = useState<'leave' | 'medical_leave' | 'training' | 'travel' | 'suspension' | 'temporary_unavailability' | 'other'>('leave');
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
      const endsIso = endsAt ? new Date(endsAt).toISOString() : new Date(Date.now() + 86400000).toISOString();

      const res = await createAssignmentAbsenceAction({
        assignmentId,
        absenceType,
        startsAt: startsIso,
        endsAt: endsIso,
        reason: reason.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to record absence.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record absence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Record Staff Absence</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Log leave for <span className="text-zinc-900 font-semibold">{memberName}</span> ({jobTitleName})
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Absence Category <span className="text-red-500">*</span></label>
            <select
              value={absenceType}
              onChange={(e) =>
                setAbsenceType(
                  e.target.value as
                    | 'leave'
                    | 'medical_leave'
                    | 'training'
                    | 'travel'
                    | 'suspension'
                    | 'temporary_unavailability'
                    | 'other'
                )
              }
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="leave">Annual / Vacation Leave</option>
              <option value="medical_leave">Medical / Sick Leave</option>
              <option value="training">Training / Conference</option>
              <option value="travel">Official Travel</option>
              <option value="suspension">Administrative Suspension</option>
              <option value="temporary_unavailability">Temporary Unavailability</option>
              <option value="other">Other Absence</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Absence Starts <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Absence Ends</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Reason / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved medical leave with handover"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-sm">
              {isSubmitting ? 'Recording...' : 'Record Absence'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

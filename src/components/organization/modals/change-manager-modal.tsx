'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { setReportingManagerAction } from '@/server/actions/organization';

interface ChangeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assignmentId: string;
  memberName: string;
  currentManagerName?: string | null;
  potentialManagers: Array<{ id: string; fullName: string; title: string }>;
}

export function ChangeManagerModal({
  isOpen,
  onClose,
  onSuccess,
  assignmentId,
  memberName,
  currentManagerName,
  potentialManagers,
}: ChangeManagerModalProps) {
  const [newReportsToId, setNewReportsToId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await setReportingManagerAction({
        assignmentId,
        reportsToAssignmentId: newReportsToId || null,
        reason: reason.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to update reporting manager.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update reporting manager.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-white border border-zinc-200 p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Change Reporting Manager</h3>
            <p className="text-xs text-zinc-500 mt-1">Update direct supervisor for <span className="text-zinc-900 font-semibold">{memberName}</span></p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100">✕</button>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600">
          Current Reporting Manager:{' '}
          <span className="font-semibold text-zinc-900">
            {currentManagerName || 'None (Direct to Board / Unassigned)'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">New Reporting Manager</label>
            <select
              value={newReportsToId}
              onChange={(e) => setNewReportsToId(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">No Manager (Unset / Direct Top-level)</option>
              {potentialManagers
                .filter((m) => m.id !== assignmentId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.title})
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-zinc-500 mt-1">
              Backend traversal defense automatically rejects any selection that creates circular loops.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Effective Date</label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Reason / Justification</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Department reorganization, new team lead"
              className="w-full rounded-lg bg-white border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-sm">
              {isSubmitting ? 'Updating...' : 'Set Reporting Manager'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

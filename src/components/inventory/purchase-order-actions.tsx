'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { approvePurchaseOrderAction, cancelPurchaseOrderAction } from '@/server/actions/purchasing';

interface PurchaseOrderActionsProps {
  poId: string;
  poNumber: string;
  status: string;
  variant?: 'row' | 'detail';
}

export function PurchaseOrderActions({
  poId,
  poNumber,
  status,
  variant = 'row',
}: PurchaseOrderActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const canApprove = status === 'draft';
  const canCancel = status === 'draft' || status === 'approved';
  const canReceive = status === 'approved' || status === 'partially_received';

  const handleApprove = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await approvePurchaseOrderAction(poId);
      if (!res.success) {
        setActionError(res.message || 'Failed to approve purchase order.');
      } else {
        router.refresh();
      }
    });
  };

  const handleConfirmCancel = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await cancelPurchaseOrderAction({
        poId,
        reason: cancelReason.trim() || undefined,
      });

      if (!res.success) {
        setActionError(res.message || 'Failed to cancel purchase order.');
      } else {
        setShowCancelModal(false);
        setCancelReason('');
        router.refresh();
      }
    });
  };

  return (
    <>
      {variant === 'row' ? (
        <div className="inline-flex items-center gap-1.5 justify-end">
          {actionError && (
            <span className="text-[10px] font-semibold text-rose-600 mr-1 max-w-[120px] truncate" title={actionError}>
              {actionError}
            </span>
          )}

          {canApprove && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isPending}
              className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white h-7 px-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {isPending ? 'Approving…' : 'Approve'}
            </Button>
          )}

          {canReceive && (
            <Link
              href="/dashboard/inventory/receiving"
              className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
            >
              Receive
            </Link>
          )}

          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActionError(null);
                setShowCancelModal(true);
              }}
              disabled={isPending}
              className="text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 h-7 px-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </Button>
          )}

          {!canApprove && !canReceive && !canCancel && (
            <span className="text-zinc-400 text-[11px] italic capitalize">
              {status === 'cancelled' ? 'Cancelled' : 'Completed'}
            </span>
          )}
        </div>
      ) : (
        /* Detail Page Variant */
        <div className="flex flex-wrap items-center gap-2">
          {actionError && (
            <div className="w-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 mb-1">
              {actionError}
            </div>
          )}

          {canApprove && (
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white transition shadow-xs cursor-pointer"
            >
              {isPending ? 'Approving…' : 'Approve Purchase Order'}
            </Button>
          )}

          {canReceive && (
            <Link
              href="/dashboard/inventory/receiving"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
            >
              Receive Deliveries (GRN)
            </Link>
          )}

          {canCancel && (
            <Button
              variant="outline"
              onClick={() => {
                setActionError(null);
                setShowCancelModal(true);
              }}
              disabled={isPending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 transition cursor-pointer"
            >
              Cancel Purchase Order
            </Button>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-base">
                  ⚠️
                </div>
                <div>
                  <h2 id="cancel-dialog-title" className="text-base font-bold text-zinc-950">
                    Cancel Purchase Order
                  </h2>
                  <p className="text-xs font-mono font-bold text-zinc-600">{poNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isPending) setShowCancelModal(false);
                }}
                disabled={isPending}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {actionError}
                </div>
              )}

              <p className="text-xs text-zinc-600 leading-relaxed">
                Are you sure you want to cancel purchase order <strong className="text-zinc-900 font-mono">{poNumber}</strong>?
                This action will mark the status as <span className="font-bold text-rose-700 uppercase">Cancelled</span>.
                Cancelled orders cannot be approved or used for goods receipt, but will remain recorded for auditing.
              </p>

              <div>
                <label htmlFor="cancel-reason" className="block text-xs font-bold text-zinc-700 mb-1">
                  Reason for Cancellation <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Supplier out of stock, duplicated request, price revised..."
                  disabled={isPending}
                  className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 focus:outline-hidden disabled:opacity-60 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                disabled={isPending}
                className="text-xs font-medium text-zinc-700 h-9 rounded-xl px-4 cursor-pointer"
              >
                Keep Order
              </Button>
              <Button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isPending}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-9 rounded-xl px-4 shadow-xs transition-colors cursor-pointer"
              >
                {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

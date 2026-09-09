'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  cancelOrderAsCustomerAction,
  evaluateCustomerCancellationAction,
} from '@/server/actions/order-cancellation';
import { CustomerPolicyEvaluation } from '@/server/services/cancellation.service';

interface CustomerCancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumberFormatted: string;
  guestAccessToken?: string;
  isPaid?: boolean;
  onCancelled: () => void;
}

const REASON_OPTIONS = [
  { value: 'ordered_by_mistake', label: 'Ordered by mistake / wrong items' },
  { value: 'change_of_mind', label: 'Changed my mind' },
  { value: 'wait_time_too_long', label: 'Wait time is too long' },
  { value: 'duplicate_order', label: 'Accidental duplicate order' },
  { value: 'other', label: 'Other reason' },
];

export function CustomerCancelOrderModal({
  isOpen,
  onClose,
  orderId,
  orderNumberFormatted,
  guestAccessToken,
  isPaid,
  onCancelled,
}: CustomerCancelOrderModalProps) {
  const [reasonCategory, setReasonCategory] = useState(REASON_OPTIONS[0].value);
  const [reasonNotes, setReasonNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<CustomerPolicyEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen && orderId) {
      setIsEvaluating(true);
      setErrorMessage(null);
      evaluateCustomerCancellationAction(orderId, guestAccessToken).then((res) => {
        setIsEvaluating(false);
        if (res.data) {
          setEvaluation(res.data);
          if (!res.data.canCancel) {
            setErrorMessage(res.data.reason || 'Cancellation is not permitted for this order.');
          }
        }
      });
    }
  }, [isOpen, orderId, guestAccessToken]);

  if (!isOpen) return null;

  const handleConfirmCancel = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await cancelOrderAsCustomerAction({
        orderId,
        reasonCategory,
        reasonNotes: reasonNotes.trim() || undefined,
        guestAccessToken,
      });

      if (res.success) {
        onCancelled();
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to cancel order.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-100 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              Cancel Order
            </span>
            <h3 className="text-lg font-black text-zinc-950 mt-2">
              Cancel {orderNumberFormatted}?
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {isEvaluating ? (
          <div className="py-6 text-center text-sm font-medium text-zinc-500 animate-pulse">
            Checking venue cancellation policy...
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="rounded-xl p-3 text-xs font-bold border border-red-200 bg-red-50 text-red-900">
                {errorMessage}
              </div>
            )}

            {evaluation && evaluation.canCancel && (
              <div className="space-y-4">
                {evaluation.policy === 'within_time_limit' && evaluation.timeRemainingSeconds !== undefined && (
                  <div className="rounded-xl p-3 text-xs font-bold border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2">
                    <span>⏱️</span>
                    <span>
                      Window expires in {Math.floor(evaluation.timeRemainingSeconds / 60)}m {evaluation.timeRemainingSeconds % 60}s
                    </span>
                  </div>
                )}

                {isPaid && (
                  <div className="rounded-xl p-3 text-xs font-medium border border-blue-200 bg-blue-50 text-blue-900">
                    ℹ️ You have already made a payment for this order. Upon cancellation, your order will be flagged for refund review with the cashier.
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Reason for cancellation:
                  </label>
                  <select
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    disabled={isPending}
                  >
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">
                    Additional notes (optional):
                  </label>
                  <textarea
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
                    placeholder="Tell the staff more details..."
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                variant="outline"
                className="text-xs font-bold"
                onClick={onClose}
                disabled={isPending}
              >
                Keep Order
              </Button>
              {evaluation?.canCancel && (
                <Button
                  variant="destructive"
                  className="text-xs font-bold bg-red-600 hover:bg-red-700 min-w-[120px]"
                  onClick={handleConfirmCancel}
                  disabled={isPending}
                >
                  {isPending ? 'Cancelling...' : 'Confirm Cancel'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

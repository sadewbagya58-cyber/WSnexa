'use client';

import React, { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { recordOrderPaymentAction, recordOrderRefundAction } from '@/server/actions/payment';
import { CashierOrderRecord } from '@/server/services/payment.service';
import { PaymentMethod } from '@/lib/validation/payment';

export interface PaymentSuccessData {
  orderId: string;
  paidCents: number;
  balanceDueCents: number;
  paymentStatus: string;
}

interface PaymentSettlementModalProps {
  order: CashierOrderRecord;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data?: PaymentSuccessData) => void;
  mode?: 'payment' | 'refund';
}

export const PaymentSettlementModal: React.FC<PaymentSettlementModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
  mode,
}) => {
  const isRefundMode = mode === 'refund' || order.status === 'cancelled' || order.refund_eligibility === 'eligible';

  const refundableCents =
    order.refundable_amount_cents !== undefined
      ? order.refundable_amount_cents
      : Math.max(0, (order.paid_cents || 0) - (order.refunded_cents || 0));

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountInput, setAmountInput] = useState<string>(() => {
    if (isRefundMode) {
      return (refundableCents / 100).toFixed(2);
    }
    return (order.balance_due_cents / 100).toFixed(2);
  });
  const [externalReference, setExternalReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const amountInputId = useId();
  const externalRefId = useId();
  const notesId = useId();

  if (!isOpen) return null;

  const handlePayFullBalance = () => {
    if (isSubmitting || isSuccess) return;
    if (isRefundMode) {
      setAmountInput((refundableCents / 100).toFixed(2));
    } else {
      setAmountInput((order.balance_due_cents / 100).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSuccess) return;

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage(
        isRefundMode
          ? 'Please enter a valid refund amount greater than 0.'
          : 'Please enter a valid payment amount greater than 0.'
      );
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);

    if (isRefundMode) {
      if (refundableCents <= 0) {
        setErrorMessage('No refundable amount remaining for this order.');
        return;
      }
      if (amountCents > refundableCents) {
        setErrorMessage(
          `Refund amount exceeds refundable balance. Maximum refundable is ${formatCurrency(
            refundableCents,
            order.currency
          )}.`
        );
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        const idempotencyKey = `ref_${order.id}_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}`;

        const res = await recordOrderRefundAction({
          orderId: order.id,
          amountCents,
          refundMethod: paymentMethod,
          reason: notes.trim() || 'Cashier processed refund',
          notes: notes.trim() || null,
          idempotencyKey,
        });

        if (!res.success) {
          setErrorMessage(res.message || 'Refund processing failed.');
          setIsSubmitting(false);
          return;
        }

        if (res.data) {
          onSuccess({
            orderId: order.id,
            paidCents: (order.paid_cents || 0) - res.data.refundedCents,
            balanceDueCents: order.balance_due_cents,
            paymentStatus: res.data.paymentStatus,
          });
        } else {
          onSuccess();
        }

        setIsSuccess(true);
        setIsSubmitting(false);
        setTimeout(() => {
          onClose();
        }, 500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unexpected refund processing error.';
        setErrorMessage(msg);
        setIsSubmitting(false);
      }
      return;
    }

    // Payment Settlement Mode
    if (amountCents > order.balance_due_cents) {
      setErrorMessage(
        `Amount exceeds remaining balance. Maximum payable is ${formatCurrency(
          order.balance_due_cents,
          order.currency
        )}.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const idempotencyKey = `pay_${order.id}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;

      const res = await recordOrderPaymentAction({
        orderId: order.id,
        amountCents,
        paymentMethod,
        externalReference: externalReference.trim() || null,
        notes: notes.trim() || null,
        idempotencyKey,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Payment settlement failed.');
        setIsSubmitting(false);
        return;
      }

      if (res.data) {
        onSuccess({
          orderId: order.id,
          paidCents: res.data.paidCents,
          balanceDueCents: res.data.balanceDueCents,
          paymentStatus: res.data.paymentStatus,
        });
      } else {
        onSuccess();
      }

      setIsSuccess(true);
      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected payment settlement error.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isRefundMode ? 'text-rose-600' : 'text-zinc-500'
              }`}
            >
              {isRefundMode ? '↩️ Process Order Refund' : 'Payment Settlement'}
            </span>
            <h2 className="text-lg font-black text-zinc-950">
              Order {order.order_number_formatted}
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            ✕
          </Button>
        </div>

        {/* Balance Breakdown Summary Card */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 text-xs font-bold text-zinc-900">
          <div className="flex justify-between">
            <span className="text-zinc-600">Order Total:</span>
            <span>{formatCurrency(order.total_cents, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Total Paid:</span>
            <span className="text-emerald-700">{formatCurrency(order.paid_cents, order.currency)}</span>
          </div>
          {isRefundMode ? (
            <>
              {(order.refunded_cents || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Already Refunded:</span>
                  <span className="text-rose-600">
                    {formatCurrency(order.refunded_cents || 0, order.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm text-zinc-950 font-black">
                <span>Authoritative Refundable:</span>
                <span className="text-rose-700 font-mono">
                  {formatCurrency(refundableCents, order.currency)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm text-zinc-950 font-black">
              <span>Remaining Balance Due:</span>
              <span className="text-amber-800 font-mono">
                {formatCurrency(order.balance_due_cents, order.currency)}
              </span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
            ⚠️ {errorMessage}
          </div>
        )}

        {isRefundMode && refundableCents <= 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-center space-y-1.5">
            <div className="text-xs font-extrabold text-zinc-800">No Refundable Amount Remaining</div>
            <p className="text-[11px] text-zinc-500">
              This order has no remaining refundable balance. Either no payments were captured or the order has already been fully refunded.
            </p>
          </div>
        ) : (
          /* Form Input Fields */
          <div className="space-y-4">
            {/* Payment / Refund Method Selector */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                {isRefundMode ? 'Refund Method *' : 'Payment Method *'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: '💵 Cash' },
                  { id: 'card', label: '💳 Terminal Card' },
                  { id: 'qr_pay', label: '📱 External QR' },
                  { id: 'pay_at_counter', label: '🏪 Pay Counter' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isSubmitting || isSuccess}
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`rounded-xl p-3 text-xs font-bold border transition-all text-center min-h-[44px] touch-manipulation active:scale-[0.98] disabled:opacity-60 ${
                      paymentMethod === m.id
                        ? isRefundMode
                          ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                          : 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                        : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={amountInputId} className="block text-xs font-bold text-zinc-700">
                  {isRefundMode ? 'Refund Amount' : 'Payment Amount'} ({order.currency}) *
                </label>
                <button
                  type="button"
                  onClick={handlePayFullBalance}
                  disabled={isSubmitting || isSuccess}
                  className={`text-[11px] font-extrabold hover:underline disabled:opacity-50 ${
                    isRefundMode ? 'text-rose-600' : 'text-indigo-600'
                  }`}
                >
                  {isRefundMode ? 'Refund Full Amount' : 'Pay Full Balance'}
                </button>
              </div>
              <input
                id={amountInputId}
                type="number"
                step="0.01"
                min="0.01"
                max={
                  isRefundMode
                    ? (refundableCents / 100).toFixed(2)
                    : (order.balance_due_cents / 100).toFixed(2)
                }
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={isSubmitting || isSuccess}
                required
                className="w-full font-mono text-xl font-bold text-center rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
              />
            </div>

            {/* External Reference (Terminal Txn ID) */}
            {(paymentMethod === 'card' || paymentMethod === 'qr_pay') && (
              <div>
                <label htmlFor={externalRefId} className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Terminal Reference / Txn ID (Optional)
                </label>
                <input
                  id={externalRefId}
                  type="text"
                  maxLength={100}
                  placeholder="e.g. TXN-998182"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  disabled={isSubmitting || isSuccess}
                  className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor={notesId} className="block text-xs font-bold text-zinc-700 mb-1.5">
                {isRefundMode ? 'Refund Reason / Notes (Optional)' : 'Notes (Optional)'}
              </label>
              <input
                id={notesId}
                type="text"
                maxLength={200}
                placeholder={
                  isRefundMode
                    ? 'e.g. Order cancelled, refund issued to customer'
                    : 'e.g. Customer requested split payment'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting || isSuccess}
                className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[44px] touch-manipulation active:scale-[0.98] transition-all"
            onClick={onClose}
            disabled={isSubmitting || isSuccess}
          >
            Cancel
          </Button>
          {isRefundMode && refundableCents <= 0 ? (
            <Button
              type="button"
              disabled
              className="flex-1 font-bold bg-zinc-200 text-zinc-500 min-h-[44px] cursor-not-allowed"
            >
              No Refundable Balance
            </Button>
          ) : (
            <Button
              type="submit"
              className={`flex-1 font-bold text-white min-h-[44px] touch-manipulation active:scale-[0.98] transition-all shadow-xs ${
                isRefundMode ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zinc-950 hover:bg-zinc-800'
              }`}
              disabled={isSubmitting || isSuccess}
              aria-busy={isSubmitting}
            >
              {isSuccess ? (
                <span className="flex items-center justify-center gap-1 text-emerald-400 font-black">
                  <span>✓</span>
                  <span>{isRefundMode ? 'Refund Processed!' : 'Payment Recorded!'}</span>
                </span>
              ) : isSubmitting ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="animate-spin inline-block">⏳</span>
                  <span>{isRefundMode ? 'Processing Refund...' : 'Recording Payment...'}</span>
                </span>
              ) : isRefundMode ? (
                `Confirm Refund (${formatCurrency(
                  Math.round((parseFloat(amountInput) || 0) * 100),
                  order.currency
                )})`
              ) : (
                'Confirm Payment'
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

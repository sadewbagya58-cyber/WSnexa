'use client';

import React, { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { recordOrderPaymentAction } from '@/server/actions/payment';
import { CashierOrderRecord } from '@/server/services/payment.service';
import { PaymentMethod } from '@/lib/validation/payment';

interface PaymentSettlementModalProps {
  order: CashierOrderRecord;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentSettlementModal: React.FC<PaymentSettlementModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountInput, setAmountInput] = useState<string>(
    (order.balance_due_cents / 100).toFixed(2)
  );
  const [externalReference, setExternalReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const amountInputId = useId();
  const externalRefId = useId();
  const notesId = useId();

  if (!isOpen) return null;

  const handlePayFullBalance = () => {
    setAmountInput((order.balance_due_cents / 100).toFixed(2));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than 0.');
      return;
    }

    const amountCents = Math.round(parsedAmount * 100);

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

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected payment settlement error.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <form
        onSubmit={handleSubmitPayment}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Payment Settlement
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
            <span className="text-zinc-600">Already Paid:</span>
            <span className="text-emerald-700">{formatCurrency(order.paid_cents, order.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm text-zinc-950 font-black">
            <span>Remaining Balance Due:</span>
            <span className="text-amber-800 font-mono">
              {formatCurrency(order.balance_due_cents, order.currency)}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Form Input Fields */}
        <div className="space-y-4">
          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Payment Method *
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
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`rounded-xl p-3 text-xs font-bold border transition-all text-center ${
                    paymentMethod === m.id
                      ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                      : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={amountInputId} className="block text-xs font-bold text-zinc-700">
                Payment Amount ({order.currency}) *
              </label>
              <button
                type="button"
                onClick={handlePayFullBalance}
                className="text-[11px] font-extrabold text-indigo-600 hover:underline"
              >
                Pay Full Balance
              </button>
            </div>
            <input
              id={amountInputId}
              type="number"
              step="0.01"
              min="0.01"
              max={(order.balance_due_cents / 100).toFixed(2)}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
              className="w-full font-mono text-xl font-bold text-center rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none"
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
                className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor={notesId} className="block text-xs font-bold text-zinc-700 mb-1.5">
              Notes (Optional)
            </label>
            <input
              id={notesId}
              type="text"
              maxLength={200}
              placeholder="e.g. Customer requested split payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2 border-t border-zinc-100">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 font-bold bg-zinc-950 hover:bg-zinc-800 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </div>
      </form>
    </div>
  );
};

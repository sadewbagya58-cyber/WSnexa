'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  cancelOrderAsStaffAction,
  requestCancellationApprovalAction,
} from '@/server/actions/order-cancellation';
import {
  CancellationChannel,
  InventoryDisposition,
} from '@/server/services/cancellation.service';

interface StaffCancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumberFormatted: string;
  channel: CancellationChannel;
  currentStatus: string;
  isPaid?: boolean;
  totalCents?: number;
  currency?: string;
  onSuccess?: () => void;
}

const REASON_CATEGORIES = [
  { value: 'customer_change_of_mind', label: 'Customer Changed Mind' },
  { value: 'customer_walkout', label: 'Customer Walkout / Left Venue' },
  { value: 'kitchen_mistake', label: 'Kitchen / Preparation Mistake' },
  { value: 'out_of_stock', label: 'Ingredient Out of Stock' },
  { value: 'duplicate_entry', label: 'Accidental Duplicate Ticket' },
  { value: 'wrong_table', label: 'Fired to Wrong Table' },
  { value: 'other', label: 'Other Operational Reason' },
];

export function StaffCancelOrderModal({
  isOpen,
  onClose,
  orderId,
  orderNumberFormatted,
  channel,
  currentStatus,
  isPaid,
  totalCents,
  currency = 'USD',
  onSuccess,
}: StaffCancelOrderModalProps) {
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0].value);
  const [reasonNotes, setReasonNotes] = useState('');
  const [disposition, setDisposition] = useState<InventoryDisposition>(
    currentStatus === 'preparing' || currentStatus === 'ready' ? 'record_waste' : 'return_to_stock'
  );
  const [needsApproval, setNeedsApproval] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleCancel = () => {
    setErrorMessage(null);
    startTransition(async () => {
      if (needsApproval) {
        const reqRes = await requestCancellationApprovalAction({
          orderId,
          channel,
          reasonCategory,
          reasonNotes: reasonNotes.trim() || undefined,
        });

        if (reqRes.success) {
          onSuccess?.();
          onClose();
        } else {
          setErrorMessage(reqRes.message || 'Failed to submit approval request.');
        }
        return;
      }

      const res = await cancelOrderAsStaffAction({
        orderId,
        channel,
        reasonCategory,
        reasonNotes: reasonNotes.trim() || undefined,
        inventoryDisposition: disposition,
      });

      if (res.success) {
        onSuccess?.();
        onClose();
      } else if (res.code === 'REQUIRES_APPROVAL') {
        setNeedsApproval(true);
        setErrorMessage('This order is already being prepared. Manager approval is required.');
      } else {
        setErrorMessage(res.message || 'Failed to cancel order.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              Staff Order Cancellation
            </span>
            <h3 className="text-lg font-black text-zinc-950 mt-2">
              {needsApproval ? `Request Approval for ${orderNumberFormatted}` : `Cancel ${orderNumberFormatted}?`}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Current Stage: <span className="font-semibold text-zinc-700 capitalize">{currentStatus}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl p-3 text-xs font-bold border border-red-200 bg-red-50 text-red-900">
            {errorMessage}
          </div>
        )}

        {isPaid && (
          <div className="rounded-xl p-3 text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2">
            <span>💳</span>
            <span>
              Order has recorded payment. Upon cancellation, this order will be flagged as <strong>Refund Eligible</strong> for the cashier.
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Cancellation Reason:</label>
            <select
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              disabled={isPending}
            >
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Detailed Notes / Staff Reason:</label>
            <textarea
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
              placeholder="e.g., Table 4 requested cancellation before cooking..."
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          {!needsApproval && (
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-xs font-bold text-zinc-700">Inventory Stock Disposition:</label>
              {(currentStatus === 'preparing' || currentStatus === 'ready') && (
                <div className="rounded-xl p-2.5 text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>
                    Food is already preparing/ready. Cooked items cannot return to raw stock and must be logged as kitchen waste (<code>prep_waste</code>).
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={currentStatus === 'preparing' || currentStatus === 'ready'}
                  onClick={() => setDisposition('return_to_stock')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    currentStatus === 'preparing' || currentStatus === 'ready'
                      ? 'opacity-40 cursor-not-allowed border-zinc-200 bg-zinc-100'
                      : disposition === 'return_to_stock'
                      ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 cursor-pointer'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 cursor-pointer'
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                    <span>📦</span> Return
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                    {currentStatus === 'preparing' || currentStatus === 'ready' ? 'Unavailable (Cooked)' : 'Uncooked ingredients returned to stock'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDisposition('record_waste')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    disposition === 'record_waste'
                      ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                    <span>🗑️</span> Waste
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                    Food already cooked / prepared
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDisposition('none')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    disposition === 'none'
                      ? 'border-zinc-700 bg-zinc-100 ring-2 ring-zinc-700/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                  }`}
                >
                  <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                    <span>🚫</span> None
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                    No inventory movement
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
          <Button
            variant="outline"
            className="text-xs font-bold"
            onClick={onClose}
            disabled={isPending}
          >
            Keep Order
          </Button>

          <Button
            variant="destructive"
            className="text-xs font-bold bg-red-600 hover:bg-red-700 min-w-[130px]"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending
              ? 'Processing...'
              : needsApproval
              ? 'Submit Request'
              : 'Cancel Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}

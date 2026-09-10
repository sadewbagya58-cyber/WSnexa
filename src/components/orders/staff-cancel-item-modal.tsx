'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelOrderItemAsStaffAction } from '@/server/actions/order-cancellation';
import {
  CancellationChannel,
  InventoryDisposition,
} from '@/server/services/cancellation.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface StaffCancelItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderItemId: string;
  itemName: string;
  unitPriceCents: number;
  quantity: number;
  cancelledQuantity: number;
  channel: CancellationChannel;
  currentStatus?: string;
  currency?: string;
  onSuccess?: () => void;
}

const REASON_CATEGORIES = [
  { value: 'customer_request', label: 'Customer Requested Item Removal' },
  { value: 'kitchen_mistake', label: 'Item Sent by Mistake' },
  { value: 'ingredient_unavailable', label: 'Ingredient Out of Stock' },
  { value: 'quality_issue', label: 'Defective / Quality Issue' },
  { value: 'other', label: 'Other' },
];

export function StaffCancelItemModal({
  isOpen,
  onClose,
  orderId,
  orderItemId,
  itemName,
  unitPriceCents,
  quantity,
  cancelledQuantity,
  channel,
  currentStatus,
  currency = 'USD',
  onSuccess,
}: StaffCancelItemModalProps) {
  const remainingQty = quantity - (cancelledQuantity || 0);
  const [qtyToCancel, setQtyToCancel] = useState(1);
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0].value);
  const [reasonNotes, setReasonNotes] = useState('');
  const [disposition, setDisposition] = useState<InventoryDisposition>(
    currentStatus === 'preparing' || currentStatus === 'ready' ? 'record_waste' : 'return_to_stock'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleConfirmCancel = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await cancelOrderItemAsStaffAction({
        orderId,
        orderItemId,
        cancelledQuantity: qtyToCancel,
        channel,
        reasonCategory,
        reasonNotes: reasonNotes.trim() || undefined,
        inventoryDisposition: disposition,
      });

      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setErrorMessage(res.message || 'Failed to cancel item.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              Item Adjustment
            </span>
            <h3 className="text-lg font-black text-zinc-950 mt-2">
              Cancel Item: {itemName}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Current Active: <span className="font-bold text-zinc-800">{remainingQty} of {quantity}</span>
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

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Quantity to cancel:</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={remainingQty}
                value={qtyToCancel}
                onChange={(e) => setQtyToCancel(Number(e.target.value))}
                disabled={isPending}
                className="flex-1 accent-red-600 cursor-pointer"
              />
              <span className="text-base font-black text-zinc-900 font-mono w-10 text-center bg-zinc-100 py-1 rounded-lg">
                {qtyToCancel}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 text-right">
              Refund / Deduct: {formatCurrency(qtyToCancel * unitPriceCents, currency)}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Reason:</label>
            <select
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              disabled={isPending}
            >
              {REASON_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Notes (optional):</label>
            <textarea
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-colors"
              placeholder="e.g., Customer allergic, ordered wrong variant..."
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <label className="text-xs font-bold text-zinc-700">Ingredient Stock Disposition:</label>
            {(currentStatus === 'preparing' || currentStatus === 'ready') && (
              <div className="rounded-xl p-2.5 text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>
                  Food is already preparing/ready. Cooked items cannot return to raw stock and will be logged as kitchen waste (<code>prep_waste</code>).
                </span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={currentStatus === 'preparing' || currentStatus === 'ready'}
                onClick={() => setDisposition('return_to_stock')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  currentStatus === 'preparing' || currentStatus === 'ready'
                    ? 'opacity-40 cursor-not-allowed border-zinc-200 bg-zinc-100'
                    : disposition === 'return_to_stock'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 cursor-pointer'
                    : 'border-zinc-200 bg-zinc-50 cursor-pointer'
                }`}
              >
                <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                  <span>📦</span> Restock
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                  {currentStatus === 'preparing' || currentStatus === 'ready' ? 'Unavailable' : 'Uncooked'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDisposition('record_waste')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  disposition === 'record_waste'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                  <span>🗑️</span> Waste
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                  Prepared
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDisposition('none')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  disposition === 'none'
                    ? 'border-zinc-700 bg-zinc-100 ring-2 ring-zinc-700/20'
                    : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div className="text-xs font-bold text-zinc-950 flex items-center gap-1">
                  <span>🚫</span> None
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                  No action
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
          <Button
            variant="outline"
            className="text-xs font-bold"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            className="text-xs font-bold bg-red-600 hover:bg-red-700 min-w-[120px]"
            onClick={handleConfirmCancel}
            disabled={isPending}
          >
            {isPending ? 'Processing...' : `Cancel ${qtyToCancel}x Item`}
          </Button>
        </div>
      </div>
    </div>
  );
}

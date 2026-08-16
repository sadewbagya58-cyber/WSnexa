'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedInventoryItem, FormattedStorageLocation } from '@/server/services/inventory.service';
import { recordStockAdjustmentAction } from '@/server/actions/inventory';

interface InventoryAdjustmentModalProps {
  item: FormattedInventoryItem;
  locations: FormattedStorageLocation[];
  onClose: () => void;
}

export function InventoryAdjustmentModal({
  item,
  locations,
  onClose,
}: InventoryAdjustmentModalProps) {
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [direction, setDirection] = useState<'in' | 'out' | 'set'>('in');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(item.baseUnit);
  const [reason, setReason] = useState('count_correction');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMsg('Please enter a valid positive quantity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const idempotencyKey = `adj_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await recordStockAdjustmentAction({
      branchId: locations.find((l) => l.id === locationId)?.branchId || locations[0]?.branchId,
      locationId,
      itemId: item.id,
      direction,
      quantity: numQty,
      unit,
      reason: reason === 'other' && notes ? notes : reason,
      notes: notes || null,
      idempotencyKey,
    });

    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message || 'Failed to record adjustment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-zinc-950">Adjust Stock Level</h2>
            <p className="text-xs text-zinc-500 font-medium">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Direction Segmented Control */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">Adjustment Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDirection('in')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  direction === 'in'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                + Add Stock
              </button>
              <button
                type="button"
                onClick={() => setDirection('out')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  direction === 'out'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                - Remove
              </button>
              <button
                type="button"
                onClick={() => setDirection('set')}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  direction === 'set'
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                = Set Count
              </button>
            </div>
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Storage Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} {loc.isDefault ? '(Main)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-700 mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 font-bold"
              >
                <option value={item.baseUnit}>{item.baseUnit}</option>
                {item.baseUnit === 'kg' && <option value="g">g</option>}
                {item.baseUnit === 'l' && <option value="ml">ml</option>}
                {item.baseUnit === 'pcs' && (
                  <>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="bottle">bottle</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950"
            >
              <option value="count_correction">Physical Count Correction</option>
              <option value="delivery_receipt">Direct Purchase / Delivery Receipt</option>
              <option value="opening_balance">Opening Stock Setup</option>
              <option value="damaged">Damaged / Broken</option>
              <option value="staff_meal">Staff Meal Consumption</option>
              <option value="return_to_supplier">Return to Supplier</option>
              <option value="other">Other / Custom</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Received 2 bags from wholesale"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold bg-zinc-950 text-white"
            >
              {isSubmitting ? 'Recording...' : 'Commit Adjustment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

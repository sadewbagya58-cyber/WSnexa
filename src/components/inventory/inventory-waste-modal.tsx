'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormattedInventoryItem, FormattedStorageLocation } from '@/server/services/inventory.service';
import { recordWasteAction } from '@/server/actions/inventory';
import { WasteReason } from '@/lib/validation/inventory';

interface InventoryWasteModalProps {
  item: FormattedInventoryItem;
  locations: FormattedStorageLocation[];
  onClose: () => void;
}

export function InventoryWasteModal({
  item,
  locations,
  onClose,
}: InventoryWasteModalProps) {
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(item.baseUnit);
  const [reason, setReason] = useState<WasteReason>('spoiled');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMsg('Please enter a valid positive waste quantity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const idempotencyKey = `waste_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await recordWasteAction({
      branchId: locations.find((l) => l.id === locationId)?.branchId || locations[0]?.branchId,
      locationId,
      itemId: item.id,
      quantity: numQty,
      unit,
      reason,
      notes: notes || null,
      idempotencyKey,
    });

    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message || 'Failed to record waste.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-rose-600 flex items-center gap-1.5">
              <span>🗑️</span> Record Waste & Spoilage
            </h2>
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
              <label className="block text-xs font-bold text-zinc-700 mb-1">Wasted Quantity</label>
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

          {/* Waste Reason */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Waste Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as WasteReason)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 font-medium"
            >
              <option value="spoiled">Spoiled / Rotten</option>
              <option value="expired">Expired Past Shelf Life</option>
              <option value="prep_waste">Kitchen Preparation Trimming</option>
              <option value="overcooked">Overcooked / Burnt</option>
              <option value="dropped">Dropped / Spilled on Floor</option>
              <option value="customer_return">Customer Return / Complaint</option>
              <option value="staff_meal">Staff Meal Consumption</option>
              <option value="damaged">Packaging Damaged</option>
              <option value="other">Other / Custom</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Fridge temperature failure overnight"
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
              className="text-xs font-bold bg-rose-600 text-white hover:bg-rose-700"
            >
              {isSubmitting ? 'Recording...' : 'Record Waste'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

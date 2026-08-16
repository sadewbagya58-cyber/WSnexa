'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormattedInventoryItem, FormattedStorageLocation } from '@/server/services/inventory.service';
import { createStockTransferAction } from '@/server/actions/inventory';

interface StockTransferFormProps {
  branches: Array<{ id: string; name: string }>;
  locations: FormattedStorageLocation[];
  items: FormattedInventoryItem[];
  activeBranchId: string;
}

export function StockTransferForm({
  branches,
  locations,
  items,
  activeBranchId,
}: StockTransferFormProps) {
  const router = useRouter();

  const [sourceBranchId, setSourceBranchId] = useState(activeBranchId);
  const [sourceLocationId, setSourceLocationId] = useState(locations[0]?.id || '');
  const [destinationBranchId, setDestinationBranchId] = useState(activeBranchId);
  const [destinationLocationId, setDestinationLocationId] = useState(locations[1]?.id || locations[0]?.id || '');
  const [notes, setNotes] = useState('');

  // Selected Transfer Items
  const [transferItems, setTransferItems] = useState<Array<{ itemId: string; quantitySent: number; unitSent: string }>>([
    { itemId: items[0]?.id || '', quantitySent: 1, unitSent: items[0]?.baseUnit || 'kg' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddItem = () => {
    if (items.length > 0) {
      setTransferItems((prev) => [
        ...prev,
        { itemId: items[0].id, quantitySent: 1, unitSent: items[0].baseUnit },
      ]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: 'itemId' | 'quantitySent' | 'unitSent', val: string | number) => {
    setTransferItems((prev) => {
      const copy = [...prev];
      if (field === 'itemId') {
        const found = items.find((it) => it.id === val);
        copy[index] = {
          ...copy[index],
          itemId: String(val),
          unitSent: found?.baseUnit || 'kg',
        };
      } else {
        copy[index] = {
          ...copy[index],
          [field]: val,
        };
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0) {
      setErrorMsg('Please add at least one item to transfer.');
      return;
    }

    if (sourceLocationId === destinationLocationId && sourceBranchId === destinationBranchId) {
      setErrorMsg('Source and destination storage locations cannot be the same.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createStockTransferAction({
      sourceBranchId,
      sourceLocationId,
      destinationBranchId,
      destinationLocationId,
      items: transferItems.map((ti) => ({
        itemId: ti.itemId,
        quantitySent: Number(ti.quantitySent),
        unitSent: ti.unitSent,
      })),
      notes: notes.trim() || null,
    });

    setIsSubmitting(false);

    if (res.success) {
      router.push('/dashboard/inventory/transfers');
      router.refresh();
    } else {
      setErrorMsg(res.message || 'Failed to create transfer.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white border border-zinc-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Source & Destination Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
        {/* Source */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Source (Dispatch From)</span>
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Branch</label>
            <select
              value={sourceBranchId}
              onChange={(e) => setSourceBranchId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 font-bold min-h-[40px]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Storage Location</label>
            <select
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} {l.isDefault ? '(Main)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Destination (Receive At)</span>
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Branch</label>
            <select
              value={destinationBranchId}
              onChange={(e) => setDestinationBranchId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 font-bold min-h-[40px]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">Storage Location</label>
            <select
              value={destinationLocationId}
              onChange={(e) => setDestinationLocationId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} {l.isDefault ? '(Main)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transfer Items Line Rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Transfer Items</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            className="text-xs font-bold h-7"
          >
            + Add Another Item
          </Button>
        </div>

        <div className="space-y-2">
          {transferItems.map((ti, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
              <select
                value={ti.itemId}
                onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                className="flex-1 text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-bold min-h-[40px]"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.currentStockQuantity || 0} {it.baseUnit} available)
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="any"
                min="0.0001"
                required
                placeholder="Qty"
                value={ti.quantitySent || ''}
                onChange={(e) => handleItemChange(idx, 'quantitySent', parseFloat(e.target.value) || 0)}
                className="w-24 text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 font-bold min-h-[40px]"
              />

              <span className="text-xs font-bold text-zinc-500 w-12 text-center">
                {ti.unitSent}
              </span>

              {transferItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  className="text-zinc-400 hover:text-rose-600 text-sm font-bold px-2 py-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-bold text-zinc-800 mb-1">Transfer Notes (Optional)</label>
        <input
          type="text"
          placeholder="e.g. Kitchen restocking for weekend dinner rush"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="text-xs font-bold min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="text-xs font-bold bg-zinc-950 text-white min-h-[44px] px-6"
        >
          {isSubmitting ? 'Creating...' : 'Create Draft Transfer'}
        </Button>
      </div>
    </form>
  );
}

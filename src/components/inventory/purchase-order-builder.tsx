'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createPurchaseOrderAction } from '@/server/actions/purchasing';
import { STANDARD_UNITS } from '@/lib/inventory/unit-converter';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface SupplierOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
}

interface InventoryItemOption {
  id: string;
  name: string;
  baseUnit: string;
  costPerUnitCents: number;
}

interface PurchaseOrderBuilderProps {
  branchId: string;
  suppliers: SupplierOption[];
  locations: LocationOption[];
  availableItems: InventoryItemOption[];
  currency: string;
}

export function PurchaseOrderBuilder({
  branchId,
  suppliers,
  locations,
  availableItems,
  currency,
}: PurchaseOrderBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [destinationLocationId, setDestinationLocationId] = useState<string>(locations[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<
    Array<{
      itemId: string;
      purchasingUnit: string;
      quantityOrdered: number;
      unitCostCents: number;
    }>
  >([
    {
      itemId: availableItems[0]?.id || '',
      purchasingUnit: availableItems[0]?.baseUnit || 'kg',
      quantityOrdered: 10,
      unitCostCents: availableItems[0]?.costPerUnitCents || 0,
    },
  ]);

  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(item.quantityOrdered * item.unitCostCents),
    0
  );

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        itemId: availableItems[0]?.id || '',
        purchasingUnit: availableItems[0]?.baseUnit || 'kg',
        quantityOrdered: 10,
        unitCostCents: availableItems[0]?.costPerUnitCents || 0,
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !destinationLocationId) {
      setErrorMsg('Please select a supplier and receiving storage location.');
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await createPurchaseOrderAction({
        branchId,
        supplierId,
        destinationLocationId,
        expectedDeliveryDate: expectedDeliveryDate || null,
        notes: notes || null,
        items: items.map((i) => ({
          itemId: i.itemId,
          purchasingUnit: i.purchasingUnit,
          quantityOrdered: Number(i.quantityOrdered) || 1,
          unitCostCents: Number(i.unitCostCents) || 0,
        })),
      });

      if (res.success) {
        router.push('/dashboard/inventory/purchasing');
      } else {
        setErrorMsg(res.message || 'Failed to create purchase order.');
      }
    });
  }

  if (suppliers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3">
        <div className="text-3xl">🏢</div>
        <h3 className="text-sm font-bold text-zinc-900">No Suppliers Registered</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Please register at least one vendor before creating a purchase order.
        </p>
        <Button
          size="sm"
          onClick={() => router.push('/dashboard/inventory/suppliers')}
          className="text-xs font-bold bg-zinc-950 text-white"
        >
          + Add Supplier
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
          1. Vendor & Receiving Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Vendor / Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Receiving Storage Location *</label>
            <select
              value={destinationLocationId}
              onChange={(e) => setDestinationLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
            2. Purchase Order Line Items
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="text-xs font-bold"
          >
            + Add Line Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Stock Item</label>
                <select
                  value={item.itemId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const itm = availableItems.find((i) => i.id === val);
                    setItems((prev) =>
                      prev.map((it, i) =>
                        i === idx
                          ? {
                              ...it,
                              itemId: val,
                              purchasingUnit: itm?.baseUnit || it.purchasingUnit,
                              unitCostCents: itm?.costPerUnitCents || it.unitCostCents,
                            }
                          : it
                      )
                    );
                  }}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white"
                >
                  {availableItems.map((ai) => (
                    <option key={ai.id} value={ai.id}>
                      {ai.name} ({formatCurrencyMinor(ai.costPerUnitCents, currency)} / {ai.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={item.quantityOrdered}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, quantityOrdered: Number(e.target.value) } : it))
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono bg-white"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Purchasing Unit</label>
                <select
                  value={item.purchasingUnit}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, purchasingUnit: e.target.value } : it))
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white"
                >
                  {Object.keys(STANDARD_UNITS).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Unit Cost (minor units)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={item.unitCostCents}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, unitCostCents: Number(e.target.value) } : it))
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono bg-white"
                />
              </div>

              <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary */}
        <div className="pt-4 border-t border-zinc-100 flex justify-between items-center text-sm">
          <span className="font-bold text-zinc-600">Total Purchase Value:</span>
          <span className="font-mono font-black text-lg text-zinc-950">
            {formatCurrencyMinor(subtotalCents, currency)}
          </span>
        </div>
      </div>

      {/* PO Notes */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
        <label className="text-xs font-bold text-zinc-700 block">Purchase Order Notes & Instructions (Optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Standard weekly stock replenishment, deliver to back dock entrance before 10 AM"
          className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-zinc-950"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="text-xs font-bold"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-w-36"
        >
          {isPending ? 'Creating PO…' : 'Save Purchase Order ✓'}
        </Button>
      </div>
    </form>
  );
}

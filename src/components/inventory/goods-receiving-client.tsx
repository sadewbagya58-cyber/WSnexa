'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { recordGoodsReceiptAction } from '@/server/actions/purchasing';
import { STANDARD_UNITS } from '@/lib/inventory/unit-converter';
import { getCurrencySymbol } from '@/lib/utils/currency';
import { formatMinorUnitsToDecimal, parseDecimalToMinorUnits } from '@/lib/utils/money';

interface SupplierOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  name: string;
  baseUnit: string;
  costPerUnitCents: number;
}

interface PurchaseOrderOption {
  id: string;
  poNumber: string;
  supplierId: string;
  destinationLocationId: string;
  items: Array<{
    id: string;
    itemId: string;
    itemName: string;
    purchasingUnit: string;
    quantityOrdered: number;
    quantityReceivedBase: number;
    unitCostCents: number;
  }>;
}

interface GoodsReceivingClientProps {
  branchId: string;
  suppliers: SupplierOption[];
  locations: LocationOption[];
  availableItems: ItemOption[];
  openPurchaseOrders: PurchaseOrderOption[];
  currency: string;
  canManage?: boolean;
}

export function GoodsReceivingClient({
  branchId,
  suppliers,
  locations,
  availableItems,
  openPurchaseOrders,
  currency,
  canManage = true,
}: GoodsReceivingClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || '');
  const [grnNumber, setGrnNumber] = useState(() => `GRN-${Math.floor(100000 + Math.random() * 900000)}`);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<
    Array<{
      itemId: string;
      poItemId: string | null;
      quantityReceived: number;
      unitReceived: string;
      unitCost: string;
      batchCode: string;
      expiryDate: string;
      discrepancyReason: string;
    }>
  >([
    {
      itemId: availableItems[0]?.id || '',
      poItemId: null,
      quantityReceived: 10,
      unitReceived: availableItems[0]?.baseUnit || 'kg',
      unitCost: formatMinorUnitsToDecimal(availableItems[0]?.costPerUnitCents || 0),
      batchCode: '',
      expiryDate: '',
      discrepancyReason: '',
    },
  ]);

  function handlePoSelect(poId: string) {
    setSelectedPoId(poId);
    if (!poId) return;

    const po = openPurchaseOrders.find((p) => p.id === poId);
    if (po) {
      setSupplierId(po.supplierId);
      setLocationId(po.destinationLocationId);
      setItems(
        po.items.map((i) => ({
          itemId: i.itemId,
          poItemId: i.id,
          quantityReceived: Math.max(0, i.quantityOrdered - i.quantityReceivedBase),
          unitReceived: i.purchasingUnit,
          unitCost: formatMinorUnitsToDecimal(i.unitCostCents),
          batchCode: '',
          expiryDate: '',
          discrepancyReason: '',
        }))
      );
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        itemId: availableItems[0]?.id || '',
        poItemId: null,
        quantityReceived: 10,
        unitReceived: availableItems[0]?.baseUnit || 'kg',
        unitCost: formatMinorUnitsToDecimal(availableItems[0]?.costPerUnitCents || 0),
        batchCode: '',
        expiryDate: '',
        discrepancyReason: '',
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !locationId || items.length === 0) {
      setErrorMsg('Please select supplier, location, and at least one item.');
      return;
    }

    for (const item of items) {
      if (!item.itemId) {
        setErrorMsg('Please select an item for each receiving line.');
        return;
      }
      if (Number(item.quantityReceived) <= 0) {
        setErrorMsg('Quantity received must be greater than 0.');
        return;
      }
      try {
        const cents = parseDecimalToMinorUnits(item.unitCost);
        if (cents < 0) {
          setErrorMsg('Unit cost cannot be negative.');
          return;
        }
      } catch {
        setErrorMsg(`Invalid unit cost: "${item.unitCost}". Please enter a valid decimal price (e.g. 7.00).`);
        return;
      }
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const idempotencyKey = `GRN_RECV_${grnNumber}_${Date.now()}`;
      const res = await recordGoodsReceiptAction({
        branchId,
        supplierId,
        locationId,
        poId: selectedPoId || null,
        grnNumber: grnNumber.trim(),
        items: items.map((i) => ({
          itemId: i.itemId,
          poItemId: i.poItemId || null,
          quantityReceived: Number(i.quantityReceived) || 0,
          unitReceived: i.unitReceived,
          unitCostCents: parseDecimalToMinorUnits(i.unitCost),
          batchCode: i.batchCode || null,
          expiryDate: i.expiryDate || null,
          discrepancyReason: i.discrepancyReason || null,
        })),
        notes: notes || null,
        idempotencyKey,
      });

      if (res.success) {
        setSuccessMsg(`✓ Goods Receipt #${grnNumber} recorded. Balances & costs updated.`);
        setGrnNumber(`GRN-${Date.now().toString().slice(-6)}`);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to record goods receipt.');
      }
    });
  }

  return (
    <form onSubmit={handleReceive} className="space-y-6 max-w-4xl">
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {/* PO Selector / Receipt Header */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
          1. Delivery Header
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Link Purchase Order (Optional)</label>
            <select
              value={selectedPoId}
              onChange={(e) => handlePoSelect(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              <option value="">-- Ad-hoc Direct Delivery --</option>
              {openPurchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} ({po.items.length} items)
                </option>
              ))}
            </select>
          </div>

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
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Received Items */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
            2. Received Items & Expiry
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="text-xs font-bold"
          >
            + Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
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
                                unitReceived: itm?.baseUnit || it.unitReceived,
                                unitCost: formatMinorUnitsToDecimal(itm?.costPerUnitCents || 0),
                              }
                            : it
                        )
                      );
                    }}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white"
                  >
                    {availableItems.map((ai) => (
                      <option key={ai.id} value={ai.id}>
                        {ai.name} (Base: {ai.baseUnit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600">Qty Received</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={item.quantityReceived}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, quantityReceived: Number(e.target.value) } : it
                        )
                      )
                    }
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono bg-white"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600">Unit</label>
                  <select
                    value={item.unitReceived}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, unitReceived: e.target.value } : it
                        )
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
                  <label className="text-[11px] font-bold text-zinc-600">
                    Unit Cost ({getCurrencySymbol(currency)} / {item.unitReceived})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={item.unitCost}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, unitCost: e.target.value } : it
                        )
                      )
                    }
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono bg-white"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end">
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

              {/* Batch Code & Expiry Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500">Batch / Lot Code (Optional)</label>
                  <input
                    type="text"
                    value={item.batchCode}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, batchCode: e.target.value } : it))
                      )
                    }
                    placeholder="e.g. LOT-2026-08"
                    className="w-full px-2.5 py-1 border border-zinc-300 rounded-lg text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={item.expiryDate}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, expiryDate: e.target.value } : it))
                      )
                    }
                    className="w-full px-2.5 py-1 border border-zinc-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes / Delivery Remarks */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-2">
        <label className="text-xs font-bold text-zinc-700 block">Delivery Notes & Remarks (Optional)</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Invoiced by driver John, all boxes inspected and temperature verified"
          className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-zinc-950"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {canManage ? (
          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-w-40 min-h-[38px] rounded-xl shadow-xs"
          >
            {isPending ? 'Receiving Stock…' : 'Receive Delivery'}
          </Button>
        ) : (
          <p className="text-xs text-zinc-500 italic">View-only access. Receiving stock requires purchasing receive permission.</p>
        )}
      </div>
    </form>
  );
}

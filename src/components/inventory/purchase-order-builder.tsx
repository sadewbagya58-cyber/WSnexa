'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createPurchaseOrderAction } from '@/server/actions/purchasing';
import { STANDARD_UNITS } from '@/lib/inventory/unit-converter';
import { formatCurrencyMinor, getCurrencySymbol } from '@/lib/utils/currency';
import { formatMinorUnitsToDecimal, parseDecimalToMinorUnits } from '@/lib/utils/money';

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

export interface SupplierItemMapping {
  supplierId: string;
  itemId: string;
  supplierSku: string | null;
  purchasingUnit: string;
  conversionToBase: number;
  lastPriceCents: number;
  currency: string;
  isPreferred: boolean;
}

interface PurchaseOrderBuilderProps {
  branchId: string;
  suppliers: SupplierOption[];
  locations: LocationOption[];
  availableItems: InventoryItemOption[];
  supplierMappings?: SupplierItemMapping[];
  currency: string;
  hasCostPermission?: boolean;
  initialSupplierId?: string;
  initialItemId?: string;
}

export function PurchaseOrderBuilder({
  branchId,
  suppliers,
  locations,
  availableItems,
  supplierMappings = [],
  currency,
  hasCostPermission = false,
  initialSupplierId,
  initialItemId,
}: PurchaseOrderBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultSupplierId =
    suppliers.find((s) => s.id === initialSupplierId)?.id || suppliers[0]?.id || '';
  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId);
  const [destinationLocationId, setDestinationLocationId] = useState<string>(locations[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Initial Item determination
  const startItem =
    availableItems.find((i) => i.id === initialItemId) || availableItems[0];
  const startMapping = startItem
    ? supplierMappings.find((m) => m.supplierId === defaultSupplierId && m.itemId === startItem.id)
    : null;

  const [items, setItems] = useState<
    Array<{
      itemId: string;
      purchasingUnit: string;
      quantityOrdered: number;
      unitCost: string;
    }>
  >([
    {
      itemId: startItem?.id || '',
      purchasingUnit: startMapping?.purchasingUnit || startItem?.baseUnit || 'kg',
      quantityOrdered: 10,
      unitCost: formatMinorUnitsToDecimal(
        startMapping && hasCostPermission
          ? startMapping.lastPriceCents
          : startItem?.costPerUnitCents || 0
      ),
    },
  ]);

  const subtotalCents = items.reduce((sum, item) => {
    let cents = 0;
    try {
      cents = parseDecimalToMinorUnits(item.unitCost);
    } catch {
      cents = 0;
    }
    return sum + Math.round((Number(item.quantityOrdered) || 0) * cents);
  }, 0);

  function addItem() {
    const firstItem = availableItems[0];
    const mapping = firstItem
      ? supplierMappings.find((m) => m.supplierId === supplierId && m.itemId === firstItem.id)
      : null;

    setItems((prev) => [
      ...prev,
      {
        itemId: firstItem?.id || '',
        purchasingUnit: mapping?.purchasingUnit || firstItem?.baseUnit || 'kg',
        quantityOrdered: 10,
        unitCost: formatMinorUnitsToDecimal(
          mapping && hasCostPermission
            ? mapping.lastPriceCents
            : firstItem?.costPerUnitCents || 0
        ),
      },
    ]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSupplierChange(newSupplierId: string) {
    setSupplierId(newSupplierId);
    // Optionally update line items unit costs and units if mapped to new supplier
    setItems((prev) =>
      prev.map((it) => {
        const mapping = supplierMappings.find(
          (m) => m.supplierId === newSupplierId && m.itemId === it.itemId
        );
        if (mapping) {
          return {
            ...it,
            purchasingUnit: mapping.purchasingUnit,
            unitCost: hasCostPermission ? formatMinorUnitsToDecimal(mapping.lastPriceCents) : it.unitCost,
          };
        }
        return it;
      })
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !destinationLocationId) {
      setErrorMsg('Please select a supplier and receiving storage location.');
      return;
    }

    for (const item of items) {
      if (!item.itemId) {
        setErrorMsg('Please select an item for each line.');
        return;
      }
      if (Number(item.quantityOrdered) <= 0) {
        setErrorMsg('Quantity ordered must be greater than 0.');
        return;
      }
      try {
        const cents = parseDecimalToMinorUnits(item.unitCost);
        if (cents < 0) {
          setErrorMsg('Unit cost cannot be negative.');
          return;
        }
      } catch {
        setErrorMsg(`Invalid unit cost: "${item.unitCost}". Please enter a valid decimal amount (e.g. 7.00).`);
        return;
      }
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
          unitCostCents: parseDecimalToMinorUnits(i.unitCost),
        })),
      });

      if (res.success) {
        router.push('/dashboard/inventory/purchasing');
      } else {
        setErrorMsg(res.message || 'Failed to create purchase order.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Supplier & Destination Location */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
          1. Vendor & Destination Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Vendor / Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => handleSupplierChange(e.target.value)}
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
            <label className="text-xs font-bold text-zinc-700">Receiving Storage Location</label>
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
          {items.map((item, idx) => {
            const mappedCatalog = supplierMappings.find(
              (m) => m.supplierId === supplierId && m.itemId === item.itemId
            );
            const currentItemInfo = availableItems.find((i) => i.id === item.itemId);

            return (
              <div
                key={idx}
                className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-zinc-600">Stock Item</label>
                    <select
                      value={item.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const itm = availableItems.find((i) => i.id === val);
                        const map = supplierMappings.find(
                          (m) => m.supplierId === supplierId && m.itemId === val
                        );
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? {
                                  ...it,
                                  itemId: val,
                                  purchasingUnit: map?.purchasingUnit || itm?.baseUnit || it.purchasingUnit,
                                  unitCost: formatMinorUnitsToDecimal(
                                    map && hasCostPermission
                                      ? map.lastPriceCents
                                      : itm?.costPerUnitCents || 0
                                  ),
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
                    <label className="text-[11px] font-bold text-zinc-600">
                      Unit Cost ({getCurrencySymbol(currency)} / {item.purchasingUnit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.unitCost}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, unitCost: e.target.value } : it))
                        )
                      }
                      placeholder="0.00"
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

                {/* Supplier Catalog Pricing Context & Comparison Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 text-[11px]">
                  {mappedCatalog ? (
                    <div className="flex items-center gap-2 text-zinc-600 font-medium">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        🏷️ Mapped Catalog
                      </span>
                      {hasCostPermission && (
                        <span>
                          {formatCurrencyMinor(mappedCatalog.lastPriceCents, mappedCatalog.currency)} / {mappedCatalog.purchasingUnit}
                          {mappedCatalog.conversionToBase !== 1 && currentItemInfo && (
                            <span className="text-zinc-400 ml-1">
                              ({formatCurrencyMinor(Math.round(mappedCatalog.lastPriceCents / mappedCatalog.conversionToBase), mappedCatalog.currency)} / {currentItemInfo.baseUnit} base)
                            </span>
                          )}
                        </span>
                      )}
                      {mappedCatalog.supplierSku && (
                        <span className="text-zinc-400 font-mono text-[10px]">
                          SKU: {mappedCatalog.supplierSku}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic">
                      No direct catalog mapping for this supplier. Standard unit cost applied.
                    </span>
                  )}

                  {item.itemId && (
                    <Link
                      href={`/dashboard/inventory/items/${item.itemId}`}
                      target="_blank"
                      className="text-zinc-600 hover:text-zinc-950 font-bold hover:underline ml-auto flex items-center gap-1"
                    >
                      <span>🔍</span> Compare All Suppliers ↗
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
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
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-6"
        >
          {isPending ? 'Creating Purchase Order...' : 'Create Purchase Order'}
        </Button>
      </div>
    </form>
  );
}

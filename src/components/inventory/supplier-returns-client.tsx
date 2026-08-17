'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { recordSupplierReturnAction } from '@/server/actions/purchasing';
import {
  SupplierReturnRecord,
  ReturnableGrnItem,
} from '@/server/services/purchasing.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';
import { STANDARD_UNITS, UnitConverter } from '@/lib/inventory/unit-converter';

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

interface SupplierReturnsClientProps {
  branchId: string;
  suppliers: SupplierOption[];
  locations: LocationOption[];
  availableItems: ItemOption[];
  returnableGrnItems: ReturnableGrnItem[];
  supplierReturns: SupplierReturnRecord[];
  currency: string;
}

const RETURN_REASONS = [
  { value: 'damaged', label: '📦 Damaged in Transit / Seal Broken' },
  { value: 'expired', label: '⏳ Expired / Near Expiry Date' },
  { value: 'wrong_item', label: '❌ Wrong Specification / Item Mismatch' },
  { value: 'quality_issue', label: '⚠️ Quality Substandard / Rejected on Inspection' },
  { value: 'over_delivered', label: '📈 Over-Delivered Excess Shipment' },
  { value: 'other', label: '📝 Other (Specify in notes)' },
];

export function SupplierReturnsClient({
  branchId,
  suppliers,
  locations,
  availableItems,
  returnableGrnItems,
  supplierReturns,
  currency,
}: SupplierReturnsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [selectedGrnId, setSelectedGrnId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || '');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState<string>('kg');
  const [reason, setReason] = useState<string>('damaged');
  const [notes, setNotes] = useState<string>('');

  // Filter returnable GRN lines based on selected supplier
  const supplierGrnLines = returnableGrnItems.filter((g) => g.supplierId === supplierId);
  const distinctGrns = Array.from(
    new Map(supplierGrnLines.map((g) => [g.grnId, { id: g.grnId, number: g.grnNumber, date: g.grnDate }])).values()
  );

  // Available items for the selected GRN (or all supplier items if unlinked)
  const eligibleItemsForGrn = selectedGrnId
    ? supplierGrnLines.filter((g) => g.grnId === selectedGrnId)
    : [];

  // Selected Returnable item definition
  const selectedGrnItem = eligibleItemsForGrn.find((i) => i.itemId === selectedItemId);
  const selectedStockItem = availableItems.find((i) => i.id === selectedItemId);

  // Calculate live return value
  const numQty = parseFloat(quantity) || 0;
  const itemBaseUnit = selectedGrnItem?.baseUnit || selectedStockItem?.baseUnit || unit;
  let qtyBase = numQty;
  try {
    qtyBase = UnitConverter.normalizeToBase(numQty, unit, itemBaseUnit);
  } catch {
    qtyBase = numQty;
  }

  const unitCostCents = selectedGrnItem?.unitCostCents || selectedStockItem?.costPerUnitCents || 0;
  const totalReturnValueCents = Math.round(qtyBase * unitCostCents);

  // Preflight validation checks
  const exceedsGrn = selectedGrnItem ? qtyBase > selectedGrnItem.remainingReturnableBase : false;

  function handleSupplierChange(newSupplierId: string) {
    setSupplierId(newSupplierId);
    setSelectedGrnId('');
    setSelectedItemId('');
  }

  function handleGrnChange(newGrnId: string) {
    setSelectedGrnId(newGrnId);
    const grnLines = supplierGrnLines.filter((g) => g.grnId === newGrnId);
    if (grnLines.length > 0) {
      setSelectedItemId(grnLines[0].itemId);
      setUnit(grnLines[0].unitReceived);
      setLocationId(grnLines[0].locationId);
    } else {
      setSelectedItemId('');
    }
  }

  function handleItemChange(newItemId: string) {
    setSelectedItemId(newItemId);
    const grnLine = eligibleItemsForGrn.find((i) => i.itemId === newItemId);
    if (grnLine) {
      setUnit(grnLine.unitReceived);
      setLocationId(grnLine.locationId);
    } else {
      const itm = availableItems.find((i) => i.id === newItemId);
      if (itm) setUnit(itm.baseUnit);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId || !locationId || !selectedItemId) {
      setErrorMsg('Please select a supplier, item, and storage location.');
      return;
    }

    if (numQty <= 0) {
      setErrorMsg('Return quantity must be strictly greater than zero.');
      return;
    }

    if (exceedsGrn && selectedGrnItem) {
      setErrorMsg(
        `Cannot return ${numQty} ${unit}. Maximum remaining returnable from GRN #${selectedGrnItem.grnNumber} is ${selectedGrnItem.remainingReturnableBase} ${selectedGrnItem.baseUnit}.`
      );
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const idempotencyKey = `SR_RETURN_${selectedItemId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const res = await recordSupplierReturnAction({
        branchId,
        supplierId,
        locationId,
        itemId: selectedItemId,
        grnId: selectedGrnId || null,
        quantity: numQty,
        unit,
        reason: reason === 'other' && notes ? notes : reason,
        notes: notes || null,
        idempotencyKey,
      });

      if (res.success) {
        setSuccessMsg(`✓ Supplier Return recorded successfully.`);
        setQuantity('1');
        setNotes('');
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to record supplier return.');
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* ── 1. Create Supplier Return Form ── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
            {successMsg}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-5">
          <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
                Initiate Vendor Return & Credit Note
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Deduct damaged or rejected stock and generate an audit ledger reference against the original delivery receipt.
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">
              Branch Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Supplier Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">1. Select Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Source GRN / Delivery Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">2. Link to Goods Receipt (GRN)</label>
              <select
                value={selectedGrnId}
                onChange={(e) => handleGrnChange(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
              >
                <option value="">-- Direct Supplier Return (No GRN Link) --</option>
                {distinctGrns.map((g) => (
                  <option key={g.id} value={g.id}>
                    #{g.number} ({new Date(g.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Return Source Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">3. Storage Location *</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end pt-2 border-t border-zinc-100">
            {/* Item Selector */}
            <div className="sm:col-span-5 space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">4. Inventory Stock Item *</label>
              <select
                value={selectedItemId}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
              >
                <option value="">-- Select Item to Return --</option>
                {selectedGrnId ? (
                  eligibleItemsForGrn.map((i) => (
                    <option key={i.itemId} value={i.itemId}>
                      {i.itemName} (GRN Received: {i.quantityReceived} {i.unitReceived})
                    </option>
                  ))
                ) : (
                  availableItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.baseUnit})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Quantity */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">5. Return Qty</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs font-mono bg-white focus:ring-2 focus:ring-zinc-950 ${
                  exceedsGrn ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-zinc-300'
                }`}
              />
            </div>

            {/* Unit */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-zinc-950"
              >
                {Object.keys(STANDARD_UNITS).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">6. Return Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-zinc-950"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Return Preflight Summary Card ── */}
          {selectedItemId && (
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              {selectedGrnItem ? (
                <>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">GRN Received</span>
                    <span className="font-bold text-zinc-900">
                      {selectedGrnItem.quantityReceived} {selectedGrnItem.unitReceived}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Previously Returned</span>
                    <span className="font-bold text-zinc-900">
                      {selectedGrnItem.quantityReturnedBase} {selectedGrnItem.baseUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Remaining Returnable</span>
                    <span className={`font-bold ${exceedsGrn ? 'text-rose-600 font-black' : 'text-zinc-900'}`}>
                      {selectedGrnItem.remainingReturnableBase} {selectedGrnItem.baseUnit}
                    </span>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-3">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Return Mode</span>
                  <span className="font-bold text-zinc-700">Direct Return (No GRN Link)</span>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Unit Cost Basis</span>
                <span className="font-bold text-zinc-900">
                  {formatCurrencyMinor(unitCostCents, currency)} / {itemBaseUnit}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Return Quantity</span>
                <span className="font-bold text-zinc-900">
                  {qtyBase.toFixed(2)} {itemBaseUnit}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Estimated Credit Value</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">
                  {formatCurrencyMinor(totalReturnValueCents, currency)}
                </span>
              </div>
            </div>
          )}

          {/* Notes & Submission */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-zinc-700">Detailed Notes & Carrier/RMA Reference (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Return authorization #RMA-8492, picked up by vendor driver"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending || exceedsGrn || !selectedItemId}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white min-w-40 shadow-xs"
            >
              {isPending ? 'Processing Return…' : '↩️ Confirm Supplier Return'}
            </Button>
          </div>
        </div>
      </form>

      {/* ── 2. Supplier Returns History Ledger ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
              Supplier Returns & Vendor Credit Ledger ({supplierReturns.length})
            </h3>
            <p className="text-xs text-zinc-500">
              Immutable audit history of all goods returned to suppliers with financial debit amounts.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 uppercase">
            Immutable Audit Trail
          </span>
        </div>

        {supplierReturns.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-3xl">📦</div>
            <h4 className="text-sm font-bold text-zinc-800">No Supplier Returns Recorded</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              When goods are damaged, expired, or returned to a vendor, records will be logged in this ledger automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Return #</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Source GRN</th>
                  <th className="px-5 py-3">Item & Qty</th>
                  <th className="px-5 py-3">Credit Value</th>
                  <th className="px-5 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {supplierReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-zinc-900">
                      {ret.returnNumber}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">
                      {new Date(ret.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-zinc-800">
                      {ret.supplierName}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600">
                      {ret.grnNumber ? (
                        <span className="font-mono text-[11px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">
                          #{ret.grnNumber}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">Direct Return</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-900">{ret.itemName}</div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {ret.quantity} {ret.unit} ({ret.locationName})
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">
                      {formatCurrencyMinor(ret.totalCostCents, currency)}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-600">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {ret.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

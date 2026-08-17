'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  updateSupplierAction,
  upsertSupplierItemAction,
  removeSupplierItemAction,
  getSupplierItemPriceHistoryAction,
} from '@/server/actions/purchasing';
import {
  SupplierWithCatalogRecord,
  SupplierCatalogItemRecord,
  PriceHistoryRecord,
} from '@/server/services/purchasing.service';
import { formatCurrencyMinor, getCurrencySymbol } from '@/lib/utils/currency';
import { formatMinorUnitsToDecimal, parseDecimalToMinorUnits } from '@/lib/utils/money';
import { STANDARD_UNITS } from '@/lib/inventory/unit-converter';

interface InventoryItemOption {
  id: string;
  name: string;
  baseUnit: string;
  costPerUnitCents: number;
}

interface SupplierDetailClientProps {
  supplier: SupplierWithCatalogRecord;
  availableItems: InventoryItemOption[];
  hasCostPermission?: boolean;
}

export function SupplierDetailClient({
  supplier,
  availableItems,
  hasCostPermission = false,
}: SupplierDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modals & Panels
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [isMappingItem, setIsMappingItem] = useState(false);
  const [editingItemRecord, setEditingItemRecord] = useState<SupplierCatalogItemRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Supplier Edit Form State
  const [supName, setSupName] = useState(supplier.name);
  const [supContact, setSupContact] = useState(supplier.contactPerson || '');
  const [supEmail, setSupEmail] = useState(supplier.email || '');
  const [supPhone, setSupPhone] = useState(supplier.phone || '');
  const [supCity, setSupCity] = useState(supplier.city || '');
  const [supAddress, setSupAddress] = useState(supplier.addressLine1 || '');
  const [supCountry, setSupCountry] = useState(supplier.country || '');
  const [supTerms, setSupTerms] = useState(supplier.paymentTerms || 'Net 30');
  const [supTaxId, setSupTaxId] = useState(supplier.taxId || '');
  const [supNotes, setSupNotes] = useState(supplier.notes || '');
  const [supIsPreferred, setSupIsPreferred] = useState(supplier.isPreferred);

  // Item Mapping Form State
  const [mapItemId, setMapItemId] = useState<string>(
    availableItems[0]?.id || ''
  );
  const [mapSku, setMapSku] = useState('');
  const [mapPurchasingUnit, setMapPurchasingUnit] = useState('case');
  const [mapConversion, setMapConversion] = useState('1.0');
  const [mapPrice, setMapPrice] = useState('0.00');
  const [mapItemPreferred, setMapItemPreferred] = useState(true);

  // Price History Modal State
  const [historyItem, setHistoryItem] = useState<SupplierCatalogItemRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PriceHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  function handleOpenHistory(item: SupplierCatalogItemRecord) {
    setHistoryItem(item);
    setIsLoadingHistory(true);
    startTransition(async () => {
      const res = await getSupplierItemPriceHistoryAction(supplier.id, item.itemId);
      if (res.success) {
        setHistoryRecords(res.history);
      }
      setIsLoadingHistory(false);
    });
  }

  // Filter Catalog
  const filteredCatalog = supplier.catalog.filter(
    (item) =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplierSku && item.supplierSku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function openAddMappingModal() {
    setEditingItemRecord(null);
    const unmapped = availableItems.find(
      (ai) => !supplier.catalog.some((ci) => ci.itemId === ai.id)
    ) || availableItems[0];

    setMapItemId(unmapped?.id || '');
    setMapSku('');
    setMapPurchasingUnit('case');
    setMapConversion('1.0');
    setMapPrice(
      hasCostPermission && unmapped
        ? formatMinorUnitsToDecimal(unmapped.costPerUnitCents || 0)
        : '0.00'
    );
    setMapItemPreferred(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsMappingItem(true);
  }

  function openEditMappingModal(item: SupplierCatalogItemRecord) {
    setEditingItemRecord(item);
    setMapItemId(item.itemId);
    setMapSku(item.supplierSku || '');
    setMapPurchasingUnit(item.purchasingUnit);
    setMapConversion(String(item.conversionToBase));
    setMapPrice(
      item.lastPriceCents !== null
        ? formatMinorUnitsToDecimal(item.lastPriceCents)
        : '0.00'
    );
    setMapItemPreferred(item.isPreferred);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsMappingItem(true);
  }

  function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supName.trim()) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await updateSupplierAction({
        id: supplier.id,
        name: supName.trim(),
        contactPerson: supContact || null,
        email: supEmail || null,
        phone: supPhone || null,
        addressLine1: supAddress || null,
        city: supCity || null,
        country: supCountry || null,
        currency: supplier.currency,
        paymentTerms: supTerms || null,
        taxId: supTaxId || null,
        isPreferred: supIsPreferred,
        notes: supNotes || null,
      });

      if (res.success) {
        setIsEditingSupplier(false);
        setSuccessMsg('Supplier details updated successfully.');
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to update supplier.');
      }
    });
  }

  function handleSaveItemMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mapItemId || !mapPurchasingUnit.trim()) {
      setErrorMsg('Please select an item and enter a purchasing unit.');
      return;
    }

    const conv = Number(mapConversion);
    if (isNaN(conv) || conv <= 0) {
      setErrorMsg('Pack conversion factor must be a positive number.');
      return;
    }

    let priceCents = 0;
    try {
      priceCents = parseDecimalToMinorUnits(mapPrice);
      if (priceCents < 0) {
        setErrorMsg('Supplier price cannot be negative.');
        return;
      }
    } catch {
      setErrorMsg('Invalid price amount. Please enter a valid decimal number.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await upsertSupplierItemAction({
        supplierId: supplier.id,
        itemId: mapItemId,
        supplierSku: mapSku.trim() || null,
        purchasingUnit: mapPurchasingUnit.trim(),
        conversionToBase: conv,
        lastPriceCents: priceCents,
        currency: supplier.currency,
        isPreferred: mapItemPreferred,
      });

      if (res.success) {
        setIsMappingItem(false);
        setSuccessMsg(
          editingItemRecord
            ? 'Catalog item mapping updated successfully.'
            : 'New ingredient mapped to supplier catalog.'
        );
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to save catalog mapping.');
      }
    });
  }

  function handleRemoveItemMapping(itemId: string, itemName: string) {
    if (!confirm(`Are you sure you want to remove "${itemName}" from ${supplier.name}'s catalog?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await removeSupplierItemAction(supplier.id, itemId);
      if (res.success) {
        setSuccessMsg(`"${itemName}" removed from catalog.`);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to remove item mapping.');
      }
    });
  }

  const selectedItemOption = availableItems.find((i) => i.id === mapItemId);

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center justify-between">
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* Supplier Profile Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-zinc-950">{supplier.name}</h2>
                {supplier.isPreferred && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                    ★ Preferred Vendor
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  Active
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Currency: <span className="font-bold text-zinc-700">{supplier.currency}</span> • Terms: <span className="font-bold text-zinc-700">{supplier.paymentTerms || 'Standard'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href={`/dashboard/inventory/purchasing/new?supplierId=${supplier.id}`}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>📦</span> Create PO
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingSupplier(!isEditingSupplier)}
              className="text-xs font-bold"
            >
              {isEditingSupplier ? 'Cancel Edit' : '✏️ Edit Profile'}
            </Button>
          </div>
        </div>

        {/* Contact & Terms Breakdown */}
        {!isEditingSupplier ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Contact Person</span>
              <span className="font-semibold text-zinc-900">{supplier.contactPerson || '—'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Email Address</span>
              <span className="font-semibold text-zinc-900">{supplier.email ? `✉️ ${supplier.email}` : '—'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Phone</span>
              <span className="font-semibold text-zinc-900">{supplier.phone ? `📞 ${supplier.phone}` : '—'}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Location / City</span>
              <span className="font-semibold text-zinc-900">{supplier.city ? `📍 ${supplier.city}` : '—'}</span>
            </div>
            {supplier.addressLine1 && (
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Address</span>
                <span className="text-zinc-700">{supplier.addressLine1}</span>
              </div>
            )}
            {supplier.taxId && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tax / VAT ID</span>
                <span className="font-mono text-zinc-700">{supplier.taxId}</span>
              </div>
            )}
            {supplier.notes && (
              <div className="sm:col-span-4 space-y-1 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Notes & Ordering Instructions</span>
                <p className="text-zinc-700 text-[11px]">{supplier.notes}</p>
              </div>
            )}
          </div>
        ) : (
          /* Inline Supplier Edit Form */
          <form onSubmit={handleSaveSupplier} className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Edit Vendor Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Company Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Contact Person</label>
                <input
                  type="text"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Email Address</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Phone</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">City / Region</label>
                <input
                  type="text"
                  value={supCity}
                  onChange={(e) => setSupCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Payment Terms</label>
                <input
                  type="text"
                  value={supTerms}
                  onChange={(e) => setSupTerms(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Address</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Tax / VAT ID</label>
                <input
                  type="text"
                  value={supTaxId}
                  onChange={(e) => setSupTaxId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Country</label>
                <input
                  type="text"
                  value={supCountry}
                  onChange={(e) => setSupCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Notes & Ordering Instructions</label>
                <textarea
                  rows={2}
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  placeholder="e.g. Lead time 2 days, order before 2 PM"
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit-pref"
                checked={supIsPreferred}
                onChange={(e) => setSupIsPreferred(e.target.checked)}
                className="rounded text-zinc-950 focus:ring-zinc-950"
              />
              <label htmlFor="edit-pref" className="text-xs font-semibold text-zinc-700">
                Mark as Preferred Supplier for automatic replenishment
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditingSupplier(false)}
                disabled={isPending}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                {isPending ? 'Saving…' : 'Save Changes ✓'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Catalog & Linked Items Management Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
              <span>📋</span> Vendor Catalog & Linked Ingredients ({supplier.catalog.length})
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Map inventory ingredients to this supplier with vendor SKUs, pack sizes, and negotiated unit costs.
            </p>
          </div>

          <Button
            size="sm"
            onClick={openAddMappingModal}
            className="text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800 self-start sm:self-auto flex items-center gap-1.5"
          >
            <span>+</span> Map Ingredient
          </Button>
        </div>

        {/* Search Bar */}
        {supplier.catalog.length > 0 && (
          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by name or SKU..."
              className="w-full px-3 py-1.5 border border-zinc-300 rounded-xl text-xs bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        )}

        {/* Catalog Table */}
        {supplier.catalog.length === 0 ? (
          <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-10 text-center space-y-2">
            <span className="text-2xl">🥦</span>
            <h4 className="text-xs font-bold text-zinc-900 mt-1">No ingredients mapped to this vendor yet</h4>
            <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
              Link inventory items to {supplier.name} to track vendor pack sizes, auto-fill purchase order costs, and compare supplier options.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={openAddMappingModal}
                className="text-xs font-bold bg-zinc-900 text-white"
              >
                + Map First Ingredient
              </Button>
            </div>
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No catalog items matched &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                  <th className="py-2.5 px-3">Inventory Ingredient</th>
                  <th className="py-2.5 px-3">Vendor SKU</th>
                  <th className="py-2.5 px-3">Purchase Unit & Pack Size</th>
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Agreed Pack Price</th>}
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Normalized / Base Unit</th>}
                  <th className="py-2.5 px-3 text-center">Item Preference</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredCatalog.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <Link
                        href={`/dashboard/inventory/items/${item.itemId}`}
                        className="font-bold text-zinc-950 hover:underline hover:text-zinc-800 flex items-center gap-1.5"
                      >
                        <span>🥦</span>
                        <span>{item.itemName}</span>
                      </Link>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-zinc-600">
                      {item.supplierSku || '—'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-zinc-900 capitalize">{item.purchasingUnit}</span>
                      {item.conversionToBase !== 1 && (
                        <span className="text-[10px] text-zinc-400 block font-mono">
                          (1 {item.purchasingUnit} = {item.conversionToBase} {item.itemBaseUnit})
                        </span>
                      )}
                    </td>

                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-mono text-zinc-700">
                        {item.lastPriceCents !== null
                          ? `${formatCurrencyMinor(item.lastPriceCents, item.currency)} / ${item.purchasingUnit}`
                          : '—'}
                      </td>
                    )}

                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-mono font-black text-zinc-950">
                        {item.normalizedPricePerBaseCents !== null
                          ? `${formatCurrencyMinor(item.normalizedPricePerBaseCents, item.currency)} / ${item.itemBaseUnit}`
                          : '—'}
                      </td>
                    )}

                    <td className="py-3 px-3 text-center">
                      {item.isPreferred ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          ★ Preferred Vendor
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Secondary</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(item)}
                        className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        📊 History
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditMappingModal(item)}
                        className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemMapping(item.itemId, item.itemName)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Map Ingredient Modal / Dialog */}
      {isMappingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950 flex items-center gap-2">
                <span>🏷️</span> {editingItemRecord ? 'Edit Ingredient Mapping' : 'Map Ingredient to Catalog'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMappingItem(false)}
                className="text-zinc-400 hover:text-zinc-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveItemMapping} className="space-y-4 text-xs">
              {/* Select Item */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-700">Inventory Stock Item *</label>
                <select
                  disabled={editingItemRecord !== null}
                  value={mapItemId}
                  onChange={(e) => {
                    const itmId = e.target.value;
                    setMapItemId(itmId);
                    const itm = availableItems.find((i) => i.id === itmId);
                    if (itm && hasCostPermission && !editingItemRecord) {
                      setMapPrice(formatMinorUnitsToDecimal(itm.costPerUnitCents || 0));
                    }
                  }}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-medium bg-white disabled:bg-zinc-100"
                >
                  {availableItems.map((ai) => (
                    <option key={ai.id} value={ai.id}>
                      {ai.name} (Base Unit: {ai.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor SKU */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-700">Vendor SKU / Product Code</label>
                <input
                  type="text"
                  value={mapSku}
                  onChange={(e) => setMapSku(e.target.value)}
                  placeholder="e.g. FFS-CHK-10"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-medium"
                />
              </div>

              {/* Purchasing Unit & Conversion */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700">Purchasing Unit *</label>
                  <select
                    value={mapPurchasingUnit}
                    onChange={(e) => setMapPurchasingUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-medium bg-white"
                  >
                    {Object.keys(STANDARD_UNITS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    {!Object.keys(STANDARD_UNITS).includes(mapPurchasingUnit) && (
                      <option value={mapPurchasingUnit}>{mapPurchasingUnit}</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700">
                    Pack Size ({selectedItemOption?.baseUnit || 'base'} per {mapPurchasingUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={mapConversion}
                    onChange={(e) => setMapConversion(e.target.value)}
                    placeholder="e.g. 10.0"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Vendor Price */}
              <div className="space-y-1">
                <label className="font-bold text-zinc-700">
                  Negotiated Price ({getCurrencySymbol(supplier.currency)} per {mapPurchasingUnit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={mapPrice}
                  onChange={(e) => setMapPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl font-mono font-bold"
                />
                {Number(mapConversion) > 0 && selectedItemOption && (
                  <span className="text-[10px] text-zinc-400 block font-mono">
                    Normalized: ~{formatCurrencyMinor(Math.round(parseDecimalToMinorUnits(mapPrice || '0') / (Number(mapConversion) || 1)), supplier.currency)} / {selectedItemOption.baseUnit}
                  </span>
                )}
              </div>

              {/* Preferred toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="map-pref"
                  checked={mapItemPreferred}
                  onChange={(e) => setMapItemPreferred(e.target.checked)}
                  className="rounded text-zinc-950 focus:ring-zinc-950"
                />
                <label htmlFor="map-pref" className="font-semibold text-zinc-700">
                  Mark as Preferred Supplier for {selectedItemOption?.name || 'this item'}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMappingItem(false)}
                  disabled={isPending}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white px-5"
                >
                  {isPending ? 'Saving…' : 'Save Item Mapping ✓'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Inspection Modal */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-950 flex items-center gap-2">
                  <span>📈</span> Price History: {historyItem.itemName}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Historical contract prices and received costs with {supplier.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                className="text-zinc-400 hover:text-zinc-800 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {isLoadingHistory ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-medium">
                  Loading price history…
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-1">
                  <span className="text-2xl">📊</span>
                  <h4 className="text-xs font-bold text-zinc-800">No Historical Records Found</h4>
                  <p className="text-[11px] text-zinc-500">
                    No historical price updates recorded yet for this item with this supplier.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">Pack / Unit</th>
                        {hasCostPermission && <th className="py-2.5 px-3 text-right">Pack Price</th>}
                        {hasCostPermission && <th className="py-2.5 px-3 text-right">Normalized</th>}
                        {hasCostPermission && <th className="py-2.5 px-3 text-right">Change</th>}
                        <th className="py-2.5 px-3">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {historyRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-zinc-50/50">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                            {new Date(rec.recordedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                rec.sourceType === 'catalog'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : rec.sourceType === 'goods_receipt'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : rec.sourceType === 'purchase_order'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                              }`}
                            >
                              {rec.sourceType === 'catalog'
                                ? '🏷️ Catalog'
                                : rec.sourceType === 'goods_receipt'
                                ? '🚚 GRN'
                                : rec.sourceType === 'purchase_order'
                                ? '📦 PO'
                                : 'Manual'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-zinc-900 capitalize">{rec.purchasingUnit}</span>
                            {rec.conversionToBase !== 1 && (
                              <span className="text-[10px] text-zinc-400 block font-mono">
                                (1 {rec.purchasingUnit} = {rec.conversionToBase} {rec.baseUnit})
                              </span>
                            )}
                          </td>
                          {hasCostPermission && (
                            <td className="py-2.5 px-3 text-right font-mono text-zinc-700 whitespace-nowrap">
                              {rec.packPriceCents !== null
                                ? `${formatCurrencyMinor(rec.packPriceCents, rec.currency)} / ${rec.purchasingUnit}`
                                : '—'}
                            </td>
                          )}
                          {hasCostPermission && (
                            <td className="py-2.5 px-3 text-right font-mono font-black text-zinc-950 whitespace-nowrap">
                              {rec.normalizedPricePerBaseCents !== null
                                ? `${formatCurrencyMinor(rec.normalizedPricePerBaseCents, rec.currency)} / ${rec.baseUnit}`
                                : '—'}
                            </td>
                          )}
                          {hasCostPermission && (
                            <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                              {rec.changeVsPreviousCents !== null &&
                              rec.changeVsPreviousCents !== undefined ? (
                                <span
                                  className={`text-[11px] font-bold ${
                                    rec.changeVsPreviousCents < 0
                                      ? 'text-emerald-700'
                                      : rec.changeVsPreviousCents > 0
                                      ? 'text-rose-700'
                                      : 'text-zinc-500'
                                  }`}
                                >
                                  {rec.changeVsPreviousCents < 0 ? '↓ ' : rec.changeVsPreviousCents > 0 ? '↑ +' : '● '}
                                  {formatCurrencyMinor(Math.abs(rec.changeVsPreviousCents), rec.currency)}
                                  {rec.changeVsPreviousPercentage !== null &&
                                    rec.changeVsPreviousPercentage !== undefined &&
                                    ` (${rec.changeVsPreviousPercentage > 0 ? '+' : ''}${rec.changeVsPreviousPercentage}%)`}
                                </span>
                              ) : (
                                <span className="text-zinc-400 text-[11px]">First Record</span>
                              )}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-[11px] text-zinc-500 max-w-xs truncate">
                            {rec.referenceNumber ? (
                              <span className="font-mono font-bold text-zinc-700 mr-1.5">
                                {rec.referenceNumber}
                              </span>
                            ) : null}
                            {rec.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryItem(null)}
                className="text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

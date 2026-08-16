'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormattedInventoryCategory, FormattedStorageLocation } from '@/server/services/inventory.service';
import { createInventoryItemAction } from '@/server/actions/inventory';
import { InventoryItemType } from '@/lib/validation/inventory';

interface InventoryItemFormProps {
  categories: FormattedInventoryCategory[];
  locations: FormattedStorageLocation[];
  defaultCurrency: string;
}

export function InventoryItemForm({
  categories,
  locations,
  defaultCurrency,
}: InventoryItemFormProps) {
  const router = useRouter();

  // Basic Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [initialLocationId, setInitialLocationId] = useState(
    locations.find((l) => l.isDefault)?.id || locations[0]?.id || ''
  );

  // Advanced Fields Drawer
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<InventoryItemType>('raw_ingredient');
  const [targetStockLevel, setTargetStockLevel] = useState('');
  const [trackBatches, setTrackBatches] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Item name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const costCents = Math.round((parseFloat(costPerUnit) || 0) * 100);
    const minStock = parseFloat(minStockLevel) || 0;
    const targetStock = parseFloat(targetStockLevel) || 0;
    const initialQty = parseFloat(initialQuantity) || 0;

    const res = await createInventoryItemAction({
      name: name.trim(),
      categoryId: categoryId || null,
      baseUnit,
      costPerUnitCents: costCents,
      minStockLevel: minStock,
      targetStockLevel: targetStock,
      initialQuantity: initialQty,
      initialLocationId: initialLocationId || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      description: description.trim() || null,
      itemType,
      trackBatches,
      trackExpiry,
    });

    setIsSubmitting(false);

    if (res.success) {
      if ('item' in res && res.item && typeof res.item === 'object' && 'id' in res.item && res.item.id) {
        router.push(`/dashboard/inventory/items/${res.item.id}`);
      } else {
        router.push('/dashboard/inventory/items');
      }
      router.refresh();
    } else {
      setErrorMsg(res.message || 'Failed to create inventory item.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white border border-zinc-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* 1. Basic Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-800 mb-1">
            Ingredient / Item Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Chicken Breast, Whole Milk, Basmati Rice"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 font-bold min-h-[44px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Base Unit */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">
              Base Unit <span className="text-rose-500">*</span>
            </label>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 font-bold min-h-[44px]"
            >
              <optgroup label="Weight">
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
              </optgroup>
              <optgroup label="Volume">
                <option value="l">Litre (L)</option>
                <option value="ml">Millilitre (ml)</option>
              </optgroup>
              <optgroup label="Count">
                <option value="pcs">Pieces (pcs)</option>
                <option value="bottle">Bottle</option>
                <option value="can">Can</option>
                <option value="pack">Pack</option>
                <option value="box">Box</option>
                <option value="portion">Portion</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Estimated Unit Cost */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">
              Unit Cost ({defaultCurrency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Cost per 1 {baseUnit}</p>
          </div>

          {/* Low Stock Threshold */}
          <div>
            <label className="block text-xs font-bold text-zinc-800 mb-1">
              Low Stock Alert Level ({baseUnit})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={minStockLevel}
              onChange={(e) => setMinStockLevel(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            />
            <p className="text-[10px] text-zinc-400 mt-1">Triggers low stock badge when balance drops below this</p>
          </div>
        </div>

        {/* Opening Stock (Convenient Setup) */}
        <div className="pt-3 border-t border-zinc-100 space-y-3">
          <div>
            <span className="text-xs font-bold text-zinc-900 block">Opening Stock Balance</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Enter the quantity currently available at this location. This creates the opening stock balance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">
                Initial Stock Count (Optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                  className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px] pr-12"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                  {baseUnit}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-1">Storage Location</label>
              <select
                value={initialLocationId}
                onChange={(e) => setInitialLocationId(e.target.value)}
                className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.isDefault ? '(Main)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Advanced Settings Drawer Toggle */}
      <div className="pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-bold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5 cursor-pointer py-1"
        >
          <span>{showAdvanced ? '▴ Hide' : '▾ Show'} Advanced Settings</span>
          <span className="text-[10px] text-zinc-400">(SKU, Barcode, Batches & Expiry)</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">SKU / Code</label>
                <input
                  type="text"
                  placeholder="e.g. ING-CHK-01"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Barcode / UPC</label>
                <input
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Item Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Grade A frozen chicken breast"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Item Classification</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as InventoryItemType)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
              >
                <option value="raw_ingredient">Raw Ingredient</option>
                <option value="semi_finished">Semi-Finished Prep / Batch</option>
                <option value="finished_item">Finished Retail / Bottled Item</option>
                <option value="packaging">Packaging & Disposable</option>
                <option value="operational_supply">Operational Supply</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Optimal Target Stock Level ({baseUnit})</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Optimal par level"
                value={targetStockLevel}
                onChange={(e) => setTargetStockLevel(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
              />
            </div>

            {/* Tracking Switches */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackBatches}
                  onChange={(e) => setTrackBatches(e.target.checked)}
                  className="w-4 h-4 rounded-md border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                />
                <span className="text-xs font-bold text-zinc-800">Track Batches & Lot Numbers</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackExpiry}
                  onChange={(e) => setTrackExpiry(e.target.checked)}
                  className="w-4 h-4 rounded-md border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                />
                <span className="text-xs font-bold text-zinc-800">Track Expiration Dates</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
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
          {isSubmitting ? 'Saving...' : 'Save Ingredient'}
        </Button>
      </div>
    </form>
  );
}

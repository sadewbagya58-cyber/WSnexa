'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FormattedInventoryItem, FormattedInventoryCategory, FormattedStorageLocation } from '@/server/services/inventory.service';
import { InventoryAdjustmentModal } from './inventory-adjustment-modal';
import { InventoryWasteModal } from './inventory-waste-modal';

interface InventoryItemsTableProps {
  items: FormattedInventoryItem[];
  categories: FormattedInventoryCategory[];
  locations: FormattedStorageLocation[];
  currency?: string;
  hasCostPermission?: boolean;
  canManageItems?: boolean;
  canAdjust?: boolean;
  canWaste?: boolean;
}

export function InventoryItemsTable({
  items,
  categories,
  locations,
  currency = 'USD',
  hasCostPermission = false,
  canManageItems = true,
  canAdjust = true,
  canWaste = true,
}: InventoryItemsTableProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal states
  const [adjustItem, setAdjustItem] = useState<FormattedInventoryItem | null>(null);
  const [wasteItem, setWasteItem] = useState<FormattedInventoryItem | null>(null);

  const filtered = items.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
    if (selectedStatus !== 'all' && item.stockStatus !== selectedStatus) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku?.toLowerCase().includes(q);
      const matchBarcode = item.barcode?.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchBarcode) return false;
    }
    return true;
  });

  const formatCurrency = (cents: number | null, itemCurrency?: string) => {
    if (cents === null) return '—';
    const effectiveCurrency = itemCurrency || currency || 'USD';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: effectiveCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${effectiveCurrency} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex-1 flex flex-wrap gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by ingredient, SKU, barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
          >
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>

        {canManageItems && (
          <Link href="/dashboard/inventory/items/new">
            <Button size="sm" className="w-full sm:w-auto font-bold text-xs min-h-[40px]">
              + Add Ingredient
            </Button>
          </Link>
        )}
      </div>

      {/* Items Table / Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center">
          <span className="text-3xl">🥦</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">No inventory items found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            {query || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? 'No ingredients match the selected filters. Try clearing search filters.'
              : 'Add your first ingredient or raw material to begin tracking stock levels.'}
          </p>
          {canManageItems && (
            <div className="mt-4">
              <Link href="/dashboard/inventory/items/new">
                <Button size="sm" className="font-bold text-xs">
                  Add Inventory Item
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Stacked Cards View (visible on < md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((item) => {
              const stockQty = item.currentStockQuantity !== undefined ? item.currentStockQuantity : 0;
              const activeLocations = (item.locationBalances || []).filter((l) => l.quantity > 0);

              return (
                <div
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  {/* Card Header: Item Name, Category & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/inventory/items/${item.id}`}
                        className="font-bold text-zinc-950 hover:underline text-sm truncate block"
                      >
                        {item.name}
                      </Link>
                      <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{item.categoryName || 'Uncategorized'}</span>
                        {item.sku && <span>• SKU: {item.sku}</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.stockStatus === 'out_of_stock' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Out of Stock
                        </span>
                      ) : item.stockStatus === 'low_stock' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Metrics & Locations */}
                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-zinc-500 text-[11px] font-medium">On-Hand Stock:</span>
                      <div className="font-bold text-zinc-950 text-sm flex items-baseline gap-1">
                        <span>{stockQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        <span className="text-xs font-semibold text-zinc-500">{item.baseUnit}</span>
                      </div>
                    </div>

                    {item.minStockLevel > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-zinc-500 border-t border-zinc-200/50 pt-1.5">
                        <span>Min Threshold:</span>
                        <span className="font-mono font-medium">{item.minStockLevel} {item.baseUnit}</span>
                      </div>
                    )}

                    {hasCostPermission && (
                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/50 pt-1.5">
                        <div>
                          <span className="text-[10px] text-zinc-400 block uppercase font-bold">Unit Cost</span>
                          <span className="font-mono text-zinc-800 font-semibold">
                            {formatCurrency(item.costPerUnitCents, item.currency)}
                            <span className="text-[10px] text-zinc-400 font-normal">/{item.baseUnit}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block uppercase font-bold">Stock Value</span>
                          <span className="font-mono text-zinc-950 font-bold">
                            {formatCurrency(item.totalStockValueCents || 0, item.currency)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Location breakdown */}
                    {activeLocations.length > 0 && (
                      <div className="border-t border-zinc-200/50 pt-1.5">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold mb-1">Locations</span>
                        <div className="flex flex-wrap gap-1">
                          {activeLocations.map((loc) => (
                            <span
                              key={loc.locationId}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-white text-[10px] text-zinc-700 font-medium border border-zinc-200"
                            >
                              📍 {loc.locationName}: {loc.quantity} {item.baseUnit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/dashboard/inventory/items/${item.id}`}
                      className="text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition-colors flex-1 text-center min-h-[38px] flex items-center justify-center"
                    >
                      View Details →
                    </Link>
                    {canAdjust && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAdjustItem(item)}
                        className="text-xs font-bold px-3 py-2 min-h-[38px] rounded-xl flex-1"
                      >
                        Adjust
                      </Button>
                    )}
                    {canWaste && (
                      <button
                        type="button"
                        onClick={() => setWasteItem(item)}
                        className="text-xs font-bold text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 cursor-pointer min-h-[38px] flex-1 text-center transition-colors"
                      >
                        Waste
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (visible on md+) */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Item & Category</th>
                    <th className="py-3 px-4">Current Stock</th>
                    <th className="py-3 px-4">Status</th>
                    {hasCostPermission && <th className="py-3 px-4">Unit Cost</th>}
                    {hasCostPermission && <th className="py-3 px-4">Stock Value</th>}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {filtered.map((item) => {
                    const stockQty = item.currentStockQuantity !== undefined ? item.currentStockQuantity : 0;
                    const activeLocations = (item.locationBalances || []).filter((l) => l.quantity > 0);

                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/dashboard/inventory/items/${item.id}`}
                            className="font-bold text-zinc-950 hover:underline flex items-center gap-1.5"
                          >
                            {item.name}
                          </Link>
                          <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                            <span>{item.categoryName || 'Uncategorized'}</span>
                            {item.sku && <span>• SKU: {item.sku}</span>}
                            <span>•</span>
                            <Link href="/dashboard/inventory/recipes" className="text-emerald-700 hover:underline font-bold">
                              📖 View Recipes →
                            </Link>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-900 text-sm flex items-baseline gap-1">
                            <span>{stockQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                            <span className="text-xs font-semibold text-zinc-500">{item.baseUnit}</span>
                          </div>

                          {/* Location breakdown if stock is distributed or single location */}
                          {activeLocations.length > 1 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {activeLocations.map((loc) => (
                                <span
                                  key={loc.locationId}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] text-zinc-600 font-medium"
                                >
                                  {loc.locationName}: {loc.quantity} {item.baseUnit}
                                </span>
                              ))}
                            </div>
                          ) : activeLocations.length === 1 ? (
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              At {activeLocations[0].locationName}
                            </div>
                          ) : (
                            <div className="text-[10px] text-zinc-400 mt-0.5">0 {item.baseUnit} available</div>
                          )}

                          {item.minStockLevel > 0 && (
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              Min threshold: {item.minStockLevel} {item.baseUnit}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {item.stockStatus === 'out_of_stock' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Out of Stock
                            </span>
                          ) : item.stockStatus === 'low_stock' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              In Stock
                            </span>
                          )}
                        </td>

                        {hasCostPermission && (
                          <td className="py-3.5 px-4 text-zinc-700">
                            {formatCurrency(item.costPerUnitCents, item.currency)}
                            <span className="text-[10px] text-zinc-400">/{item.baseUnit}</span>
                          </td>
                        )}

                        {hasCostPermission && (
                          <td className="py-3.5 px-4 font-bold text-zinc-900">
                            {formatCurrency(item.totalStockValueCents || 0, item.currency)}
                          </td>
                        )}

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAdjust && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAdjustItem(item)}
                                className="h-7 text-xs font-bold px-2.5"
                              >
                                Adjust
                              </Button>
                            )}
                            {canWaste && (
                              <button
                                type="button"
                                onClick={() => setWasteItem(item)}
                                className="h-7 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 rounded-md border border-rose-200 cursor-pointer"
                              >
                                Waste
                              </button>
                            )}
                            {!canAdjust && !canWaste && (
                              <Link
                                href={`/dashboard/inventory/items/${item.id}`}
                                className="text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:underline"
                              >
                                View →
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <InventoryAdjustmentModal
          item={adjustItem}
          locations={locations}
          onClose={() => setAdjustItem(null)}
        />
      )}

      {/* Waste Modal */}
      {wasteItem && (
        <InventoryWasteModal
          item={wasteItem}
          locations={locations}
          onClose={() => setWasteItem(null)}
        />
      )}
    </div>
  );
}

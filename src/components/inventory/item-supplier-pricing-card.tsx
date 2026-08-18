'use client';

import React from 'react';
import Link from 'next/link';
import { ItemSupplierPriceComparisonPayload } from '@/server/services/purchasing.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface ItemSupplierPricingCardProps {
  comparison: ItemSupplierPriceComparisonPayload | null;
  hasCostPermission?: boolean;
}

export function ItemSupplierPricingCard({
  comparison,
  hasCostPermission = false,
}: ItemSupplierPricingCardProps) {
  if (!comparison || comparison.totalSuppliersCount === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Supplier Price Comparison (0)
          </h3>
          <Link
            href="/dashboard/inventory/suppliers"
            className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 underline"
          >
            Manage Suppliers →
          </Link>
        </div>
        <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-8 text-center space-y-2">
          <span className="text-2xl">🏢</span>
          <h4 className="text-xs font-bold text-zinc-900 mt-1">No supplier mappings found</h4>
          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
            Link this ingredient to suppliers in your Supplier Directory to compare vendor pack sizes, track purchasing units, and calculate potential cost savings.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/inventory/suppliers"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <span>+</span> Map Supplier Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const primaryGroup = comparison.groups[0];
  const cheapestNormalized = primaryGroup?.cheapestNormalizedCents;
  const potentialSavings = primaryGroup?.potentialSavingsCents;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs space-y-5 p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-2">
            <span>🏢</span> Supplier Price Comparison ({comparison.totalSuppliersCount})
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Normalized purchasing unit costs and vendor pricing across linked suppliers.
          </p>
        </div>

        <Link
          href={`/dashboard/inventory/purchasing/new?itemId=${comparison.itemId}`}
          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all self-start sm:self-auto flex items-center gap-1.5"
        >
          <span>📦</span> Create Purchase Order
        </Link>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Linked Vendors</span>
          <div className="text-sm font-black text-zinc-950 mt-0.5">{comparison.totalSuppliersCount} Suppliers</div>
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Best Normalized Price</span>
          <div className="text-sm font-black text-emerald-700 mt-0.5">
            {hasCostPermission && cheapestNormalized !== null && primaryGroup
              ? `${formatCurrencyMinor(cheapestNormalized, primaryGroup.currency)} / ${comparison.baseUnit}`
              : '—'}
          </div>
          {primaryGroup?.cheapestSupplierName && (
            <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
              via {primaryGroup.cheapestSupplierName}
            </span>
          )}
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Preferred Vendor</span>
          <div className="text-sm font-black text-zinc-900 mt-0.5 truncate">
            {primaryGroup?.preferredSupplierName || 'None'}
          </div>
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Potential Unit Savings</span>
          <div className={`text-sm font-black mt-0.5 ${potentialSavings && potentialSavings > 0 ? 'text-emerald-600' : 'text-zinc-900'}`}>
            {hasCostPermission && potentialSavings && potentialSavings > 0 && primaryGroup
              ? `Save ${formatCurrencyMinor(potentialSavings, primaryGroup.currency)} / ${comparison.baseUnit}`
              : 'Optimal / None'}
          </div>
        </div>
      </div>

      {/* Comparison Tables per Currency Group */}
      {comparison.groups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-2">
          {comparison.groups.length > 1 && (
            <div className="text-xs font-bold text-zinc-600 flex items-center gap-1.5 pt-1">
              <span>💱</span> Pricing in {group.currency}
            </div>
          )}

          {/* Mobile Comparison Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {group.suppliers.map((s) => (
              <div
                key={s.supplierId}
                className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 ${
                  s.isCheapest ? 'border-emerald-300 bg-emerald-50/10' : 'border-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-zinc-950 text-sm block truncate">{s.supplierName}</span>
                    {s.supplierSku && (
                      <span className="text-[11px] text-zinc-400 font-mono mt-0.5 block">SKU: {s.supplierSku}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {s.isCheapest && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                        🏷️ Best Price
                      </span>
                    )}
                    {s.isPreferred && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                        ★ Preferred
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-zinc-500 text-[11px] font-medium">Purchasing Unit & Pack:</span>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 capitalize">{s.purchasingUnit}</span>
                      {s.conversionToBase !== 1 && (
                        <span className="text-[10px] text-zinc-400 block font-mono">
                          (1 {s.purchasingUnit} = {s.conversionToBase} {comparison.baseUnit})
                        </span>
                      )}
                    </div>
                  </div>

                  {hasCostPermission && (
                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/50 pt-1.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Pack Price</span>
                        <span className="font-mono text-zinc-800 font-semibold">
                          {s.lastPriceCents !== null
                            ? `${formatCurrencyMinor(s.lastPriceCents, s.currency)}`
                            : '—'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Normalized Cost</span>
                        <span className="font-mono text-zinc-950 font-bold">
                          {s.normalizedPricePerBaseCents !== null
                            ? `${formatCurrencyMinor(s.normalizedPricePerBaseCents, s.currency)} / ${comparison.baseUnit}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {hasCostPermission && (
                    <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                      <span className="text-zinc-500">Variance vs Best:</span>
                      {s.isCheapest ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Cheapest
                        </span>
                      ) : s.priceDifferenceCents !== null && s.priceDifferenceCents !== undefined && s.priceDifferenceCents > 0 ? (
                        <span className="font-bold text-rose-600">
                          +{formatCurrencyMinor(s.priceDifferenceCents, s.currency)} (+{s.percentagePremium}%)
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[11px] text-zinc-500 border-t border-zinc-200/50 pt-1.5">
                    <span>Terms:</span>
                    <span>{s.paymentTerms || 'Standard'}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <Link
                    href={`/dashboard/inventory/purchasing/new?supplierId=${s.supplierId}&itemId=${comparison.itemId}`}
                    className="w-full text-xs font-bold text-zinc-900 hover:text-white bg-zinc-100 hover:bg-zinc-950 px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[38px] shadow-xs"
                  >
                    <span>Create Purchase Order</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Comparison Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Vendor SKU</th>
                  <th className="py-2.5 px-3">Purchase Unit & Pack</th>
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Vendor Price</th>}
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Normalized / {comparison.baseUnit}</th>}
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Variance vs Best</th>}
                  <th className="py-2.5 px-3 text-right">Payment Terms</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {group.suppliers.map((s) => (
                  <tr
                    key={s.supplierId}
                    className={`hover:bg-zinc-50/50 transition-colors ${
                      s.isCheapest ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-950">{s.supplierName}</span>
                        {s.isPreferred && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                            ★ Preferred
                          </span>
                        )}
                        {s.isCheapest && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            🏷️ Best Price
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-zinc-500 text-[11px]">
                      {s.supplierSku || '—'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-zinc-900 capitalize">{s.purchasingUnit}</span>
                      {s.conversionToBase !== 1 && (
                        <span className="text-[10px] text-zinc-400 block font-mono">
                          (1 {s.purchasingUnit} = {s.conversionToBase} {comparison.baseUnit})
                        </span>
                      )}
                    </td>

                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-mono text-zinc-700">
                        {s.lastPriceCents !== null
                          ? `${formatCurrencyMinor(s.lastPriceCents, s.currency)} / ${s.purchasingUnit}`
                          : '—'}
                      </td>
                    )}

                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-mono font-black text-zinc-950">
                        <div>
                          {s.normalizedPricePerBaseCents !== null
                            ? `${formatCurrencyMinor(s.normalizedPricePerBaseCents, s.currency)} / ${comparison.baseUnit}`
                            : '—'}
                        </div>
                        {s.priceTrendDirection && s.priceTrendDirection !== 'new' && (
                          <div className="text-[10px] font-sans font-bold mt-0.5">
                            {s.priceTrendDirection === 'down' ? (
                              <span className="text-emerald-700">↓ {s.priceTrendPercentage}% vs prior</span>
                            ) : s.priceTrendDirection === 'up' ? (
                              <span className="text-rose-600">↑ +{s.priceTrendPercentage}% vs prior</span>
                            ) : (
                              <span className="text-zinc-400">● Stable</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right">
                        {s.isCheapest ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Cheapest
                          </span>
                        ) : s.priceDifferenceCents !== null && s.priceDifferenceCents !== undefined && s.priceDifferenceCents > 0 ? (
                          <span className="text-[11px] font-bold text-rose-600">
                            +{formatCurrencyMinor(s.priceDifferenceCents, s.currency)} (+{s.percentagePremium}%)
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>
                    )}

                    <td className="py-3 px-3 text-right text-zinc-500 text-[11px]">
                      {s.paymentTerms || 'Standard'}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/dashboard/inventory/purchasing/new?supplierId=${s.supplierId}&itemId=${comparison.itemId}`}
                        className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg transition-colors inline-block"
                      >
                        Order →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

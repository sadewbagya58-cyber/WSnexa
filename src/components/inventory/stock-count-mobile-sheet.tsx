'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormattedStockCount } from '@/server/services/inventory.service';
import { submitStockCountAction, approveStockCountAction } from '@/server/actions/inventory';

interface StockCountMobileSheetProps {
  count: FormattedStockCount;
  canApprove: boolean;
  hasCostPermission?: boolean;
}

export function StockCountMobileSheet({
  count,
  canApprove,
  hasCostPermission = false,
}: StockCountMobileSheetProps) {
  const router = useRouter();
  const items = count.items || [];

  // Local state for counted values
  const [countsMap, setCountsMap] = useState<Record<string, { raw: string; unit: string; notes: string }>>(() => {
    const initial: Record<string, { raw: string; unit: string; notes: string }> = {};
    items.forEach((it) => {
      initial[it.itemId] = {
        raw: it.countedRawQuantity !== null && it.countedRawQuantity !== undefined ? it.countedRawQuantity.toString() : '',
        unit: it.countedUnit || it.baseUnit,
        notes: it.notes || '',
      };
    });
    return initial;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeItem = items[currentIndex];

  const handleInputChange = (itemId: string, field: 'raw' | 'unit' | 'notes', val: string) => {
    setCountsMap((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val,
      },
    }));
  };

  const countedCount = Object.values(countsMap).filter((c) => c.raw.trim() !== '').length;

  const handleSubmitCount = async () => {
    setIsSubmitting(true);
    setFeedbackMsg(null);

    const formattedEntries = items
      .filter((it) => countsMap[it.itemId]?.raw.trim() !== '')
      .map((it) => ({
        itemId: it.itemId,
        countedRawQuantity: parseFloat(countsMap[it.itemId].raw) || 0,
        countedUnit: countsMap[it.itemId].unit || it.baseUnit,
        notes: countsMap[it.itemId].notes || null,
      }));

    if (formattedEntries.length === 0) {
      setIsSubmitting(false);
      setFeedbackMsg({ type: 'error', text: 'Please enter a count for at least one item.' });
      return;
    }

    const res = await submitStockCountAction({
      countId: count.id,
      items: formattedEntries,
    });

    setIsSubmitting(false);

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Stock count submitted successfully for manager review.' });
      router.refresh();
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to submit count.' });
    }
  };

  const handleApproveCount = async () => {
    if (!confirm('Are you sure you want to approve this stock count? This will automatically generate variance stock movements and update your inventory balances.')) {
      return;
    }

    setIsApproving(true);
    setFeedbackMsg(null);

    const res = await approveStockCountAction(count.id);
    setIsApproving(false);

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Stock count approved and inventory balances reconciled!' });
      router.refresh();
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Failed to approve count.' });
    }
  };

  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null || cents === undefined) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${currency || 'USD'} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Info Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
              {count.countNumber}
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                count.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : count.status === 'submitted'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {count.status}
            </span>
            {count.isBlindCount && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Blind Count
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-black text-zinc-950">{count.title}</h1>
          <p className="text-xs text-zinc-500">
            Storage Location: <strong className="text-zinc-800 font-bold">{count.locationName}</strong> • Category: <strong className="text-zinc-800 font-bold">{count.categoryName}</strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          {count.status === 'counting' && (
            <Button
              onClick={handleSubmitCount}
              disabled={isSubmitting || countedCount === 0 || items.length === 0}
              className="w-full sm:w-auto text-xs font-bold bg-zinc-950 text-white min-h-[44px] px-5 shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : `Submit Count (${countedCount}/${items.length})`}
            </Button>
          )}

          {count.status === 'submitted' && canApprove && (
            <Button
              onClick={handleApproveCount}
              disabled={isApproving || items.length === 0}
              className="w-full sm:w-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] px-5 shadow-xs cursor-pointer"
            >
              {isApproving ? 'Reconciling...' : 'Approve & Reconcile'}
            </Button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Counting Stepper (Active Item Card) */}
      {count.status === 'counting' && activeItem && (
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-5 sm:p-7 shadow-md space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold">
            <span>ITEM {currentIndex + 1} OF {items.length}</span>
            <span>{Math.round((countedCount / items.length) * 100)}% Complete</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-zinc-950 h-full transition-all duration-300 rounded-full"
              style={{ width: `${items.length > 0 ? (countedCount / items.length) * 100 : 0}%` }}
            />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 break-words">{activeItem.itemName}</h2>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Unit of Measure: <strong className="text-zinc-900">{activeItem.baseUnit}</strong>
              {!count.isBlindCount && activeItem.expectedQuantityBase !== null && (
                <span className="ml-3 text-zinc-500">
                  (Expected on record: <strong className="text-zinc-800">{activeItem.expectedQuantityBase} {activeItem.baseUnit}</strong>)
                </span>
              )}
            </p>
          </div>

          {/* Big Tactile Numeric Input */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
              Enter Physical Count
            </label>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                autoFocus
                placeholder="0.00"
                value={countsMap[activeItem.itemId]?.raw || ''}
                onChange={(e) => handleInputChange(activeItem.itemId, 'raw', e.target.value)}
                className="flex-1 text-2xl sm:text-3xl font-black bg-zinc-50 border-2 border-zinc-200 rounded-2xl px-4 py-3 text-zinc-950 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[58px]"
              />
              <span className="text-sm sm:text-base font-black text-zinc-600 bg-zinc-100 px-4 py-3 rounded-2xl min-h-[58px] flex items-center justify-center min-w-16">
                {activeItem.baseUnit}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <input
              type="text"
              placeholder="Add observation or count note (optional)"
              value={countsMap[activeItem.itemId]?.notes || ''}
              onChange={(e) => handleInputChange(activeItem.itemId, 'notes', e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[44px]"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="text-xs font-bold min-h-[44px] px-4"
            >
              ← Previous
            </Button>

            {currentIndex < items.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1))}
                className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-h-[44px] px-6 cursor-pointer"
              >
                Next Item →
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitCount}
                disabled={isSubmitting || countedCount === 0}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] px-6 cursor-pointer"
              >
                Submit Audit Sheet ✓
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Count Sheet Items Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Count Sheet Items ({items.length})
          </h3>
          <span className="text-[11px] text-zinc-400 font-medium">
            {countedCount} of {items.length} counted
          </span>
        </div>

        {items.length === 0 ? (
          /* Empty State when 0 items */
          <div className="p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-2xl">
              📦
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-zinc-950">Nothing to count</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                No inventory items matched this audit scope (<strong>{count.categoryName}</strong>) and storage location (<strong>{count.locationName}</strong>).
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard/inventory/counts/new">
                <Button variant="outline" size="sm" className="text-xs font-bold min-h-[40px]">
                  Adjust Audit Scope
                </Button>
              </Link>
              <Link href="/dashboard/inventory/items">
                <Button size="sm" className="text-xs font-bold bg-zinc-950 text-white min-h-[40px]">
                  View Stock Items
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    {!count.isBlindCount && <th className="py-3 px-4">Expected</th>}
                    <th className="py-3 px-4">Counted</th>
                    <th className="py-3 px-4">Variance</th>
                    {hasCostPermission && <th className="py-3 px-4">Variance Cost</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {items.map((it, idx) => {
                    const entered = countsMap[it.itemId]?.raw;
                    const numEntered = entered !== undefined && entered !== '' ? parseFloat(entered) : it.countedQuantityBase;
                    const exp = it.expectedQuantityBase || 0;
                    const variance = numEntered !== null && numEntered !== undefined ? numEntered - exp : null;
                    const unitCost = it.varianceCostCents !== null && it.varianceCostCents !== undefined && variance && variance !== 0
                      ? Math.round(it.varianceCostCents / variance)
                      : (it.varianceCostCents || 0);
                    const liveVarianceCost = variance !== null && count.status === 'counting'
                      ? Math.round(variance * unitCost)
                      : it.varianceCostCents;

                    return (
                      <tr
                        key={it.id}
                        onClick={() => count.status === 'counting' && setCurrentIndex(idx)}
                        className={`hover:bg-zinc-50 transition-colors ${
                          count.status === 'counting' ? 'cursor-pointer' : ''
                        } ${currentIndex === idx && count.status === 'counting' ? 'bg-zinc-100/70 font-bold' : ''}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-zinc-950">{it.itemName}</div>
                          {it.notes && <div className="text-[10px] text-zinc-400 mt-0.5">{it.notes}</div>}
                        </td>

                        {!count.isBlindCount && (
                          <td className="py-3.5 px-4 text-zinc-600">
                            {it.expectedQuantityBase !== null ? `${it.expectedQuantityBase} ${it.baseUnit}` : '—'}
                          </td>
                        )}

                        <td className="py-3.5 px-4 font-bold text-zinc-900">
                          {numEntered !== null && numEntered !== undefined ? (
                            `${numEntered} ${it.baseUnit}`
                          ) : (
                            <span className="text-zinc-300 italic">Not counted</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {variance === null ? (
                            '—'
                          ) : variance === 0 ? (
                            <span className="text-emerald-600 font-bold">0 {it.baseUnit} (Balanced)</span>
                          ) : variance > 0 ? (
                            <span className="text-blue-600 font-bold">+{variance} {it.baseUnit}</span>
                          ) : (
                            <span className="text-rose-600 font-bold">{variance} {it.baseUnit}</span>
                          )}
                        </td>

                        {hasCostPermission && (
                          <td className="py-3.5 px-4 font-bold">
                            {!count.isBlindCount && liveVarianceCost !== null && liveVarianceCost !== undefined ? (
                              <span className={liveVarianceCost < 0 ? 'text-rose-600' : liveVarianceCost > 0 ? 'text-blue-600' : 'text-zinc-800'}>
                                {formatCurrency(liveVarianceCost, count.currency)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card / List View (< 768px) */}
            <div className="block md:hidden divide-y divide-zinc-100">
              {items.map((it, idx) => {
                const entered = countsMap[it.itemId]?.raw;
                const numEntered = entered !== undefined && entered !== '' ? parseFloat(entered) : it.countedQuantityBase;
                const exp = it.expectedQuantityBase || 0;
                const variance = numEntered !== null && numEntered !== undefined ? numEntered - exp : null;
                const isItemCounted = entered !== undefined && entered.trim() !== '';
                const isCurrent = currentIndex === idx && count.status === 'counting';

                return (
                  <div
                    key={it.id}
                    className={`p-4 transition-colors space-y-3 ${
                      isCurrent ? 'bg-zinc-50 border-l-4 border-zinc-950' : 'hover:bg-zinc-50/50'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Item #{idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-950 break-words mt-0.5">
                          {it.itemName}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isItemCounted || it.isCounted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {isItemCounted || it.isCounted ? 'Counted' : 'Pending'}
                      </span>
                    </div>

                    {/* 2x2 Responsive Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                      {/* Expected */}
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Expected
                        </span>
                        <div className="font-bold text-zinc-800 mt-0.5">
                          {!count.isBlindCount && it.expectedQuantityBase !== null
                            ? `${it.expectedQuantityBase} ${it.baseUnit}`
                            : '— (Blind)'}
                        </div>
                      </div>

                      {/* Counted */}
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Counted
                        </span>
                        <div className="font-bold text-zinc-950 mt-0.5">
                          {numEntered !== null && numEntered !== undefined ? (
                            `${numEntered} ${it.baseUnit}`
                          ) : (
                            <span className="text-zinc-400 italic">Not counted</span>
                          )}
                        </div>
                      </div>

                      {/* Variance */}
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Variance
                        </span>
                        <div className="mt-0.5">
                          {variance === null ? (
                            <span className="text-zinc-400">—</span>
                          ) : variance === 0 ? (
                            <span className="text-emerald-700 font-bold">0 {it.baseUnit}</span>
                          ) : variance > 0 ? (
                            <span className="text-blue-700 font-bold">+{variance} {it.baseUnit}</span>
                          ) : (
                            <span className="text-rose-700 font-bold">{variance} {it.baseUnit}</span>
                          )}
                        </div>
                      </div>

                      {/* Variance Cost */}
                      {hasCostPermission && (
                        <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Variance Cost
                          </span>
                          <div className="font-bold mt-0.5 truncate">
                            {!count.isBlindCount && it.varianceCostCents !== null && it.varianceCostCents !== undefined ? (
                              <span className={it.varianceCostCents < 0 ? 'text-rose-700' : it.varianceCostCents > 0 ? 'text-blue-700' : 'text-zinc-800'}>
                                {formatCurrency(it.varianceCostCents, count.currency)}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Stepper Focus Action in counting mode */}
                    {count.status === 'counting' && (
                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentIndex(idx);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-xs font-bold text-zinc-800 hover:text-zinc-950 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer"
                        >
                          {isCurrent ? '● Active in Stepper' : 'Count this Item →'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

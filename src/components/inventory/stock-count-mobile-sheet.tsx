'use client';

import React, { useState } from 'react';
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
        raw: it.countedRawQuantity !== null ? it.countedRawQuantity.toString() : '',
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
    if (cents === null) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header Info */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-500">{count.countNumber}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
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
          <h1 className="text-lg font-black text-zinc-950 mt-1">{count.title}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Location: <strong className="text-zinc-800">{count.locationName}</strong> • Category: {count.categoryName}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {count.status === 'counting' && (
            <Button
              onClick={handleSubmitCount}
              disabled={isSubmitting || countedCount === 0}
              className="text-xs font-bold bg-zinc-950 text-white min-h-[42px] px-5"
            >
              {isSubmitting ? 'Submitting...' : `Submit Count (${countedCount}/${items.length})`}
            </Button>
          )}

          {count.status === 'submitted' && canApprove && (
            <Button
              onClick={handleApproveCount}
              disabled={isApproving}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[42px] px-5"
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

      {/* Counting Interface (when in counting mode) */}
      {count.status === 'counting' && activeItem && (
        <div className="bg-white border-2 border-zinc-900 rounded-3xl p-5 sm:p-7 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold mb-2">
            <span>ITEM {currentIndex + 1} OF {items.length}</span>
            <span>{Math.round((countedCount / items.length) * 100)}% Complete</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden mb-6">
            <div
              className="bg-zinc-950 h-full transition-all duration-300"
              style={{ width: `${(countedCount / items.length) * 100}%` }}
            />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-zinc-950">{activeItem.itemName}</h2>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            Unit: <strong className="text-zinc-900">{activeItem.baseUnit}</strong>
            {!count.isBlindCount && activeItem.expectedQuantityBase !== null && (
              <span className="ml-3 text-zinc-400">
                (Expected on record: {activeItem.expectedQuantityBase} {activeItem.baseUnit})
              </span>
            )}
          </p>

          {/* Big Tactile Numeric Input */}
          <div className="mt-6">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
              Enter Physical Count
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="any"
                min="0"
                autoFocus
                placeholder="0.00"
                value={countsMap[activeItem.itemId]?.raw || ''}
                onChange={(e) => handleInputChange(activeItem.itemId, 'raw', e.target.value)}
                className="flex-1 text-3xl font-black bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 text-zinc-950 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[64px]"
              />
              <span className="text-lg font-black text-zinc-500 bg-zinc-100 px-4 py-4 rounded-2xl min-h-[64px] flex items-center">
                {activeItem.baseUnit}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Add observation or count note (optional)"
              value={countsMap[activeItem.itemId]?.notes || ''}
              onChange={(e) => handleInputChange(activeItem.itemId, 'notes', e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-zinc-950 min-h-[40px]"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-zinc-100">
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
                className="text-xs font-bold bg-zinc-950 text-white min-h-[44px] px-6"
              >
                Next Item →
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitCount}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] px-6"
              >
                Submit Audit Sheet ✓
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Itemized Table Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Count Sheet Items ({items.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold">
              <tr>
                <th className="py-2.5 px-4">Item</th>
                {!count.isBlindCount && <th className="py-2.5 px-4">Expected</th>}
                <th className="py-2.5 px-4">Counted</th>
                <th className="py-2.5 px-4">Variance</th>
                {hasCostPermission && <th className="py-2.5 px-4">Variance Cost</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {items.map((it, idx) => {
                const entered = countsMap[it.itemId]?.raw;
                const numEntered = entered !== undefined && entered !== '' ? parseFloat(entered) : it.countedQuantityBase;
                const exp = it.expectedQuantityBase || 0;
                const variance = numEntered !== null && numEntered !== undefined ? numEntered - exp : null;

                return (
                  <tr
                    key={it.id}
                    onClick={() => count.status === 'counting' && setCurrentIndex(idx)}
                    className={`hover:bg-zinc-50 transition-colors ${
                      count.status === 'counting' ? 'cursor-pointer' : ''
                    } ${currentIndex === idx && count.status === 'counting' ? 'bg-zinc-100/70 font-bold' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-zinc-950">{it.itemName}</div>
                      {it.notes && <div className="text-[10px] text-zinc-400">{it.notes}</div>}
                    </td>

                    {!count.isBlindCount && (
                      <td className="py-3 px-4 text-zinc-600">
                        {it.expectedQuantityBase !== null ? `${it.expectedQuantityBase} ${it.baseUnit}` : '—'}
                      </td>
                    )}

                    <td className="py-3 px-4 font-bold text-zinc-900">
                      {numEntered !== null && numEntered !== undefined ? (
                        `${numEntered} ${it.baseUnit}`
                      ) : (
                        <span className="text-zinc-300 italic">Not counted</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {variance === null ? (
                        '—'
                      ) : variance === 0 ? (
                        <span className="text-emerald-600 font-bold">0 (Balanced)</span>
                      ) : variance > 0 ? (
                        <span className="text-blue-600 font-bold">+{variance} {it.baseUnit}</span>
                      ) : (
                        <span className="text-rose-600 font-bold">{variance} {it.baseUnit}</span>
                      )}
                    </td>

                    {hasCostPermission && (
                      <td className="py-3 px-4 font-bold">
                        {it.varianceCostCents !== null ? formatCurrency(it.varianceCostCents, count.currency) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

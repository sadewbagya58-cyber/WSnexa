'use client';

import React, { useState, useMemo } from 'react';
import {
  ItemPriceHistoryPayload,
  PriceHistoryRecord,
} from '@/server/services/purchasing.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface ItemPriceHistoryCardProps {
  payload: ItemPriceHistoryPayload | null;
  hasCostPermission?: boolean;
}

type TimeRangeOption = '30d' | '90d' | '6m' | '12m' | 'all';

export function ItemPriceHistoryCard({
  payload,
  hasCostPermission = false,
}: ItemPriceHistoryCardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    payload?.trendsByCurrency[0]?.currency || 'USD'
  );
  const [hoveredPoint, setHoveredPoint] = useState<PriceHistoryRecord | null>(null);

  // Available unique suppliers for filter
  const availableSuppliers = useMemo(() => {
    if (!payload) return [];
    const map = new Map<string, string>();
    payload.allObservations.forEach((o) => {
      if (o.supplierId) {
        map.set(o.supplierId, o.supplierName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [payload]);

  // Active trend group by selected currency
  const activeTrendGroup = useMemo(() => {
    if (!payload || payload.trendsByCurrency.length === 0) return null;
    return (
      payload.trendsByCurrency.find((t) => t.currency === selectedCurrency) ||
      payload.trendsByCurrency[0]
    );
  }, [payload, selectedCurrency]);

  // Filter observations based on time range and supplier
  const filteredHistory = useMemo(() => {
    let list = [...(activeTrendGroup?.history || [])];

    // Supplier filter
    if (selectedSupplierId !== 'all') {
      list = list.filter((item) => item.supplierId === selectedSupplierId);
    }

    // Time range filter
    const now = new Date().getTime();
    if (selectedTimeRange === '30d') {
      const threshold = now - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((item) => new Date(item.recordedAt).getTime() >= threshold);
    } else if (selectedTimeRange === '90d') {
      const threshold = now - 90 * 24 * 60 * 60 * 1000;
      list = list.filter((item) => new Date(item.recordedAt).getTime() >= threshold);
    } else if (selectedTimeRange === '6m') {
      const threshold = now - 180 * 24 * 60 * 60 * 1000;
      list = list.filter((item) => new Date(item.recordedAt).getTime() >= threshold);
    } else if (selectedTimeRange === '12m') {
      const threshold = now - 365 * 24 * 60 * 60 * 1000;
      list = list.filter((item) => new Date(item.recordedAt).getTime() >= threshold);
    }

    return list;
  }, [activeTrendGroup, selectedSupplierId, selectedTimeRange]);

  // Derived filtered summary metrics
  const summaryMetrics = useMemo(() => {
    const count = filteredHistory.length;
    if (count === 0 || !hasCostPermission) {
      return {
        current: null,
        previous: null,
        changeCents: null,
        changePct: null,
        lowest: null,
        highest: null,
        average: null,
        count,
        trendDirection: 'insufficient_data' as const,
      };
    }

    const latest = filteredHistory[count - 1];
    const prev = count >= 2 ? filteredHistory[count - 2] : null;

    const validNormPrices = filteredHistory
      .map((r) => r.normalizedPricePerBaseCents)
      .filter((n): n is number => n !== null);

    const lowest = validNormPrices.length > 0 ? Math.min(...validNormPrices) : null;
    const highest = validNormPrices.length > 0 ? Math.max(...validNormPrices) : null;
    const average =
      validNormPrices.length > 0
        ? Math.round(validNormPrices.reduce((a, b) => a + b, 0) / validNormPrices.length)
        : null;

    let changeCents: number | null = null;
    let changePct: number | null = null;
    let trendDirection: 'up' | 'down' | 'flat' | 'insufficient_data' = 'insufficient_data';

    if (
      prev &&
      latest.normalizedPricePerBaseCents !== null &&
      prev.normalizedPricePerBaseCents !== null
    ) {
      changeCents = latest.normalizedPricePerBaseCents - prev.normalizedPricePerBaseCents;
      changePct =
        prev.normalizedPricePerBaseCents > 0
          ? Number(((changeCents / prev.normalizedPricePerBaseCents) * 100).toFixed(2))
          : 0;

      if (changeCents > 0) trendDirection = 'up';
      else if (changeCents < 0) trendDirection = 'down';
      else trendDirection = 'flat';
    }

    return {
      current: latest.normalizedPricePerBaseCents,
      previous: prev ? prev.normalizedPricePerBaseCents : null,
      changeCents,
      changePct,
      lowest,
      highest,
      average,
      count,
      trendDirection,
    };
  }, [filteredHistory, hasCostPermission]);

  // Reverse chronological list for table ledger
  const reversedLedger = useMemo(() => {
    return [...filteredHistory].reverse();
  }, [filteredHistory]);

  // SVG Chart Geometry Calculations
  const chartPoints = useMemo(() => {
    if (filteredHistory.length === 0 || !hasCostPermission) return [];

    const normPrices = filteredHistory
      .map((r) => r.normalizedPricePerBaseCents)
      .filter((n): n is number => n !== null);

    if (normPrices.length === 0) return [];

    const min = Math.min(...normPrices);
    const max = Math.max(...normPrices);
    const range = max === min ? 1 : max - min;

    const width = 600;
    const height = 140;
    const paddingX = 40;
    const paddingY = 20;
    const innerW = width - paddingX * 2;
    const innerH = height - paddingY * 2;

    return filteredHistory.map((item, idx) => {
      const x =
        filteredHistory.length === 1
          ? width / 2
          : paddingX + (idx / (filteredHistory.length - 1)) * innerW;

      const priceVal = item.normalizedPricePerBaseCents ?? min;
      const normalizedRatio = max === min ? 0.5 : (priceVal - min) / range;
      const y = height - paddingY - normalizedRatio * innerH;

      return {
        x,
        y,
        item,
      };
    });
  }, [filteredHistory, hasCostPermission]);

  const svgPolyline = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const svgArea =
    chartPoints.length > 0
      ? `${chartPoints[0].x},120 ${svgPolyline} ${chartPoints[chartPoints.length - 1].x},120`
      : '';

  if (!payload || payload.trendsByCurrency.length === 0 || !activeTrendGroup) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950 flex items-center gap-2">
            <span>📈</span> Purchase Price History & Cost Trend
          </h3>
        </div>
        <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-1.5">
          <span className="text-2xl">📊</span>
          <h4 className="text-xs font-bold text-zinc-800">No Historical Price Observations</h4>
          <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
            Historical price trends will be tracked as supplier catalog pricing is updated, purchase orders are placed, and goods are received.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950 flex items-center gap-2">
            <span>📈</span> Purchase Price History & Cost Trend
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Track historical supplier prices, contract changes, and normalized unit cost movements.
          </p>
        </div>

        {/* Currency & Supplier Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {payload.trendsByCurrency.length > 1 && (
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold">
              {payload.trendsByCurrency.map((grp) => (
                <button
                  key={grp.currency}
                  type="button"
                  onClick={() => setSelectedCurrency(grp.currency)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    selectedCurrency === grp.currency
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {grp.currency}
                </button>
              ))}
            </div>
          )}

          {availableSuppliers.length > 1 && (
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-700"
            >
              <option value="all">All Vendors ({availableSuppliers.length})</option>
              {availableSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Time Range Pills */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-[11px] font-bold">
            {(['30d', '90d', '6m', '12m', 'all'] as TimeRangeOption[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedTimeRange(r)}
                className={`px-2 py-0.5 rounded-lg transition-colors capitalize ${
                  selectedTimeRange === r
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Latest Price */}
        <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Latest Price
          </span>
          <div className="text-sm font-black text-zinc-950 font-mono">
            {hasCostPermission && summaryMetrics.current !== null
              ? `${formatCurrencyMinor(summaryMetrics.current, activeTrendGroup.currency)} / ${payload.baseUnit}`
              : '—'}
          </div>
          <span className="text-[10px] text-zinc-500 block truncate">
            {filteredHistory[filteredHistory.length - 1]?.supplierName || '—'}
          </span>
        </div>

        {/* Price Change vs Previous */}
        <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Change vs Prior
          </span>
          <div className="flex items-center gap-1.5">
            {hasCostPermission && summaryMetrics.changeCents !== null ? (
              <span
                className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                  summaryMetrics.changeCents < 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : summaryMetrics.changeCents > 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {summaryMetrics.changeCents < 0 ? '↓ ' : summaryMetrics.changeCents > 0 ? '↑ +' : '● '}
                {formatCurrencyMinor(Math.abs(summaryMetrics.changeCents), activeTrendGroup.currency)}
                {summaryMetrics.changePct !== null && ` (${summaryMetrics.changePct > 0 ? '+' : ''}${summaryMetrics.changePct}%)`}
              </span>
            ) : (
              <span className="text-xs font-mono text-zinc-400 font-bold">
                {summaryMetrics.count <= 1 ? 'Baseline record' : '—'}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            {summaryMetrics.trendDirection === 'down'
              ? 'Cost decreased'
              : summaryMetrics.trendDirection === 'up'
              ? 'Cost increased'
              : summaryMetrics.trendDirection === 'flat'
              ? 'Stable cost'
              : 'Initial baseline'}
          </span>
        </div>

        {/* Range Low & High */}
        <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Period Low / High
          </span>
          <div className="text-xs font-bold text-zinc-800 font-mono">
            {hasCostPermission && summaryMetrics.lowest !== null && summaryMetrics.highest !== null ? (
              <span>
                {formatCurrencyMinor(summaryMetrics.lowest, activeTrendGroup.currency)} -{' '}
                {formatCurrencyMinor(summaryMetrics.highest, activeTrendGroup.currency)}
              </span>
            ) : (
              '—'
            )}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            {summaryMetrics.count} historical {summaryMetrics.count === 1 ? 'point' : 'points'}
          </span>
        </div>

        {/* Average Price */}
        <div className="bg-zinc-50/80 border border-zinc-200/80 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Weighted Average
          </span>
          <div className="text-xs font-bold text-zinc-800 font-mono">
            {hasCostPermission && summaryMetrics.average !== null
              ? `${formatCurrencyMinor(summaryMetrics.average, activeTrendGroup.currency)} / ${payload.baseUnit}`
              : '—'}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            {selectedTimeRange === 'all' ? 'All recorded history' : `Past ${selectedTimeRange}`}
          </span>
        </div>
      </div>

      {/* Responsive SVG Cost Trend Visualizer */}
      {hasCostPermission && chartPoints.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="font-bold text-zinc-700">Cost Trend Evolution ({payload.baseUnit})</span>
            {hoveredPoint && hoveredPoint.normalizedPricePerBaseCents !== null && (
              <span className="font-mono text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md font-bold">
                {new Date(hoveredPoint.recordedAt).toLocaleDateString()} • {hoveredPoint.supplierName}:{' '}
                {formatCurrencyMinor(hoveredPoint.normalizedPricePerBaseCents, hoveredPoint.currency)}/{payload.baseUnit}
              </span>
            )}
          </div>

          <div className="relative w-full overflow-hidden bg-zinc-950 rounded-xl p-4 text-white">
            <svg
              viewBox="0 0 600 140"
              className="w-full h-36 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="560" y2="20" stroke="#27272a" strokeDasharray="3 3" />
              <line x1="40" y1="70" x2="560" y2="70" stroke="#27272a" strokeDasharray="3 3" />
              <line x1="40" y1="120" x2="560" y2="120" stroke="#27272a" strokeWidth="1" />

              {/* Area Fill */}
              {chartPoints.length > 1 && (
                <polygon points={svgArea} fill="url(#trendGradient)" />
              )}

              {/* Line Polyline */}
              {chartPoints.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={svgPolyline}
                />
              )}

              {/* Data Points */}
              {chartPoints.map((pt, i) => (
                <g key={pt.item.id || i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint?.id === pt.item.id ? 6 : 4}
                    className="fill-emerald-400 stroke-zinc-950 stroke-2 cursor-pointer transition-all hover:scale-125"
                    onMouseEnter={() => setHoveredPoint(pt.item)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Date timeline labels */}
            <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/80 px-2 font-mono">
              <span>{new Date(filteredHistory[0]?.recordedAt).toLocaleDateString()}</span>
              <span>{new Date(filteredHistory[filteredHistory.length - 1]?.recordedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Historical Price Ledger */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          Price History Ledger ({reversedLedger.length})
        </h4>

        <div className="overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier / Vendor</th>
                <th className="py-2.5 px-3">Source Type</th>
                <th className="py-2.5 px-3">Unit & Pack</th>
                {hasCostPermission && <th className="py-2.5 px-3 text-right">Pack Price</th>}
                {hasCostPermission && <th className="py-2.5 px-3 text-right">Normalized Cost</th>}
                {hasCostPermission && <th className="py-2.5 px-3 text-right">Change vs Prior</th>}
                <th className="py-2.5 px-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {reversedLedger.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                    {new Date(row.recordedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>

                  <td className="py-3 px-3 font-bold text-zinc-900 whitespace-nowrap">
                    {row.supplierName}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        row.sourceType === 'catalog'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : row.sourceType === 'goods_receipt'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : row.sourceType === 'purchase_order'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {row.sourceType === 'catalog'
                        ? '🏷️ Catalog'
                        : row.sourceType === 'goods_receipt'
                        ? '🚚 Goods Receipt'
                        : row.sourceType === 'purchase_order'
                        ? '📦 Purchase Order'
                        : 'Manual'}
                    </span>
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-bold text-zinc-900 capitalize">{row.purchasingUnit}</span>
                    {row.conversionToBase !== 1 && (
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        (1 {row.purchasingUnit} = {row.conversionToBase} {row.baseUnit})
                      </span>
                    )}
                  </td>

                  {hasCostPermission && (
                    <td className="py-3 px-3 text-right font-mono text-zinc-700 whitespace-nowrap">
                      {row.packPriceCents !== null
                        ? `${formatCurrencyMinor(row.packPriceCents, row.currency)} / ${row.purchasingUnit}`
                        : '—'}
                    </td>
                  )}

                  {hasCostPermission && (
                    <td className="py-3 px-3 text-right font-mono font-black text-zinc-950 whitespace-nowrap">
                      {row.normalizedPricePerBaseCents !== null
                        ? `${formatCurrencyMinor(row.normalizedPricePerBaseCents, row.currency)} / ${row.baseUnit}`
                        : '—'}
                    </td>
                  )}

                  {hasCostPermission && (
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      {row.changeVsPreviousCents !== null &&
                      row.changeVsPreviousCents !== undefined &&
                      row.changeVsPreviousCents !== 0 ? (
                        <span
                          className={`text-[11px] font-bold ${
                            row.changeVsPreviousCents < 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {row.changeVsPreviousCents < 0 ? '↓ ' : '↑ +'}
                          {formatCurrencyMinor(Math.abs(row.changeVsPreviousCents), row.currency)}
                          {row.changeVsPreviousPercentage !== null &&
                            row.changeVsPreviousPercentage !== undefined &&
                            ` (${row.changeVsPreviousPercentage > 0 ? '+' : ''}${row.changeVsPreviousPercentage}%)`}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">First Record</span>
                      )}
                    </td>
                  )}

                  <td className="py-3 px-3 text-[11px] text-zinc-500 max-w-xs truncate">
                    {row.referenceNumber ? (
                      <span className="font-mono text-zinc-700 font-bold mr-1.5">
                        {row.referenceNumber}
                      </span>
                    ) : null}
                    {row.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { MetricValueDTO } from '@/lib/analytics/analytics-types';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface ExecutiveKpiCardsProps {
  metrics: Record<string, MetricValueDTO>;
  currency: string;
}

export function ExecutiveKpiCards({ metrics, currency }: ExecutiveKpiCardsProps) {
  const cards: {
    key: string;
    title: string;
    icon: string;
    metric?: MetricValueDTO;
    isCurrency?: boolean;
    formatVal?: (val: number) => string;
  }[] = [
    {
      key: 'gross_sales',
      title: 'Gross Sales',
      icon: '💰',
      metric: metrics.gross_sales,
      isCurrency: true,
    },
    {
      key: 'net_sales',
      title: 'Net Sales',
      icon: '✅',
      metric: metrics.net_sales,
      isCurrency: true,
    },
    {
      key: 'completed_orders',
      title: 'Completed Orders',
      icon: '📦',
      metric: metrics.completed_orders,
      formatVal: (val) => `${val} orders`,
    },
    {
      key: 'aov',
      title: 'Average Order Value',
      icon: '📊',
      metric: metrics.aov,
      isCurrency: true,
    },
    {
      key: 'completion_rate',
      title: 'Completion Rate',
      icon: '🎯',
      metric: metrics.completion_rate,
      formatVal: (val) => `${val}%`,
    },
    {
      key: 'avg_rating',
      title: 'Average Rating',
      icon: '★',
      metric: metrics.avg_rating,
      formatVal: (val) => `${val} / 5.0`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => {
        const m = card.metric;
        const isRedacted = m?.quality === 'UNAVAILABLE' && m?.qualityNote?.includes('Redacted');
        const isUnavailable = !m || m.value === null;

        let formattedValue = 'N/A';
        if (m && m.value !== null) {
          if (card.isCurrency) {
            formattedValue = formatCurrency(m.value, currency);
          } else if (card.formatVal) {
            formattedValue = card.formatVal(m.value);
          } else {
            formattedValue = String(m.value);
          }
        }

        const pctChange = m?.percentageChange;
        const absChange = m?.absoluteChange;

        return (
          <div
            key={card.key}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg"
          >
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span>{card.title}</span>
              <span className="text-base font-mono">{card.icon}</span>
            </div>

            <div className="my-3">
              {isRedacted ? (
                <div className="text-sm font-semibold text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg inline-block">
                  🔒 Redacted
                </div>
              ) : isUnavailable ? (
                <div className="text-lg font-bold text-zinc-500 italic">Unavailable</div>
              ) : (
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                  {formattedValue}
                </div>
              )}
            </div>

            {/* Comparison / Data Quality footer */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              {isRedacted ? (
                <span className="text-[11px] text-zinc-500">Financial view permission required</span>
              ) : pctChange !== undefined && pctChange !== null ? (
                <div className="flex items-center gap-1 font-medium">
                  {pctChange > 0 ? (
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <span>▲</span> +{pctChange}%
                    </span>
                  ) : pctChange < 0 ? (
                    <span className="text-rose-400 flex items-center gap-0.5">
                      <span>▼</span> {pctChange}%
                    </span>
                  ) : (
                    <span className="text-zinc-400">0% change</span>
                  )}
                  <span className="text-zinc-500 text-[11px] ml-1">vs prior period</span>
                </div>
              ) : absChange !== undefined && absChange !== null ? (
                <span className="text-zinc-400 text-[11px]">
                  {absChange >= 0 ? `+${absChange}` : absChange} vs prior period
                </span>
              ) : (
                <span className="text-zinc-500 text-[11px]">Baseline period</span>
              )}

              {m?.quality === 'PARTIAL' && (
                <span
                  title={m.qualityNote || 'Data quality is partial'}
                  className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                >
                  Partial Data
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

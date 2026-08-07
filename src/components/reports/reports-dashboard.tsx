'use client';

import React, { useState, useEffect } from 'react';
import { ReportPreset } from '@/lib/validation/report';
import { fetchAnalyticsAction } from '@/server/actions/report';
import { CompleteAnalyticsPayload } from '@/server/services/report.service';

import { DateRangePicker } from './date-range-picker';
import { KpiSummaryCards } from './kpi-summary-cards';
import { RevenueTrendChart } from './revenue-trend-chart';
import { OrdersByHourChart } from './orders-by-hour-chart';
import { PaymentAnalyticsCard } from './payment-analytics-card';
import { MenuAnalyticsCard } from './menu-analytics-card';
import { KitchenAnalyticsCard } from './kitchen-analytics-card';
import { TableAnalyticsCard } from './table-analytics-card';
import { ModifierAnalyticsCard } from './modifier-analytics-card';
import { BranchComparisonCard } from './branch-comparison-card';
import { ExportCenterModal } from './export-center-modal';

export function ReportsDashboard() {
  const [preset, setPreset] = useState<ReportPreset>('today');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<CompleteAnalyticsPayload | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      const res = await fetchAnalyticsAction({
        preset,
        startDate,
        endDate,
      });

      if (isMounted) {
        if (res.success && res.data) {
          setData(res.data);
          setErrorMsg(null);
        } else {
          setErrorMsg(res.message || 'Failed to load reporting data.');
        }
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [preset, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📈</span> Business Intelligence & Reports
          </h1>
          <p className="text-xs text-zinc-400">
            Real-time analytics, revenue trend, kitchen efficiency & multi-dimension performance metrics
          </p>
        </div>

        <button
          onClick={() => setIsExportOpen(true)}
          className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto shadow-lg"
        >
          <span>📥</span> Export Report
        </button>
      </div>

      {/* Date Range Controls */}
      <DateRangePicker
        preset={preset}
        onPresetChange={(p) => {
          setPreset(p);
          if (p !== 'custom') {
            setStartDate(undefined);
            setEndDate(undefined);
          }
        }}
        startDate={startDate}
        endDate={endDate}
        onCustomDateChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        timezone={data?.branchName ? `Branch: ${data.branchName}` : undefined}
      />

      {/* Loading / Error States */}
      {isLoading && (
        <div className="p-12 text-center text-zinc-400 text-sm font-mono animate-pulse">
          Loading reporting analytics data from Supabase DB...
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}

      {!isLoading && !errorMsg && data && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <KpiSummaryCards summary={data.summary} currency={data.currency} />

          {/* Revenue Trend & Peak Hours Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueTrendChart series={data.timeSeries} currency={data.currency} />
            <OrdersByHourChart hours={data.ordersByHour} />
          </div>

          {/* Payment & Menu Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PaymentAnalyticsCard payments={data.payments} currency={data.currency} />
            <MenuAnalyticsCard items={data.menuItems} currency={data.currency} />
          </div>

          {/* Kitchen & Table Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <KitchenAnalyticsCard kitchen={data.kitchen} />
            <TableAnalyticsCard tables={data.tables} currency={data.currency} />
          </div>

          {/* Modifiers Performance */}
          <ModifierAnalyticsCard modifiers={data.modifiers} currency={data.currency} />

          {/* Cross-Branch Comparison (Business Owner Only) */}
          {data.branchComparison && data.branchComparison.length > 0 && (
            <BranchComparisonCard branches={data.branchComparison} currency={data.currency} />
          )}
        </div>
      )}

      {/* Export Modal */}
      <ExportCenterModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        preset={preset}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { AnalyticsDatePreset } from '@/lib/analytics/analytics-types';
import { fetchAnalyticsAction } from '@/server/actions/report';
import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';

import { AnalyticsFilterBar } from './analytics-filter-bar';
import { ExecutiveKpiCards } from './executive-kpi-cards';
import { SalesAnalyticsView } from './sales-analytics-view';
import { OperationsAnalyticsView } from './operations-analytics-view';
import { MenuAnalyticsView } from './menu-analytics-view';
import { InventoryAnalyticsView } from './inventory-analytics-view';
import { ReputationAnalyticsView } from './reputation-analytics-view';
import { BranchComparisonView } from './branch-comparison-view';
import { ExportCenterModal } from './export-center-modal';

type AnalyticsTab = 'overview' | 'sales' | 'operations' | 'menu' | 'inventory' | 'reputation' | 'comparison';

export function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [preset, setPreset] = useState<AnalyticsDatePreset>('today');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveOverviewDTO | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAnalytics() {
      setIsLoading(true);
      const res = await fetchAnalyticsAction({
        preset,
        startDate,
        endDate,
        branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
      });

      if (isMounted) {
        if (res.success && res.data) {
          setData(res.data);
          setErrorMsg(null);
        } else {
          setErrorMsg(res.message || 'Failed to load executive analytics data.');
        }
        setIsLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [preset, startDate, endDate, selectedBranchId]);

  const tabs: { key: AnalyticsTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Executive Overview', icon: '📊' },
    { key: 'sales', label: 'Sales & Revenue', icon: '💰' },
    { key: 'operations', label: 'Operations & Speed', icon: '⚡' },
    { key: 'menu', label: 'Menu Performance', icon: '🍽️' },
    { key: 'inventory', label: 'Inventory & Waste', icon: '📦' },
    { key: 'reputation', label: 'Guests & Reviews', icon: '⭐' },
  ];

  if (data?.isMultiBranchAuthorized && data.authorizedBranches.length > 1) {
    tabs.push({ key: 'comparison', label: 'Branch Comparison', icon: '🏬' });
  }

  const currency = data?.summary.currency || 'LKR';
  const hasFinancialAccess = data?.summary.hasFinancialAccess ?? true;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📈</span> Executive Analytics & Intelligence
          </h1>
          <p className="text-xs text-zinc-400">
            Real-time business performance, revenue trends, kitchen efficiency & multi-branch intelligence
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all flex items-center gap-2 self-start sm:self-auto shadow-lg min-h-[44px]"
        >
          <span>📥</span> Export Analytics Report
        </button>
      </div>

      {/* Global Analytics Filter Bar */}
      <AnalyticsFilterBar
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
        selectedBranchId={selectedBranchId}
        onBranchChange={(bId) => setSelectedBranchId(bId)}
        authorizedBranches={data?.authorizedBranches || []}
        isMultiBranchAuthorized={data?.isMultiBranchAuthorized || false}
        timezoneLabel={data?.summary.resolvedDateRange.timezone || 'Asia/Colombo'}
        isLoading={isLoading}
      />

      {/* Data Quality Notice Banner */}
      {data?.summary.dataQualityNotes && data.summary.dataQualityNotes.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs font-medium space-y-1">
          {data.summary.dataQualityNotes.map((note, i) => (
            <div key={i} className="flex items-center gap-2">
              <span>ℹ️</span> <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-800 gap-1 pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                active
                  ? 'bg-zinc-800 text-amber-400 border border-amber-500/30 shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && !isLoading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span> <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Tab Views */}
      {!isLoading && !errorMsg && data && (
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <ExecutiveKpiCards metrics={data.summary.metrics} currency={currency} />
              <SalesAnalyticsView sales={data.sales} currency={currency} hasFinancialAccess={hasFinancialAccess} />
            </div>
          )}

          {activeTab === 'sales' && (
            <SalesAnalyticsView sales={data.sales} currency={currency} hasFinancialAccess={hasFinancialAccess} />
          )}

          {activeTab === 'operations' && (
            <OperationsAnalyticsView operations={data.operations} />
          )}

          {activeTab === 'menu' && (
            <MenuAnalyticsView menu={data.menu} currency={currency} hasFinancialAccess={hasFinancialAccess} />
          )}

          {activeTab === 'inventory' && (
            <InventoryAnalyticsView inventory={data.inventory} currency={currency} hasFinancialAccess={hasFinancialAccess} />
          )}

          {activeTab === 'reputation' && (
            <ReputationAnalyticsView reviews={data.reviews} />
          )}

          {activeTab === 'comparison' && (
            <BranchComparisonView
              branches={data.branchComparison}
              currency={currency}
              hasFinancialAccess={hasFinancialAccess}
              onSelectBranch={(bId) => {
                setSelectedBranchId(bId);
                setActiveTab('overview');
              }}
            />
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

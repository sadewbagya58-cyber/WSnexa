'use client';

import React, { useState, useEffect, useCallback } from 'react';

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

import { InsightsTab } from './insights-tab';
import { ExecutiveOverviewInsightsCard } from './executive-overview-insights-card';
import { OperationalInsightDTO } from '@/lib/insights/insight-types';

export type AnalyticsTab = 'overview' | 'insights' | 'sales' | 'operations' | 'menu' | 'inventory' | 'reputation' | 'comparison';

interface AnalyticsDataResponse extends ExecutiveOverviewDTO {
  insights?: OperationalInsightDTO[];
}

export function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [preset, setPreset] = useState<string>('today');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [data, setData] = useState<AnalyticsDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const loadAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await fetchAnalyticsAction({
      preset: preset as AnalyticsDatePreset,
      startDate,
      endDate,
      branchId: selectedBranchId === 'all' ? undefined : selectedBranchId,
    });
    if (res.success && res.data) {
      setData(res.data as AnalyticsDataResponse);
    } else {
      setErrorMsg(res.message || 'Failed to load analytics.');
    }
    setIsLoading(false);
  }, [preset, startDate, endDate, selectedBranchId]);

  useEffect(() => {
    let ignore = false;
    fetchAnalyticsAction({
      preset: preset as AnalyticsDatePreset,
      startDate,
      endDate,
      branchId: selectedBranchId === 'all' ? undefined : selectedBranchId,
    }).then((res) => {
      if (!ignore) {
        if (res.success && res.data) {
          setData(res.data as AnalyticsDataResponse);
          setErrorMsg(null);
        } else {
          setErrorMsg(res.message || 'Failed to load analytics.');
        }
        setIsLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [preset, startDate, endDate, selectedBranchId]);



  const tabs: { key: AnalyticsTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Executive Overview', icon: '📊' },
    { key: 'insights', label: 'Operational Insights', icon: '💡' },
    { key: 'sales', label: 'Sales & Revenue', icon: '💰' },
    { key: 'operations', label: 'Operations & Speed', icon: '⚡' },
    { key: 'menu', label: 'Menu Performance', icon: '🍽️' },
    { key: 'inventory', label: 'Inventory & Waste', icon: '📦' },
    { key: 'reputation', label: 'Guests & Reviews', icon: '⭐' },
  ];

  if (data?.isMultiBranchAuthorized && data.authorizedBranches.length > 1) {
    tabs.push({ key: 'comparison', label: 'Branch Comparison', icon: '🏬' });
  }

  const currency = data?.summary.currency || 'USD';
  const hasFinancialAccess = data?.summary.hasFinancialAccess ?? true;
  const insights = data?.insights || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>📈</span> Executive Analytics & Intelligence
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Real-time business performance, revenue trends, kitchen efficiency & multi-branch intelligence
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs hover:bg-zinc-800 dark:hover:bg-white transition-colors flex items-center justify-center gap-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shadow-sm"
        >
          <span>📥</span>
          <span>Export Center</span>
        </button>
      </div>

      {/* Filter Bar */}
      <AnalyticsFilterBar
        preset={preset as AnalyticsDatePreset}
        startDate={startDate}
        endDate={endDate}
        selectedBranchId={selectedBranchId}
        authorizedBranches={data?.authorizedBranches || []}
        isMultiBranchAuthorized={data?.isMultiBranchAuthorized || false}
        onPresetChange={setPreset}
        onCustomDateChange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        onBranchChange={setSelectedBranchId}
        timezoneLabel={data?.summary.resolvedDateRange.timezone || 'Asia/Colombo'}
        isLoading={isLoading}
      />

      {/* Data Quality Warning Notes */}
      {data?.summary.dataQualityNotes && data.summary.dataQualityNotes.length > 0 && (
        <div className="space-y-1">
          {data.summary.dataQualityNotes.map((note, idx) => (
            <div key={idx} className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
              <span>⚠️</span> <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 gap-1.5 pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs rounded-xl transition-all whitespace-nowrap min-h-[44px] flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                active
                  ? 'bg-amber-500 text-zinc-950 font-black shadow-md border border-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.key === 'insights' && insights.filter((i) => i.status === 'ACTIVE').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-950 text-amber-400 dark:bg-amber-400 dark:text-zinc-950 ml-0.5">
                  {insights.filter((i) => i.status === 'ACTIVE').length}
                </span>
              )}
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
              <ExecutiveOverviewInsightsCard
                insights={insights}
                onNavigateToInsights={() => setActiveTab('insights')}
              />
              <ExecutiveKpiCards metrics={data.summary.metrics} currency={currency} />
              <SalesAnalyticsView sales={data.sales} currency={currency} hasFinancialAccess={hasFinancialAccess} />
            </div>
          )}

          {activeTab === 'insights' && (
            <InsightsTab insights={insights} onRefresh={loadAnalyticsData} />
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
        preset={preset as AnalyticsDatePreset}
        startDate={startDate}
        endDate={endDate}
      />

    </div>
  );
}

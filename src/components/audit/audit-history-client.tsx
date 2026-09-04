'use client';

import React, { useState, useTransition, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuditLogRecord } from '@/server/services/audit.service';
import { getAuditLogsAction } from '@/server/actions/audit';
import { EntityTimelineDialog } from './entity-timeline-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  IconSearch,
  IconFilter,
  IconRefresh,
  IconClock,
  IconUser,
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconHistory,
  IconLayers,
  formatAuditDate,
  formatAuditShortDate,
} from './audit-icons';

export interface AuditHistoryClientProps {
  initialLogs: AuditLogRecord[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  branches: Array<{ id: string; name: string }>;
  activeBranchId?: string;
  canViewAllBranches?: boolean;
}

const ENTITY_TYPE_OPTIONS = [
  { label: 'All Entities', value: '' },
  { label: 'Orders', value: 'order' },
  { label: 'Waiter Requests', value: 'waiter_request' },
  { label: 'Payments', value: 'payment' },
  { label: 'Inventory Items', value: 'inventory_item' },
  { label: 'Stock Adjustments', value: 'stock_adjustment' },
  { label: 'Stock Transfers', value: 'stock_transfer' },
  { label: 'Purchase Orders', value: 'purchase_order' },
  { label: 'Goods Receipts', value: 'goods_receipt' },
  { label: 'Supplier Returns', value: 'supplier_return' },
  { label: 'Staff / Memberships', value: 'membership' },
  { label: 'Assignments', value: 'assignment' },
  { label: 'Positions', value: 'position' },
  { label: 'Roles / Permissions', value: 'role' },
];

export function AuditHistoryClient({
  initialLogs,
  initialTotal,
  initialPage,
  initialPageSize,
  branches,
  activeBranchId,
  canViewAllBranches = false,
}: AuditHistoryClientProps) {
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLogRecord[]>(initialLogs);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize] = useState<number>(initialPageSize);
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    searchParams?.get('branchId') || activeBranchId || ''
  );
  const [selectedEntityType, setSelectedEntityType] = useState<string>(
    searchParams?.get('entityType') || ''
  );
  const [actionSearch, setActionSearch] = useState<string>(searchParams?.get('action') || '');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams?.get('search') || '');
  const [dateFilter, setDateFilter] = useState<string>(searchParams?.get('dateRange') || 'all');

  // Timeline Dialog state
  const [timelineTarget, setTimelineTarget] = useState<{
    isOpen: boolean;
    entityType: string;
    entityId: string;
    entityTitle?: string;
  }>({
    isOpen: false,
    entityType: '',
    entityId: '',
  });

  // Expanded diff rows
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateDateRange = useCallback((filter: string) => {
    const now = new Date();
    if (filter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { startDate: start, endDate: undefined };
    } else if (filter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return { startDate: start, endDate: undefined };
    } else if (filter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return { startDate: start, endDate: undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, []);

  const fetchLogs = useCallback(
    async (
      targetPage: number,
      branchId: string,
      entityType: string,
      action: string,
      search: string,
      dateRangePreset: string
    ) => {
      startTransition(async () => {
        const { startDate, endDate } = calculateDateRange(dateRangePreset);
        const offset = (targetPage - 1) * pageSize;
        const res = await getAuditLogsAction({
          limit: pageSize,
          offset,
          branchId: branchId || undefined,
          entityType: entityType || undefined,
          action: action.trim() || undefined,
          searchQuery: search.trim() || undefined,
          startDate,
          endDate,
        });

        if (res.success && res.logs) {
          setLogs(res.logs);
          setTotal(res.total);
          setPage(targetPage);
        }
      });
    },
    [calculateDateRange, pageSize]
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchLogs(1, selectedBranchId, selectedEntityType, actionSearch, searchQuery, dateFilter);
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage, selectedBranchId, selectedEntityType, actionSearch, searchQuery, dateFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setSelectedBranchId(activeBranchId || '');
    setSelectedEntityType('');
    setActionSearch('');
    setSearchQuery('');
    setDateFilter('all');
    fetchLogs(1, activeBranchId || '', '', '', '', 'all');
  };

  const openTimeline = (entityType: string, entityId: string, entityTitle?: string) => {
    setTimelineTarget({
      isOpen: true,
      entityType,
      entityId,
      entityTitle,
    });
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const getActionBadgeColor = (action: string) => {
    if (action.includes('created') || action.includes('approved') || action.includes('received')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('deleted') || action.includes('rejected') || action.includes('voided') || action.includes('waste')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('updated') || action.includes('adjusted') || action.includes('status') || action.includes('changed')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  };

  const formatAction = (action: string) => {
    return action.replace(/[._]/g, ' ').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Filter / Search Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search query */}
            <div className="relative">
              <label htmlFor="audit-search" className="block text-xs font-semibold text-zinc-700 mb-1">
                Search Actor / ID
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <IconSearch className="w-4 h-4" />
                </span>
                <input
                  id="audit-search"
                  type="text"
                  placeholder="Name, email, or entity ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[42px]"
                />
              </div>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label htmlFor="audit-entity" className="block text-xs font-semibold text-zinc-700 mb-1">
                Entity Type
              </label>
              <select
                id="audit-entity"
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[42px]"
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Selector (if multi-branch) */}
            <div>
              <label htmlFor="audit-branch" className="block text-xs font-semibold text-zinc-700 mb-1">
                Branch / Property Scope
              </label>
              <select
                id="audit-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[42px]"
              >
                {canViewAllBranches && <option value="">All Accessible Branches</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Preset */}
            <div>
              <label htmlFor="audit-date" className="block text-xs font-semibold text-zinc-700 mb-1">
                Time Window
              </label>
              <select
                id="audit-date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[42px]"
              >
                <option value="all">All Time History</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                <IconFilter className="w-4 h-4" />
                <span>Apply Filters</span>
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={isPending}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
              >
                Reset
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleApplyFilters()}
              disabled={isPending}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors flex items-center gap-2"
              title="Refresh logs"
            >
              <IconRefresh className={`w-4 h-4 ${isPending ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </form>
      </div>

      {/* Audit Logs List View */}
      {logs.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <IconHistory className="w-10 h-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-900">No audit records found</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            No audit logs matched your current filters. Try changing or clearing your search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Feed (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {logs.map((log) => {
              const isExpanded = !!expandedLogIds[log.id];
              const hasDiff =
                (log.old_values && Object.keys(log.old_values).length > 0) ||
                (log.new_values && Object.keys(log.new_values).length > 0) ||
                (log.metadata && Object.keys(log.metadata).length > 0);

              return (
                <div
                  key={log.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border font-mono ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {formatAction(log.action)}
                    </span>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1 shrink-0 font-mono">
                      <IconClock className="w-3 h-3 text-zinc-400" />
                      {formatAuditShortDate(log.created_at)}
                    </span>
                  </div>

                  {/* Actor details */}
                  <div className="flex items-center gap-2 text-xs text-zinc-800 pt-1 border-t border-zinc-100">
                    <IconUser className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="font-semibold">{log.actor_name_snapshot || 'System / Auto'}</span>
                    {log.actor_role_snapshot && (
                      <span className="text-zinc-500 font-normal">({log.actor_role_snapshot})</span>
                    )}
                  </div>

                  {/* Entity and Branch */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 font-mono">
                    <div className="flex items-center gap-1.5 truncate">
                      <IconLayers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-semibold text-zinc-800">{log.entity_type}:</span>
                      <span className="truncate max-w-[120px]">{log.entity_id}</span>
                    </div>
                    {log.branch?.name && (
                      <div className="flex items-center gap-1 text-zinc-500">
                        <IconBuilding className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span>{log.branch.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Reason if available */}
                  {log.reason && (
                    <div className="text-xs bg-amber-50/70 border border-amber-200/60 text-amber-900 rounded-lg p-2">
                      <span className="font-bold">Reason:</span> {log.reason}
                    </div>
                  )}

                  {/* Actions row: View Timeline + Diff Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => openTimeline(log.entity_type, log.entity_id, `${log.entity_type} #${log.entity_id.slice(0, 8)}`)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors"
                    >
                      <IconHistory className="w-3.5 h-3.5" />
                      <span>View Entity Timeline</span>
                    </button>

                    {hasDiff && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 flex items-center gap-1 transition-colors"
                      >
                        {isExpanded ? <IconChevronDown className="w-3.5 h-3.5" /> : <IconChevronRight className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Hide Diff' : 'View Diff'}</span>
                      </button>
                    )}
                  </div>

                  {/* Expandable diff box */}
                  {isExpanded && hasDiff && (
                    <div className="mt-2 space-y-2 bg-zinc-950 text-zinc-100 p-3 rounded-xl text-xs font-mono overflow-x-auto max-h-60">
                      {log.old_values && Object.keys(log.old_values).length > 0 && (
                        <div>
                          <div className="text-rose-400 font-semibold mb-1">--- Old State</div>
                          <pre className="text-[11px] whitespace-pre-wrap break-all text-rose-200">
                            {JSON.stringify(log.old_values, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_values && Object.keys(log.new_values).length > 0 && (
                        <div className={log.old_values && Object.keys(log.old_values).length > 0 ? 'mt-2' : ''}>
                          <div className="text-emerald-400 font-semibold mb-1">+++ New State</div>
                          <pre className="text-[11px] whitespace-pre-wrap break-all text-emerald-200">
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <div className="text-zinc-400 font-semibold mb-1">Metadata</div>
                          <pre className="text-[11px] whitespace-pre-wrap break-all text-zinc-300">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-800">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Entity</th>
                    <th className="py-3.5 px-4">Branch</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-normal">
                  {logs.map((log) => {
                    const isExpanded = !!expandedLogIds[log.id];
                    const hasDiff =
                      (log.old_values && Object.keys(log.old_values).length > 0) ||
                      (log.new_values && Object.keys(log.new_values).length > 0) ||
                      (log.metadata && Object.keys(log.metadata).length > 0);

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-zinc-500 font-mono">
                            {formatAuditDate(log.created_at)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-zinc-900 text-xs truncate max-w-[180px]">
                              {log.actor_name_snapshot || 'System / Auto'}
                            </div>
                            {log.actor_role_snapshot && (
                              <div className="text-[11px] text-zinc-500 capitalize">
                                {log.actor_role_snapshot}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border font-mono ${getActionBadgeColor(
                                log.action
                              )}`}
                            >
                              {formatAction(log.action)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-xs text-zinc-900 font-semibold">
                              {log.entity_type}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-500 truncate max-w-[140px]" title={log.entity_id}>
                              #{log.entity_id.slice(0, 10)}...
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-zinc-600">
                            {log.branch?.name || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openTimeline(
                                    log.entity_type,
                                    log.entity_id,
                                    `${log.entity_type} #${log.entity_id.slice(0, 8)}`
                                  )
                                }
                                className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1"
                                title="View chronological entity timeline"
                              >
                                <IconHistory className="w-3.5 h-3.5" />
                                <span>Timeline</span>
                              </button>

                              {hasDiff && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(log.id)}
                                  className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 transition-colors flex items-center gap-1"
                                  title="Inspect JSON diff"
                                >
                                  {isExpanded ? (
                                    <IconChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <IconChevronRight className="w-3.5 h-3.5" />
                                  )}
                                  <span>Diff</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Diff / Details Row */}
                        {isExpanded && hasDiff && (
                          <tr className="bg-zinc-900 text-zinc-100 font-mono text-xs">
                            <td colSpan={6} className="p-4">
                              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                                {log.reason && (
                                  <div className="text-amber-300 pb-2 border-b border-zinc-800">
                                    <strong className="text-amber-400">Reason:</strong> {log.reason}
                                  </div>
                                )}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {log.old_values && Object.keys(log.old_values).length > 0 && (
                                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                      <div className="text-rose-400 font-bold mb-1.5 flex items-center gap-1">
                                        <span>--- Prior State (Old)</span>
                                      </div>
                                      <pre className="text-[11px] whitespace-pre-wrap break-all text-rose-200">
                                        {JSON.stringify(log.old_values, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {log.new_values && Object.keys(log.new_values).length > 0 && (
                                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                      <div className="text-emerald-400 font-bold mb-1.5 flex items-center gap-1">
                                        <span>+++ Updated State (New)</span>
                                      </div>
                                      <pre className="text-[11px] whitespace-pre-wrap break-all text-emerald-200">
                                        {JSON.stringify(log.new_values, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 mt-2">
                                    <div className="text-zinc-400 font-bold mb-1">Metadata Snapshot</div>
                                    <pre className="text-[11px] whitespace-pre-wrap break-all text-zinc-300">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Entity Timeline Modal */}
      <EntityTimelineDialog
        isOpen={timelineTarget.isOpen}
        onClose={() => setTimelineTarget((prev) => ({ ...prev, isOpen: false }))}
        entityType={timelineTarget.entityType}
        entityId={timelineTarget.entityId}
        entityTitle={timelineTarget.entityTitle}
      />
    </div>
  );
}

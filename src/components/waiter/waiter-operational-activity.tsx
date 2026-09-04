'use client';

import React, { useState, useEffect } from 'react';
import { getWaiterOperationalActivityAction } from '@/server/actions/waiter-activity';
import { WaiterOperationalEvent } from '@/server/services/waiter-activity.service';
import { EntityTimelineDialog } from '@/components/audit/entity-timeline-dialog';
import {
  IconClock,
  IconUser,
  IconAlertTriangle,
  IconCheckCircle,
  IconRefresh,
  IconHistory,
  IconSearch,
  formatAuditShortDate,
} from '@/components/audit/audit-icons';

export interface WaiterOperationalActivityProps {
  branchId: string;
  assignedAreaIds?: string[] | null;
  className?: string;
}

export function WaiterOperationalActivity({
  branchId,
  assignedAreaIds,
  className = '',
}: WaiterOperationalActivityProps) {
  const [items, setItems] = useState<WaiterOperationalEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Timeline dialog state
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

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWaiterOperationalActivityAction({
        branchId,
        assignedAreaIds: assignedAreaIds ?? undefined,
        hours: 48,
      });

      if (res.success && res.events) {
        setItems(res.events);
      } else {
        setError(res.message || 'Failed to load operational activity.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      fetchActivity();
    }
  }, [branchId]);

  const filteredItems = items.filter((item) => {
    if (typeFilter !== 'all' && item.category !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchStaff =
        (item.acceptedByName && item.acceptedByName.toLowerCase().includes(q)) ||
        (item.acceptedByRole && item.acceptedByRole.toLowerCase().includes(q)) ||
        (item.resolvedByName && item.resolvedByName.toLowerCase().includes(q)) ||
        (item.resolvedByRole && item.resolvedByRole.toLowerCase().includes(q));
      const matchTable = item.tableName && item.tableName.toLowerCase().includes(q);
      const matchArea = item.serviceAreaName && item.serviceAreaName.toLowerCase().includes(q);
      const matchNotes = item.notes && item.notes.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      if (!matchStaff && !matchTable && !matchArea && !matchNotes && !matchId) {
        return false;
      }
    }
    return true;
  });

  const formatDurationMinutes = (minutes?: number | null) => {
    if (minutes === undefined || minutes === null) return '—';
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  const openTimeline = (entityType: string, entityId: string, entityTitle?: string) => {
    setTimelineTarget({
      isOpen: true,
      entityType,
      entityId,
      entityTitle,
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header / Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900">48-Hour Operational Activity</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700">
              {filteredItems.length} records
            </span>
          </div>

          <button
            type="button"
            onClick={fetchActivity}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <IconRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh Activity</span>
          </button>
        </div>

        {/* Filter inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-100">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <IconSearch className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search table, staff, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[38px]"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[38px]"
            >
              <option value="all">All Activity Types</option>
              <option value="assistance_request">Assistance Calls</option>
              <option value="order_approval">Order Approvals</option>
              <option value="order_rejection">Order Rejections</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-950 focus:outline-none min-h-[38px]"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed / Confirmed</option>
              <option value="approved">Approved</option>
              <option value="accepted">Accepted / In Progress</option>
              <option value="pending">Pending</option>
              <option value="dismissed">Dismissed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="p-12 text-center text-zinc-500 bg-white border border-zinc-200 rounded-2xl space-y-2">
          <IconRefresh className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
          <p className="text-xs font-medium">Loading operational activity logs...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="p-10 text-center text-zinc-500 bg-white border border-zinc-200 rounded-2xl space-y-2">
          <IconClock className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-bold text-zinc-800">No operational activity in the past 48 hours</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            All completed, accepted, and pending assistance requests and order actions within your assigned service areas will appear here.
          </p>
        </div>
      )}

      {/* Activity List: Responsive Cards */}
      {!loading && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isAssistance = item.category === 'assistance_request';
            const entityType = isAssistance ? 'waiter_request' : 'order';
            const entityId = item.id;

            return (
              <div
                key={`${item.category}-${item.id}`}
                className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
                  item.isOverdue ? 'border-amber-300 bg-amber-50/20' : 'border-zinc-200'
                }`}
              >
                {/* Top Row: Type, Status, Overdue Badge, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${
                        isAssistance
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {isAssistance ? '🔔 Call Waiter' : '🍽️ Order Event'}
                    </span>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        item.status === 'completed' || item.status === 'confirmed' || item.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'accepted' || item.status === 'in_progress'
                          ? 'bg-purple-100 text-purple-800'
                          : item.status === 'dismissed' || item.status === 'rejected'
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>

                    {item.isOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <IconAlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>Overdue (&gt; 15m)</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                    <IconClock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{formatAuditShortDate(item.createdAt)}</span>
                  </div>
                </div>

                {/* Middle Row: Table / Area & Summary */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-700 bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-100">
                  <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                    <span>📍 {item.tableName || 'Direct Request'}</span>
                    {item.serviceAreaName && (
                      <span className="text-zinc-500 font-normal">({item.serviceAreaName})</span>
                    )}
                  </div>

                  {item.notes && (
                    <div className="text-zinc-600 truncate max-w-sm italic">
                      &quot;{item.notes}&quot;
                    </div>
                  )}
                </div>

                {/* Attribution & Timeline Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs pt-1 border-t border-zinc-100">
                  {/* Accepted Info */}
                  <div className="flex items-center gap-1.5 text-zinc-600 min-w-0">
                    <IconUser className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">
                      Accepted by:{' '}
                      <strong className="text-zinc-900">
                        {item.acceptedByName ? (
                          <>
                            <span>{item.acceptedByName}</span>
                            {item.acceptedByRole && (
                              <span className="text-zinc-500 font-normal ml-1">({item.acceptedByRole})</span>
                            )}
                          </>
                        ) : item.status === 'pending' ? (
                          'Not yet accepted'
                        ) : (
                          '—'
                        )}
                      </strong>
                    </span>
                  </div>

                  {/* Resolved Info */}
                  <div className="flex items-center gap-1.5 text-zinc-600 min-w-0">
                    <IconCheckCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">
                      Resolved by:{' '}
                      <strong className="text-zinc-900">
                        {item.resolvedByName ? (
                          <>
                            <span>{item.resolvedByName}</span>
                            {item.resolvedByRole && (
                              <span className="text-zinc-500 font-normal ml-1">({item.resolvedByRole})</span>
                            )}
                          </>
                        ) : item.status === 'completed' || item.status === 'confirmed' ? (
                          'Completed'
                        ) : (
                          '—'
                        )}
                      </strong>
                    </span>
                  </div>

                  {/* Elapsed / Duration */}
                  <div className="flex items-center justify-between sm:justify-start gap-1.5 text-zinc-600">
                    <IconClock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>
                      Elapsed:{' '}
                      <strong className="text-zinc-900 font-mono">
                        {formatDurationMinutes(item.elapsedMinutes)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-end pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() =>
                      openTimeline(
                        entityType,
                        entityId,
                        `${isAssistance ? 'Assistance Request' : 'Order Event'} #${entityId.slice(0, 8)}`
                      )
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center gap-1.5 transition-colors"
                  >
                    <IconHistory className="w-3.5 h-3.5" />
                    <span>View Request Audit Timeline</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entity Timeline Dialog */}
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

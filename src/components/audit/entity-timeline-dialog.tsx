'use client';

import React, { useState, useEffect } from 'react';
import { getEntityTimelineAction } from '@/server/actions/audit';
import { AuditLogRecord } from '@/server/services/audit.service';
import {
  IconX,
  IconClock,
  IconUser,
  IconShield,
  IconChevronDown,
  IconChevronRight,
  IconAlertCircle,
  IconRefresh,
  formatAuditDate,
} from './audit-icons';

export interface EntityTimelineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  branchId?: string;
}

export function EntityTimelineDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
}: EntityTimelineDialogProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !entityType || !entityId) return;

    let isMounted = true;
    async function fetchTimeline() {
      setLoading(true);
      setError(null);
      try {
        const res = await getEntityTimelineAction(entityType, entityId);

        if (!isMounted) return;
        if (res.success && res.timeline) {
          setLogs(res.timeline);
        } else {
          setError(res.message || 'Failed to load timeline history.');
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred loading timeline.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTimeline();

    return () => {
      isMounted = false;
    };
  }, [isOpen, entityType, entityId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatAction = (action: string) => {
    return action.replace(/[._]/g, ' ').toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] text-zinc-950 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/70 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 id="timeline-modal-title" className="text-base sm:text-lg font-bold text-zinc-900 truncate">
              Timeline: {entityTitle || `${entityType} #${entityId.slice(0, 8)}`}
            </h3>
            <p className="text-xs text-zinc-500 truncate mt-0.5">
              Type: <span className="font-mono text-zinc-700">{entityType}</span> &bull; ID:{' '}
              <span className="font-mono text-zinc-700">{entityId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 text-zinc-500">
              <IconRefresh className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Loading historical revisions...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <IconAlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load timeline</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <IconClock className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-sm font-semibold text-zinc-700">No audit records found</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                There are no recorded state modifications or lifecycle events logged for this entity yet.
              </p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
              {logs.map((log) => {
                const isExpanded = !!expandedLogIds[log.id];
                const hasDiff =
                  (log.old_values && Object.keys(log.old_values).length > 0) ||
                  (log.new_values && Object.keys(log.new_values).length > 0) ||
                  (log.metadata && Object.keys(log.metadata).length > 0);

                return (
                  <div key={log.id} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white bg-emerald-600 shadow-xs ring-4 ring-emerald-50" />

                    <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 sm:p-4 shadow-xs hover:border-zinc-300 transition-colors space-y-2">
                      {/* Header line */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200 font-mono">
                          {formatAction(log.action)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                          <IconClock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{formatAuditDate(log.created_at)}</span>
                        </div>
                      </div>

                      {/* Actor Information */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 pt-1 border-t border-zinc-100">
                        <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                          <IconUser className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{log.actor_name_snapshot || 'System / Anonymous'}</span>
                        </div>
                        {log.actor_role_snapshot && (
                          <div className="flex items-center gap-1 text-zinc-500">
                            <IconShield className="w-3 h-3 text-zinc-400" />
                            <span className="capitalize">{log.actor_role_snapshot}</span>
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      {log.reason && (
                        <div className="text-xs bg-amber-50/70 border border-amber-200/60 text-amber-900 rounded-lg p-2 font-medium">
                          <span className="font-semibold text-amber-950">Reason:</span> {log.reason}
                        </div>
                      )}

                      {/* Diff Toggle & Viewer */}
                      {hasDiff && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(log.id)}
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1"
                          >
                            {isExpanded ? <IconChevronDown className="w-3.5 h-3.5" /> : <IconChevronRight className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? 'Hide Details & Snapshot Diff' : 'View Details & Snapshot Diff'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2 bg-zinc-950 text-zinc-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-60">
                              {log.old_values && Object.keys(log.old_values).length > 0 && (
                                <div>
                                  <div className="text-rose-400 font-semibold mb-1">--- Prior State (Old)</div>
                                  <pre className="text-[11px] whitespace-pre-wrap break-all text-rose-200">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && Object.keys(log.new_values).length > 0 && (
                                <div className={log.old_values && Object.keys(log.old_values).length > 0 ? 'mt-2' : ''}>
                                  <div className="text-emerald-400 font-semibold mb-1">+++ Updated State (New)</div>
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
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold bg-zinc-200 hover:bg-zinc-300 text-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

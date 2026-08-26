'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  businessId: string | null;
  businessName: string | null;
  actorId: string | null;
  actorName: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

interface AdminAuditClientProps {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
  currentAction: string;
  currentTargetType: string;
}

export function AdminAuditClient({
  logs,
  total,
  page,
  totalPages,
  currentAction,
  currentTargetType,
}: AdminAuditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [actionQuery, setActionQuery] = useState(currentAction);
  const [targetTypeQuery, setTargetTypeQuery] = useState(currentTargetType);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);

  const applyFilters = (newAction: string, newTargetType: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newAction.trim()) params.set('action', newAction.trim());
    else params.delete('action');

    if (newTargetType.trim() && newTargetType !== 'all') params.set('targetType', newTargetType.trim());
    else params.delete('targetType');

    if (newPage > 1) params.set('page', String(newPage));
    else params.delete('page');

    startTransition(() => {
      router.push(`/admin/audit?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(actionQuery, targetTypeQuery, 1);
  };

  return (
    <div className="space-y-6">
      {/* Filters Form */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 max-w-2xl">
        <input
          type="text"
          value={actionQuery}
          onChange={(e) => setActionQuery(e.target.value)}
          placeholder="Filter by action (e.g. venue.published, super_admin.granted)..."
          className="flex-1 min-w-[200px] rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden transition-all"
        />

        <select
          value={targetTypeQuery}
          onChange={(e) => {
            setTargetTypeQuery(e.target.value);
            applyFilters(actionQuery, e.target.value, 1);
          }}
          className="rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 cursor-pointer"
        >
          <option value="all">All Target Types</option>
          <option value="subscription">Subscription</option>
          <option value="venue_public_profile">Venue Public Profile</option>
          <option value="business">Business Tenant</option>
          <option value="branch">Branch</option>
          <option value="user_profile">User Account</option>
          <option value="user">User</option>
        </select>

        <Button
          type="submit"
          disabled={isPending}
          className="bg-zinc-950 hover:bg-zinc-800 active:scale-[0.97] text-white font-extrabold text-xs px-6 rounded-2xl min-h-[44px] transition-all cursor-pointer"
        >
          {isPending ? 'Filtering...' : 'Filter'}
        </Button>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-white">
          <div className="text-3xl">📋</div>
          <h3 className="text-sm font-black text-zinc-900">No audit logs found.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {actionQuery || targetTypeQuery !== 'all'
              ? 'No audit records match the filter criteria.'
              : 'Security-sensitive platform administrative events will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Logs Table */}
          <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {logs.map((l) => (
                <div key={l.id} className="p-4 sm:p-5 space-y-2 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zinc-950 bg-zinc-100 px-2 py-0.5 rounded-md">
                        {l.action}
                      </span>
                      <Badge variant="neutral" className="text-[10px] font-mono capitalize">
                        {l.targetType}
                      </Badge>
                      {l.businessName && (
                        <span className="text-[11px] font-semibold text-zinc-500">
                          🏢 {l.businessName}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-semibold text-zinc-400">
                      {new Date(l.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-600">
                    <div>
                      <span className="font-bold text-zinc-500">Actor:</span> {l.actorName}{' '}
                      <span className="text-[10px] text-zinc-400 font-mono">({l.actorId || 'system'})</span>
                    </div>

                    <div>
                      <span className="font-bold text-zinc-500">Target ID:</span>{' '}
                      <span className="font-mono text-zinc-800">{l.targetId}</span>
                    </div>
                  </div>

                  {/* Payload expansion */}
                  {l.payload && Object.keys(l.payload).length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedPayloadId(expandedPayloadId === l.id ? null : l.id)}
                        className="text-[11px] font-extrabold text-amber-600 hover:underline"
                      >
                        {expandedPayloadId === l.id ? 'Hide Event Payload ▲' : 'View Event Payload ▼'}
                      </button>

                      {expandedPayloadId === l.id && (
                        <pre className="mt-2 p-3 rounded-2xl bg-zinc-900 text-zinc-100 text-[11px] font-mono overflow-x-auto max-h-48">
                          {JSON.stringify(l.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-xs font-semibold text-zinc-500">
                Page {page} of {totalPages} ({total} total log records)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => applyFilters(actionQuery, targetTypeQuery, page - 1)}
                  className="text-xs font-bold min-h-[36px]"
                >
                  ← Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => applyFilters(actionQuery, targetTypeQuery, page + 1)}
                  className="text-xs font-bold min-h-[36px]"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

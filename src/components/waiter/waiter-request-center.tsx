'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WaiterRequestRecord } from '@/server/services/waiter.service';
import { updateWaiterRequestStatusAction } from '@/server/actions/waiter';
import { WaiterRequestStatus } from '@/lib/validation/waiter';
import { useRealtimeWaiterRequests } from '@/hooks/use-realtime-waiter-requests';

interface WaiterRequestCenterProps {
  initialRequests: WaiterRequestRecord[];
  branchName: string;
  branchId: string;
}

export const WaiterRequestCenter: React.FC<WaiterRequestCenterProps> = ({
  initialRequests,
  branchName,
  branchId,
}) => {
  const router = useRouter();
  const { requests, connectionStatus } = useRealtimeWaiterRequests(initialRequests, branchId);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStatusChange = (requestId: string, nextStatus: WaiterRequestStatus) => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateWaiterRequestStatusAction(requestId, nextStatus);
      if (!res.success) {
        setActionError(res.message || 'Failed to update request status');
      } else {
        router.refresh();
      }
    });
  };

  const typeMap: Record<string, { label: string; icon: string }> = {
    call_waiter: { label: 'Call Waiter', icon: '🔔' },
    need_water: { label: 'Need Water', icon: '💧' },
    need_bill: { label: 'Need Bill', icon: '🍽️' },
    need_assistance: { label: 'General Assistance', icon: '❓' },
  };

  const statusVariantMap: Record<WaiterRequestStatus, 'warning' | 'success' | 'neutral' | 'destructive'> = {
    pending: 'warning',
    accepted: 'warning',
    completed: 'success',
    dismissed: 'neutral',
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900">
          ⚠️ {actionError}
        </div>
      )}

      {/* Header controls & Realtime status */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
            Active Assistance Calls ({requests.length})
          </div>
          {connectionStatus === 'connected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected ({branchName})
            </span>
          )}
          {connectionStatus === 'reconnecting' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              Reconnecting...
            </span>
          )}
        </div>

        <Button
          variant="outline"
          className="text-xs font-bold"
          onClick={() => router.refresh()}
          disabled={isPending}
        >
          {isPending ? 'Updating...' : '🔄 Refresh Queue'}
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            🙋‍♂️
          </div>
          <h3 className="text-lg font-bold text-zinc-950">No Active Assistance Calls</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            There are currently no pending table requests for this branch. Customer requests will appear here automatically in realtime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => {
            const typeInfo = typeMap[req.request_type] || { label: req.request_type, icon: '🛎️' };

            return (
              <div
                key={req.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
                    <div>
                      <div className="text-lg font-black text-zinc-950 tracking-tight flex items-center gap-2">
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </div>
                      <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1 mt-1">
                        {req.table ? (
                          <span>📍 {req.table.name}</span>
                        ) : (
                          <span className="text-zinc-500 font-normal">Direct Request</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusVariantMap[req.status] || 'neutral'}>
                      {req.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>
                      Received:{' '}
                      {new Date(req.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {req.notes && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950 italic font-medium">
                      📝 Note: &quot;{req.notes}&quot;
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2">
                  {req.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        className="text-xs font-bold"
                        onClick={() => handleStatusChange(req.id, 'accepted')}
                        disabled={isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        className="text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleStatusChange(req.id, 'completed')}
                        disabled={isPending}
                      >
                        Complete
                      </Button>
                    </>
                  )}

                  {req.status === 'accepted' && (
                    <Button
                      className="col-span-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleStatusChange(req.id, 'completed')}
                      disabled={isPending}
                    >
                      Mark Completed
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WaiterRequestRecord } from '@/server/services/waiter.service';
import type { OrderRecord } from '@/server/services/order.service';
import { updateWaiterRequestStatusAction } from '@/server/actions/waiter';
import { WaiterRequestStatus } from '@/lib/validation/waiter';
import { useRealtimeWaiterRequests } from '@/hooks/use-realtime-waiter-requests';

interface WaiterRequestCenterProps {
  initialRequests: WaiterRequestRecord[];
  branchName: string;
  branchId: string;
  assignedAreaIds?: string[] | null;
  canManageRequests?: boolean;
}

export const WaiterRequestCenter: React.FC<WaiterRequestCenterProps> = ({
  initialRequests,
  branchName,
  branchId,
  assignedAreaIds,
  canManageRequests = true,
}) => {
  const router = useRouter();
  const { requests, connectionStatus } = useRealtimeWaiterRequests(initialRequests, branchId, assignedAreaIds);
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

      {/* Pending Guest Order Approvals Section */}
      <PendingOrderApprovalsSection branchId={branchId} canManageRequests={canManageRequests} />

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

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            className="text-xs font-black bg-zinc-950 text-white hover:bg-zinc-800 shadow-xs cursor-pointer min-h-[40px]"
            onClick={() => router.push('/dashboard/waiter/menu')}
          >
            🍽️ Take New Order / Menu
          </Button>

          <Button
            variant="outline"
            className="text-xs font-bold min-h-[40px]"
            onClick={() => router.refresh()}
            disabled={isPending}
          >
            {isPending ? 'Updating...' : '🔄 Refresh Queue'}
          </Button>
        </div>
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
                  {canManageRequests ? (
                    <>
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
                    </>
                  ) : (
                    <div className="col-span-2 text-[11px] text-zinc-400 font-bold text-center italic py-1 border border-dashed border-zinc-200 rounded-lg">
                      🔒 Read-Only Waiter View
                    </div>
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

function PendingOrderApprovalsSection({
  branchId,
  canManageRequests = true,
}: {
  branchId: string;
  canManageRequests?: boolean;
}) {
  const [approvals, setApprovals] = React.useState<OrderRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchApprovals = React.useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { getPendingApprovalsAction } = await import('@/server/actions/waiter-approval');
      const res = await getPendingApprovalsAction(branchId, user.user.id);
      if (res.success && res.orders) {
        setApprovals(res.orders as unknown as OrderRecord[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await fetchApprovals();
      }
    };
    loadData();
    const interval = setInterval(() => {
      if (isMounted) fetchApprovals();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchApprovals]);

  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId);
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const { approveGuestOrderAction } = await import('@/server/actions/waiter-approval');
      await approveGuestOrderAction(orderId, user.user.id);
      await fetchApprovals();
    }
    setProcessingId(null);
  };

  const handleReject = async (orderId: string) => {
    setProcessingId(orderId);
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const { rejectGuestOrderAction } = await import('@/server/actions/waiter-approval');
      await rejectGuestOrderAction(orderId, user.user.id, 'Rejected by waiter');
      await fetchApprovals();
    }
    setProcessingId(null);
  };

  if (loading) return null;

  if (approvals.length === 0) {
    return (
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h3 className="font-extrabold text-sm text-amber-950">
              Pending Order Approvals (0)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
            Queue Empty
          </span>
        </div>
        <p className="text-xs text-amber-900/80 font-medium">
          No orders are waiting for your approval. New customer orders requiring waiter confirmation will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <h3 className="font-extrabold text-sm text-amber-950">
            Pending QR Order Approvals ({approvals.length})
          </h3>
        </div>
        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
          Action Required
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {approvals.map((ord) => (
          <div key={ord.id} className="bg-white border border-amber-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-start justify-between border-b border-zinc-100 pb-2">
              <div>
                <span className="font-extrabold text-xs text-zinc-950">
                  Order #{ord.order_number_formatted || ord.order_number}
                </span>
                <p className="text-[11px] text-emerald-800 font-bold mt-0.5">
                  📍 {ord.table?.name || 'Dining Table'} {ord.service_area_name_snapshot ? `(${ord.service_area_name_snapshot})` : ''}
                </p>
              </div>
              <span className="text-xs font-black text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                {(ord.total_cents / 100).toFixed(2)} {ord.currency}
              </span>
            </div>

            <div className="space-y-1 text-xs text-zinc-600">
              <p>Customer: <strong className="text-zinc-900 font-bold">{ord.guest_name || 'Guest User'}</strong></p>
              <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded border border-emerald-200">
                  ✓ QR Session
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded border border-emerald-200">
                  ✓ Account
                </span>
                {ord.location_verified && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded border border-emerald-200">
                    ✓ Location
                  </span>
                )}
              </div>
            </div>

            {canManageRequests ? (
              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(ord.id)}
                  disabled={processingId === ord.id}
                  className="w-1/2 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-50 min-h-[44px]"
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(ord.id)}
                  disabled={processingId === ord.id}
                  className="w-1/2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
                >
                  {processingId === ord.id ? 'Approving...' : 'Approve Order'}
                </Button>
              </div>
            ) : (
              <div className="pt-2 text-[11px] text-zinc-400 font-bold text-center italic py-1 border border-dashed border-zinc-200 rounded-lg">
                🔒 Approval Disabled
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

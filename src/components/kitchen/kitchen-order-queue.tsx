'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderRecord } from '@/server/services/order.service';
import { updateOrderStatusAction } from '@/server/actions/order';
import { OrderStatus } from '@/lib/validation/order';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { useRealtimeKitchen } from '@/hooks/use-realtime-kitchen';
import { kitchenSoundEngine } from '@/lib/sound/kitchen-sound-engine';

interface KitchenOrderQueueProps {
  initialOrders: OrderRecord[];
  branchName: string;
  branchId: string;
  canUpdate?: boolean;
}

export const KitchenOrderQueue: React.FC<KitchenOrderQueueProps> = ({
  initialOrders,
  branchName,
  branchId,
  canUpdate = true,
}) => {
  const router = useRouter();
  const { orders, connectionStatus } = useRealtimeKitchen(initialOrders, branchId);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(() => kitchenSoundEngine.isSoundMuted());

  const handleSoundToggle = () => {
    const nextMuted = !isMuted;
    kitchenSoundEngine.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (!nextMuted) {
      kitchenSoundEngine.initAudioContext();
    }
  };

  const handleStatusChange = (orderId: string, nextStatus: OrderStatus) => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, nextStatus);
      if (!res.success) {
        setActionError(res.message || 'Failed to update order status');
      } else {
        router.refresh();
      }
    });
  };

  const statusMap: Record<
    OrderStatus,
    { title: string; badge: 'warning' | 'success' | 'neutral' | 'destructive'; icon: string }
  > = {
    pending: { title: 'Pending Approval', badge: 'warning', icon: '⏳' },
    confirmed: { title: 'Confirmed', badge: 'warning', icon: '📋' },
    preparing: { title: 'In Preparation', badge: 'warning', icon: '🍳' },
    ready: { title: 'Ready to Serve', badge: 'success', icon: '🔔' },
    completed: { title: 'Completed', badge: 'neutral', icon: '✅' },
    cancelled: { title: 'Cancelled', badge: 'destructive', icon: '❌' },
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
            Active Kitchen Orders ({orders.length})
          </div>
          {connectionStatus === 'connected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Realtime Active ({branchName})
            </span>
          )}
          {connectionStatus === 'reconnecting' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
              Reconnecting...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="text-xs font-bold flex items-center gap-1.5"
            onClick={handleSoundToggle}
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
            <span>{isMuted ? 'Sound Muted' : 'New Order Chime On'}</span>
          </Button>

          <Button
            variant="outline"
            className="text-xs font-bold"
            onClick={() => router.refresh()}
            disabled={isPending}
          >
            {isPending ? 'Updating...' : '🔄 Refresh Queue'}
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            👨‍🍳
          </div>
          <h3 className="text-lg font-bold text-zinc-950">Kitchen Queue is Clear</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            There are currently no active pending or preparing orders for this branch. New guest orders will appear here automatically in realtime with audio chime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => {
            const statusInfo = statusMap[order.status] || {
              title: order.status,
              badge: 'neutral',
              icon: '📦',
            };

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
                    <div>
                      <span className="text-2xl font-black text-zinc-950 tracking-tight">
                        {order.order_number_formatted}
                      </span>
                      <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1 mt-0.5">
                        {order.table ? (
                          <span>📍 {order.table.name}</span>
                        ) : (
                          <span className="text-zinc-500 font-normal">Direct Order</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusInfo.badge}>
                      {statusInfo.icon} {statusInfo.title}
                    </Badge>
                  </div>

                  {/* Metadata */}
                  <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>
                      Placed:{' '}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {order.guest_name && (
                      <span className="font-semibold text-zinc-700">Guest: {order.guest_name}</span>
                    )}
                  </div>

                  {/* Special Notes */}
                  {order.guest_notes && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950 italic font-medium">
                      📝 Note: &quot;{order.guest_notes}&quot;
                    </div>
                  )}

                  {/* Items Breakdown */}
                  <div className="space-y-2 pt-1">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs space-y-0.5 border-b border-zinc-50 pb-2 last:border-0"
                      >
                        <div className="flex items-start justify-between font-bold text-zinc-950">
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono text-zinc-500 text-[11px]">
                              {item.quantity}x
                            </span>
                            <span>{item.item_name_snapshot}</span>
                          </span>
                          <span className="font-mono text-zinc-600 font-semibold">
                            {formatCurrency(item.line_subtotal_cents, order.currency)}
                          </span>
                        </div>

                        {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                          <div className="pl-5 text-[11px] text-zinc-500 space-y-0.5">
                            {item.order_item_modifiers.map((mod) => (
                              <div key={mod.id}>+ {mod.option_name_snapshot}</div>
                            ))}
                          </div>
                        )}

                        {item.special_instructions && (
                          <div className="pl-5 text-[11px] text-amber-900 font-medium italic">
                            📝 {item.special_instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Action Workflow */}
                <div className="pt-3 border-t border-zinc-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-600 font-bold mb-2">
                    <span>Total:</span>
                    <span className="text-sm font-black text-zinc-950">
                      {formatCurrency(order.total_cents, order.currency)}
                    </span>
                  </div>

                  {canUpdate ? (
                    <>
                      {order.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            className="text-xs font-bold text-red-600 hover:bg-red-50"
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="text-xs font-extrabold"
                            onClick={() => handleStatusChange(order.id, 'confirmed')}
                            disabled={isPending}
                          >
                            Confirm Order
                          </Button>
                        </div>
                      )}

                      {order.status === 'confirmed' && (
                        <Button
                          className="w-full text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleStatusChange(order.id, 'preparing')}
                          disabled={isPending}
                        >
                          🍳 Start Preparing
                        </Button>
                      )}

                      {order.status === 'preparing' && (
                        <Button
                          className="w-full text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleStatusChange(order.id, 'ready')}
                          disabled={isPending}
                        >
                          🔔 Mark Ready to Serve
                        </Button>
                      )}

                      {order.status === 'ready' && (
                        <Button
                          className="w-full text-xs font-extrabold bg-zinc-900 hover:bg-zinc-800 text-white"
                          onClick={() => handleStatusChange(order.id, 'completed')}
                          disabled={isPending}
                        >
                          ✅ Mark Completed
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-400 font-bold text-center italic py-1 border border-dashed border-zinc-200 rounded-lg">
                      🔒 Read-Only Kitchen View
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

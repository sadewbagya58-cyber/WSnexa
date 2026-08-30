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
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
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

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setActionError(null);
    setProcessingOrderId(orderId);
    try {
      const res = await updateOrderStatusAction(orderId, nextStatus);
      if (!res.success) {
        setActionError(res.message || 'Failed to update order status');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order status';
      setActionError(msg);
    } finally {
      setProcessingOrderId(null);
    }
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
            className="text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            onClick={handleSoundToggle}
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
            <span>{isMuted ? 'Sound Muted' : 'New Order Chime On'}</span>
          </Button>

          <Button
            variant="outline"
            className="text-xs font-bold min-h-[40px]"
            onClick={() => router.refresh()}
            disabled={processingOrderId !== null}
          >
            🔄 Refresh Queue
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
          {[...orders]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id))
            .map((order) => {
              const statusInfo = statusMap[order.status] || {
                title: order.status,
                badge: 'neutral',
                icon: '📦',
              };

              const isProcessing = processingOrderId === order.id;

              // Resolve clean Table + Service Area label
              const tableName =
                order.table?.name ||
                (order.table?.table_number ? `Table ${order.table.table_number}` : null);
              const serviceAreaName =
                order.service_area_name_snapshot ||
                order.table?.service_area?.name ||
                null;

              const items = order.items || [];

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-all"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <div className="text-lg font-black text-zinc-950 tracking-tight flex items-center gap-2">
                          <span>#{order.order_number_formatted || order.order_number}</span>
                        </div>
                        <div className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5 mt-1">
                          {tableName ? (
                            <>
                              <span>📍 {tableName}</span>
                              {serviceAreaName && (
                                <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                                  {serviceAreaName}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-zinc-500 font-normal">Takeout / Direct Order</span>
                          )}
                        </div>
                        {order.guest_name && (
                          <div className="text-[11px] font-medium text-zinc-500 mt-0.5">
                            Guest: <strong className="text-zinc-800">{order.guest_name}</strong>
                          </div>
                        )}
                      </div>
                      <Badge variant={statusInfo.badge}>
                        {statusInfo.icon} {statusInfo.title}
                      </Badge>
                    </div>

                    {/* Order metadata & timing */}
                    <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                      <span>
                        Received:{' '}
                        {new Date(order.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>
                        {Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)}m ago
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Order Items ({items.reduce((sum, item) => sum + item.quantity, 0)})
                      </div>
                      <div className="divide-y divide-zinc-100 border rounded-xl border-zinc-100 overflow-hidden">
                        {items.map((item) => {
                          const modifiersList = (item.order_item_modifiers || (item as unknown as { modifiers?: Array<{ id: string; option_name_snapshot: string; group_name_snapshot?: string; modifier_name_snapshot?: string }> }).modifiers || []) as Array<{ id: string; option_name_snapshot: string; group_name_snapshot?: string; modifier_name_snapshot?: string }>;

                          return (
                            <div key={item.id} className="p-2.5 bg-zinc-50/50 space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-extrabold text-zinc-900">
                                  {item.quantity}x {item.item_name_snapshot}
                                </span>
                              </div>

                              {/* Item Modifiers */}
                              {modifiersList.length > 0 && (
                                <div className="pl-4 text-[10px] text-zinc-500 font-medium space-y-0.5">
                                  {modifiersList.map((mod) => (
                                    <div key={mod.id} className="flex items-center gap-1">
                                      <span>•</span>
                                      <span>{mod.modifier_name_snapshot || mod.group_name_snapshot}</span>
                                      <span className="text-zinc-400">({mod.option_name_snapshot})</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Item Special Instructions */}
                              {item.special_instructions && (
                                <div className="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded font-medium italic border border-amber-200/60">
                                  Note: &quot;{item.special_instructions}&quot;
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order Notes */}
                    {order.guest_notes && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 italic font-medium">
                        📝 Order Note: &quot;{order.guest_notes}&quot;
                      </div>
                    )}
                  </div>

                  {/* Operational Action Controls */}
                  <div className="pt-3 border-t border-zinc-100">
                    {canUpdate ? (
                      <>
                        {order.status === 'pending' && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="text-xs font-bold text-red-600 hover:bg-red-50 min-h-[44px]"
                              onClick={() => handleStatusChange(order.id, 'cancelled')}
                              disabled={isProcessing}
                            >
                              {isProcessing ? '...' : 'Cancel'}
                            </Button>
                            <Button
                              className="text-xs font-extrabold min-h-[44px]"
                              onClick={() => handleStatusChange(order.id, 'confirmed')}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Confirming...' : 'Confirm Order'}
                            </Button>
                          </div>
                        )}

                        {order.status === 'confirmed' && (
                          <Button
                            className="w-full text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
                            onClick={() => handleStatusChange(order.id, 'preparing')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Updating...' : '🍳 Start Preparing'}
                          </Button>
                        )}

                        {order.status === 'preparing' && (
                          <Button
                            className="w-full text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
                            onClick={() => handleStatusChange(order.id, 'ready')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Updating...' : '🔔 Mark Ready to Serve'}
                          </Button>
                        )}

                        {order.status === 'ready' && (
                          <Button
                            className="w-full text-xs font-extrabold bg-zinc-900 hover:bg-zinc-800 text-white min-h-[44px]"
                            onClick={() => handleStatusChange(order.id, 'completed')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Updating...' : '✅ Mark Completed'}
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

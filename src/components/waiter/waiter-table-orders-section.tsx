'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getActiveTableOrdersAction } from '@/server/actions/waiter-approval';
import { StaffCancelOrderModal } from '@/components/orders/staff-cancel-order-modal';
import { StaffCancelItemModal } from '@/components/orders/staff-cancel-item-modal';
import { formatCurrency } from '@/features/cart/cart-calculations';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WaiterTableOrdersSectionProps {
  branchId: string;
  canManageOrders?: boolean;
}

export function WaiterTableOrdersSection({
  branchId,
  canManageOrders = true,
}: WaiterTableOrdersSectionProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<any | null>(null);
  const [cancelItemTarget, setCancelItemTarget] = useState<{
    orderId: string;
    item: any;
    orderStatus: string;
    currency: string;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getActiveTableOrdersAction(branchId);
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.warn('[WaiterTableOrdersSection] fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [branchId]);

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;

    fetchOrders();

    const initRealtime = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        channel = supabase
          .channel(`waiter_active_table_orders_${branchId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              filter: `branch_id=eq.${branchId}`,
            },
            () => {
              if (isMounted) fetchOrders();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'order_items',
            },
            () => {
              if (isMounted) fetchOrders();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[WaiterTableOrdersSection] realtime subscription error:', err);
      }
    };

    initRealtime();

    const interval = setInterval(() => {
      if (isMounted) fetchOrders();
    }, 8000);

    return () => {
      isMounted = false;
      if (channel) {
        import('@/lib/supabase/client').then(({ createClient }) => {
          const supabase = createClient();
          supabase.removeChannel(channel as unknown as ReturnType<typeof supabase.channel>);
        });
      }
      clearInterval(interval);
    };
  }, [branchId, fetchOrders]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'neutral';
      case 'preparing':
        return 'warning';
      case 'ready':
        return 'success';
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳ Pending';
      case 'confirmed':
        return '📋 Confirmed';
      case 'preparing':
        return '🍳 Preparing';
      case 'ready':
        return '✅ Ready to Serve';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3 shadow-2xs">
        <span className="text-2xl animate-spin inline-block">⏳</span>
        <p className="text-xs text-zinc-500 font-bold">Loading active table orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
        <div>
          <h3 className="font-extrabold text-sm text-zinc-950 flex items-center gap-2">
            <span>🍽️</span>
            <span>Active Table Orders ({orders.length})</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Floor table orders in preparation or ready for delivery. Waiters can adjust items or cancel orders.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs font-bold min-h-[38px] px-3"
        >
          {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl p-10 text-center space-y-2">
          <span className="text-3xl">🍽️</span>
          <h4 className="font-extrabold text-sm text-zinc-800">No Active Table Orders</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            There are currently no active dining orders on the floor. When guests or waiters fire orders, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => {
            const items = order.order_items || [];
            const currency = order.currency || 'USD';

            return (
              <div
                key={order.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Table & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-zinc-950">
                          📍 {order.table?.name || 'Table'}
                        </span>
                        {order.service_area_name_snapshot && (
                          <span className="text-[10px] text-zinc-500 font-bold bg-zinc-100 px-2 py-0.5 rounded-full">
                            {order.service_area_name_snapshot}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-zinc-500 mt-0.5 block">
                        Order #{order.order_number_formatted || order.order_number}
                      </span>
                    </div>

                    <div className="text-right">
                      <Badge variant={getStatusBadgeVariant(order.status)} className="text-[11px] font-black">
                        {getStatusLabel(order.status)}
                      </Badge>
                      <span className="text-[10px] text-zinc-400 font-medium block mt-1">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                      Order Items ({items.length})
                    </span>

                    <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto pr-1">
                      {items.map((item: any) => {
                        const remainingQty = item.quantity - (item.cancelled_quantity || 0);
                        const isCancelled = item.status === 'cancelled' || remainingQty <= 0;

                        return (
                          <div
                            key={item.id}
                            className="py-1.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-zinc-900">
                                {remainingQty > 0 ? `${remainingQty}x ` : `${item.quantity}x `}
                                {item.item_name_snapshot || 'Item'}
                              </span>

                              {item.cancelled_quantity > 0 && (
                                <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {item.cancelled_quantity} cancelled
                                </span>
                              )}

                              {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                                <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                                  {item.order_item_modifiers.map((m: any) => m.modifier_name_snapshot).join(', ')}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-zinc-700">
                                {formatCurrency(item.unit_price_cents_snapshot * remainingQty, currency)}
                              </span>

                              {canManageOrders && !isCancelled && remainingQty > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCancelItemTarget({
                                      orderId: order.id,
                                      item,
                                      orderStatus: order.status,
                                      currency,
                                    })
                                  }
                                  className="text-[10px] font-bold text-zinc-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors cursor-pointer"
                                  title="Cancel or adjust item"
                                >
                                  ✕ Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer: Total & Cancel Entire Order */}
                <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">Total</span>
                    <span className="text-sm font-black text-zinc-950">
                      {formatCurrency(order.total_cents, currency)}
                    </span>
                  </div>

                  {canManageOrders && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelOrderTarget(order)}
                      className="text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 min-h-[38px] cursor-pointer"
                    >
                      🚫 Cancel Order
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Cancel Whole Order Modal */}
      {cancelOrderTarget && (
        <StaffCancelOrderModal
          isOpen={Boolean(cancelOrderTarget)}
          onClose={() => setCancelOrderTarget(null)}
          orderId={cancelOrderTarget.id}
          orderNumberFormatted={cancelOrderTarget.order_number_formatted || cancelOrderTarget.order_number}
          channel="waiter_menu"
          currentStatus={cancelOrderTarget.status}
          isPaid={cancelOrderTarget.payment_status === 'paid'}
          totalCents={cancelOrderTarget.total_cents}
          currency={cancelOrderTarget.currency || 'USD'}
          onSuccess={() => {
            setCancelOrderTarget(null);
            fetchOrders();
          }}
        />
      )}

      {/* Staff Cancel Item Modal */}
      {cancelItemTarget && (
        <StaffCancelItemModal
          isOpen={Boolean(cancelItemTarget)}
          onClose={() => setCancelItemTarget(null)}
          orderId={cancelItemTarget.orderId}
          orderItemId={cancelItemTarget.item.id}
          itemName={cancelItemTarget.item.item_name_snapshot}
          unitPriceCents={cancelItemTarget.item.unit_price_cents_snapshot}
          quantity={cancelItemTarget.item.quantity}
          cancelledQuantity={cancelItemTarget.item.cancelled_quantity || 0}
          channel="waiter_menu"
          currentStatus={cancelItemTarget.orderStatus}
          currency={cancelItemTarget.currency}
          onSuccess={() => {
            setCancelItemTarget(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}

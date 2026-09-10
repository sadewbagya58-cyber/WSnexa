'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderRecord } from '@/server/services/order.service';
import { kitchenSoundEngine } from '@/lib/sound/kitchen-sound-engine';
import { RealtimeConnectionStatus } from './use-realtime-order';

export interface CancelledOrderNotice {
  orderId: string;
  orderNumber: string;
  tableLabel: string;
  serviceArea?: string;
  cancelledAt: string;
  cancellationReason?: string;
  itemsSummary: string;
}

export function useRealtimeKitchen(initialOrders: OrderRecord[], branchId: string) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [recentCancellations, setRecentCancellations] = useState<CancelledOrderNotice[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const supabase = createClient();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const acknowledgeCancellation = (orderId: string) => {
    setRecentCancellations((prev) => prev.filter((c) => c.orderId !== orderId));
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      setConnectionStatus('connecting');

      channel = supabase
        .channel(`kitchen_queue_${branchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: 'approval_status=eq.approved',
          },
          async (payload) => {
            const newOrder = payload.new as OrderRecord;
            if (!newOrder || !newOrder.id || newOrder.branch_id !== branchId) return;

            // Fetch complete order with item relations including status and cancelled_quantity (QA-12)
            const { data } = await supabase
              .from('orders')
              .select(`
                *,
                table:dining_tables(id, name, code, table_number, service_area:service_areas(id, name)),
                items:order_items(
                  id,
                  menu_item_id,
                  item_name_snapshot,
                  unit_price_cents_snapshot,
                  quantity,
                  cancelled_quantity,
                  status,
                  line_subtotal_cents,
                  special_instructions,
                  order_item_modifiers(
                    id,
                    group_name_snapshot,
                    option_name_snapshot,
                    additional_price_cents_snapshot
                  )
                )
              `)
              .eq('id', newOrder.id)
              .maybeSingle();

            const fullOrder = (data as unknown as OrderRecord) || newOrder;

            setOrders((prev) => {
              const exists = prev.some((o) => o.id === fullOrder.id);
              if (exists) return prev;
              const next = [fullOrder, ...prev];
              return next.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id)
              );
            });

            // Trigger kitchen sound notification for new order
            kitchenSoundEngine.playNewOrderChime(fullOrder.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: 'approval_status=eq.approved',
          },
          async (payload) => {
            const updatedRow = payload.new as Partial<OrderRecord>;
            if (!updatedRow.id || updatedRow.branch_id !== branchId) return;

            // QA-10: When order is cancelled, remove from active queue and publish prominent notice
            if (updatedRow.status === 'cancelled') {
              setOrders((prev) => {
                const existing = prev.find((o) => o.id === updatedRow.id);
                const tableLabel =
                  existing?.table?.name ||
                  (existing?.table?.table_number ? `Table ${existing.table.table_number}` : 'Takeout / Direct');
                const serviceArea =
                  existing?.service_area_name_snapshot ||
                  existing?.table?.service_area?.name;
                const itemsSummary = (existing?.items || [])
                  .filter((i) => i.status !== 'cancelled')
                  .map((i) => `${i.quantity}x ${i.item_name_snapshot}`)
                  .join(', ') || 'All items';

                const notice: CancelledOrderNotice = {
                  orderId: updatedRow.id!,
                  orderNumber: existing?.order_number_formatted || `#${existing?.order_number || updatedRow.order_number || ''}`,
                  tableLabel,
                  serviceArea,
                  cancelledAt: updatedRow.cancelled_at || new Date().toISOString(),
                  cancellationReason: updatedRow.cancellation_reason || existing?.cancellation_reason || 'Order cancelled by staff/guest',
                  itemsSummary,
                };

                setRecentCancellations((notices) => [
                  notice,
                  ...notices.filter((n) => n.orderId !== updatedRow.id),
                ].slice(0, 10));

                kitchenSoundEngine.playCancellationAlert(updatedRow.id!);
                return prev.filter((o) => o.id !== updatedRow.id);
              });
              return;
            }

            if (updatedRow.status === 'completed') {
              setOrders((prev) => prev.filter((o) => o.id !== updatedRow.id));
              return;
            }

            // If order was not previously in active queue, or if updated, re-fetch full details
            // to ensure item-level cancellations, adjustments, and modifier changes are reflected (QA-12)
            const { data } = await supabase
              .from('orders')
              .select(`
                *,
                table:dining_tables(id, name, code, table_number, service_area:service_areas(id, name)),
                items:order_items(
                  id,
                  menu_item_id,
                  item_name_snapshot,
                  unit_price_cents_snapshot,
                  quantity,
                  cancelled_quantity,
                  status,
                  line_subtotal_cents,
                  special_instructions,
                  order_item_modifiers(
                    id,
                    group_name_snapshot,
                    option_name_snapshot,
                    additional_price_cents_snapshot
                  )
                )
              `)
              .eq('id', updatedRow.id!)
              .maybeSingle();

            if (data) {
              const fullUpdatedOrder = data as unknown as OrderRecord;
              setOrders((prev) => {
                const existingIndex = prev.findIndex((o) => o.id === updatedRow.id);
                if (existingIndex === -1) {
                  const next = [fullUpdatedOrder, ...prev];
                  kitchenSoundEngine.playNewOrderChime(fullUpdatedOrder.id);
                  return next.sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id)
                  );
                }
                return prev.map((o) => (o.id === fullUpdatedOrder.id ? fullUpdatedOrder : o));
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            setConnectionStatus('reconnecting');
          } else if (status === 'CLOSED') {
            setConnectionStatus('offline');
          }
        });
    };

    setupSubscription();

    // Fallback polling every 10s
    pollTimerRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select(`
            *,
            table:dining_tables(id, name, code, table_number, service_area:service_areas(id, name)),
            items:order_items(
              id,
              menu_item_id,
              item_name_snapshot,
              unit_price_cents_snapshot,
              quantity,
              cancelled_quantity,
              status,
              line_subtotal_cents,
              special_instructions,
              order_item_modifiers(
                id,
                group_name_snapshot,
                option_name_snapshot,
                additional_price_cents_snapshot
              )
            )
          `)
          .eq('branch_id', branchId)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: false });

        if (data) {
          setOrders(data as unknown as OrderRecord[]);
        }
      } catch (err: unknown) {
        console.warn('Kitchen polling fallback encountered error:', err);
      }
    }, 10000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [branchId, supabase]);

  return { orders, setOrders, connectionStatus, recentCancellations, acknowledgeCancellation };
}

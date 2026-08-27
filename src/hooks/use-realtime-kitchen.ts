'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderRecord } from '@/server/services/order.service';
import { kitchenSoundEngine } from '@/lib/sound/kitchen-sound-engine';
import { RealtimeConnectionStatus } from './use-realtime-order';

export function useRealtimeKitchen(initialOrders: OrderRecord[], branchId: string) {
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const supabase = createClient();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

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
            filter: `branch_id=eq.${branchId}`,
          },
          async (payload) => {
            const newOrder = payload.new as OrderRecord;
            if (!newOrder || !newOrder.id) return;

            // Fetch complete order with item relations
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

            const fullOrder = (data as unknown as OrderRecord & { approval_status?: string }) || newOrder;
            if (fullOrder.approval_status === 'pending_waiter_approval' || fullOrder.approval_status === 'rejected') {
              return;
            }

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
            filter: `branch_id=eq.${branchId}`,
          },
          async (payload) => {
            const updatedRow = payload.new as Partial<OrderRecord & { approval_status?: string }>;
            if (!updatedRow.id) return;

            if (updatedRow.approval_status === 'pending_waiter_approval' || updatedRow.approval_status === 'rejected') {
              setOrders((prev) => prev.filter((o) => o.id !== updatedRow.id));
              return;
            }

            setOrders((prev) => {
              const existingIndex = prev.findIndex((o) => o.id === updatedRow.id);
              if (existingIndex === -1 && updatedRow.approval_status === 'approved') {
                // Fetch full order to add to kitchen queue
                supabase
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
                  .maybeSingle()
                  .then(({ data }) => {
                    if (data) {
                      setOrders((curr) => {
                        const next = [data as unknown as OrderRecord, ...curr];
                        return next.sort(
                          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id)
                        );
                      });
                      kitchenSoundEngine.playNewOrderChime(data.id);
                    }
                  });
                return prev;
              }

              if (updatedRow.status === 'completed' || updatedRow.status === 'cancelled') {
                return prev.filter((o) => o.id !== updatedRow.id);
              }

              return prev.map((o) => {
                if (o.id === updatedRow.id) {
                  return { ...o, ...updatedRow } as OrderRecord;
                }
                return o;
              });
            });
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

  return { orders, setOrders, connectionStatus };
}

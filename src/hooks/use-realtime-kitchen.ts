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
                table:dining_tables(id, name, code, table_number),
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

            const fullOrder = (data as unknown as OrderRecord) || newOrder;

            setOrders((prev) => {
              const exists = prev.some((o) => o.id === fullOrder.id);
              if (exists) return prev;
              return [fullOrder, ...prev];
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
          (payload) => {
            const updatedRow = payload.new as Partial<OrderRecord>;
            if (!updatedRow.id || !updatedRow.status) return;

            setOrders((prev) => {
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
            table:dining_tables(id, name, code, table_number),
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
          .order('created_at', { ascending: true });

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

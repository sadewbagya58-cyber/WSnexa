'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderRecord } from '@/server/services/order.service';
import { updateActiveOrderStatusInStorage } from '@/features/cart/active-order-storage';

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export function useRealtimeOrder(initialOrder: OrderRecord, accessToken?: string) {
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const supabase = createClient();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      setConnectionStatus('connecting');

      channel = supabase
        .channel(`order_tracking_${initialOrder.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${initialOrder.id}`,
          },
          (payload) => {
            const updatedRow = payload.new as Partial<OrderRecord>;
            if (updatedRow.status) {
              setOrder((prev) => {
                const nextOrder = { ...prev, ...updatedRow } as OrderRecord;
                updateActiveOrderStatusInStorage(nextOrder.branch_id, nextOrder.id, nextOrder.status);
                return nextOrder;
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

    // Fallback polling every 8 seconds to ensure updates are never missed
    pollTimerRef.current = setInterval(async () => {
      try {
        let query = supabase.from('orders').select('*').eq('id', initialOrder.id);
        if (accessToken) {
          query = query.eq('access_token', accessToken);
        }
        const { data } = await query.maybeSingle();

        if (data && data.status) {
          setOrder((prev) => {
            if (prev.status !== data.status || prev.updated_at !== data.updated_at) {
              const nextOrder = { ...prev, ...data } as OrderRecord;
              updateActiveOrderStatusInStorage(nextOrder.branch_id, nextOrder.id, nextOrder.status);
              return nextOrder;
            }
            return prev;
          });
        }
      } catch (err: unknown) {
        console.warn('Order polling fallback encountered error:', err);
      }
    }, 8000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [initialOrder.id, initialOrder.branch_id, accessToken, supabase]);

  return { order, connectionStatus };
}

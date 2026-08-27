'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderRecord } from '@/server/services/order.service';
import { updateActiveOrderStatusInStorage } from '@/features/cart/active-order-storage';
import { getPublicOrderTrackingStateAction } from '@/server/actions/order';

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export function useRealtimeOrder(initialOrder: OrderRecord, accessToken?: string) {
  const [order, setOrder] = useState<OrderRecord>(initialOrder);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const tokenToUse = accessToken || initialOrder.access_token;
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refetchOrderState = useCallback(async () => {
    if (!initialOrder.id || !tokenToUse) return;
    try {
      const res = await getPublicOrderTrackingStateAction(initialOrder.id, tokenToUse);
      if (res.success && res.data) {
        const data = res.data;
        setOrder((prev) => {
          const nextOrder: OrderRecord = {
            ...prev,
            status: data.status,
            payment_status: data.payment_status,
            payment_method: data.payment_method,
            total_cents: data.total_cents,
            subtotal_cents: data.subtotal_cents,
            tax_cents: data.tax_cents,
            service_charge_cents: data.service_charge_cents,
            amount_paid_cents: data.amount_paid_cents,
            balance_due_cents: data.balance_due_cents,
            customer_user_id: data.customer_user_id,
            updated_at: data.updated_at,
            approval_status: data.approval_status as OrderRecord['approval_status'] || prev.approval_status,
            approved_at: data.approved_at !== undefined ? data.approved_at : prev.approved_at,
            rejected_at: data.rejected_at !== undefined ? data.rejected_at : prev.rejected_at,
            rejection_reason: data.rejection_reason !== undefined ? data.rejection_reason : prev.rejection_reason,
          };
          updateActiveOrderStatusInStorage(nextOrder.branch_id, nextOrder.id, nextOrder.status);
          return nextOrder;
        });
      }
    } catch (err) {
      console.warn('[useRealtimeOrder] Order tracking refetch warning:', err);
    }
  }, [initialOrder.id, tokenToUse]);

  useEffect(() => {
    const supabase = createClient();
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
          () => {
            refetchOrderState();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
            filter: `order_id=eq.${initialOrder.id}`,
          },
          () => {
            refetchOrderState();
          }
        )
        .on(
          'broadcast',
          { event: 'order_status_updated' },
          () => {
            refetchOrderState();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            refetchOrderState();
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            setConnectionStatus('reconnecting');
          } else if (status === 'CLOSED') {
            setConnectionStatus('offline');
          }
        });
    };

    setupSubscription();

    // 2.5-second polling fallback for responsive reconciliation
    pollTimerRef.current = setInterval(() => {
      refetchOrderState();
    }, 2500);

    const handleFocus = () => {
      refetchOrderState();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [initialOrder.id, refetchOrderState]);

  return { order, connectionStatus, refetchOrderState };
}

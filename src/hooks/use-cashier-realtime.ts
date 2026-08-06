'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useCashierRealtime(
  branchId: string,
  onRefreshNeeded: () => void,
  onNewBillRequest?: (requestId: string) => void
) {
  const lastEventMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();

    const handleEvent = (eventKey: string, callback?: () => void) => {
      const now = Date.now();
      const lastTime = lastEventMap.current.get(eventKey) || 0;

      // 2-Second Sliding Window Deduplication Guard
      if (now - lastTime < 2000) {
        return;
      }

      lastEventMap.current.set(eventKey, now);

      if (callback) {
        callback();
      }
      onRefreshNeeded();
    };

    // Subscriptions on orders, payments, and waiter_requests scoped to branch_id
    const channel = supabase
      .channel(`cashier-realtime-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const newRow = payload.new as { id?: string } | null;
          const oldRow = payload.old as { id?: string } | null;
          handleEvent(`order:${newRow?.id || oldRow?.id || 'unknown'}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const newRow = payload.new as { id?: string } | null;
          const oldRow = payload.old as { id?: string } | null;
          handleEvent(`payment:${newRow?.id || oldRow?.id || 'unknown'}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waiter_requests',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const newRow = payload.new as { id?: string; request_type?: string } | null;
          const reqId = newRow?.id;
          const reqType = newRow?.request_type;
          handleEvent(`waiter_req:${reqId}`, () => {
            if (reqType === 'need_bill' && onNewBillRequest && reqId) {
              onNewBillRequest(reqId);
            }
          });
        }
      )
      .subscribe();

    // 10-Second Polling Fallback to ensure state recovery if WebSocket disconnects
    const fallbackInterval = setInterval(() => {
      onRefreshNeeded();
    }, 10000);

    return () => {
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [branchId, onRefreshNeeded, onNewBillRequest]);
}

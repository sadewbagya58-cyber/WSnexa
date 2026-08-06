'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WaiterRequestRecord } from '@/server/services/waiter.service';
import { RealtimeConnectionStatus } from './use-realtime-order';

export function useRealtimeWaiterRequests(initialRequests: WaiterRequestRecord[], branchId: string) {
  const [requests, setRequests] = useState<WaiterRequestRecord[]>(initialRequests);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const supabase = createClient();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      setConnectionStatus('connecting');

      channel = supabase
        .channel(`waiter_requests_${branchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waiter_requests',
            filter: `branch_id=eq.${branchId}`,
          },
          async (payload) => {
            const newReq = payload.new as WaiterRequestRecord;
            if (!newReq || !newReq.id) return;

            const { data } = await supabase
              .from('waiter_requests')
              .select(`
                *,
                table:dining_tables(id, name, code, table_number)
              `)
              .eq('id', newReq.id)
              .maybeSingle();

            const fullReq = (data as unknown as WaiterRequestRecord) || newReq;

            setRequests((prev) => {
              const exists = prev.some((r) => r.id === fullReq.id);
              if (exists) return prev;
              return [fullReq, ...prev];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'waiter_requests',
            filter: `branch_id=eq.${branchId}`,
          },
          (payload) => {
            const updatedRow = payload.new as Partial<WaiterRequestRecord>;
            if (!updatedRow.id || !updatedRow.status) return;

            setRequests((prev) => {
              if (updatedRow.status === 'completed' || updatedRow.status === 'dismissed') {
                return prev.filter((r) => r.id !== updatedRow.id);
              }

              return prev.map((r) => {
                if (r.id === updatedRow.id) {
                  return { ...r, ...updatedRow } as WaiterRequestRecord;
                }
                return r;
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
          .from('waiter_requests')
          .select(`
            *,
            table:dining_tables(id, name, code, table_number)
          `)
          .eq('branch_id', branchId)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false });

        if (data) {
          setRequests(data as unknown as WaiterRequestRecord[]);
        }
      } catch (err: unknown) {
        console.warn('Waiter polling fallback encountered error:', err);
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

  return { requests, setRequests, connectionStatus };
}

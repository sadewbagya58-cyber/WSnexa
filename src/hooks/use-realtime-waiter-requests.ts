'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { WaiterRequestRecord } from '@/server/services/waiter.service';
import { getBranchWaiterRequestsAction } from '@/server/actions/waiter';
import { RealtimeConnectionStatus } from './use-realtime-order';

export function useRealtimeWaiterRequests(
  initialRequests: WaiterRequestRecord[],
  branchId: string,
  assignedAreaIds?: string[] | null
) {
  const [requests, setRequests] = useState<WaiterRequestRecord[]>(initialRequests);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const supabase = createClient();
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshAuthoritativeRequests = async () => {
    try {
      const res = await getBranchWaiterRequestsAction(branchId);
      if (res.success && res.requests) {
        let fetched = res.requests;
        if (assignedAreaIds !== undefined && assignedAreaIds !== null) {
          fetched = fetched.filter(
            (r) => r.table?.service_area_id && assignedAreaIds.includes(r.table.service_area_id)
          );
        }
        setRequests(fetched);
      }
    } catch (err: unknown) {
      console.warn('Failed to refresh authoritative waiter requests:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequests(initialRequests);
  }, [initialRequests]);

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
            await refreshAuthoritativeRequests();
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

            if (updatedRow.status === 'completed' || updatedRow.status === 'dismissed') {
              setRequests((prev) => prev.filter((r) => r.id !== updatedRow.id));
            } else {
              refreshAuthoritativeRequests();
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

    // Fallback polling every 10s with canonical actor resolution
    pollTimerRef.current = setInterval(() => {
      refreshAuthoritativeRequests();
    }, 10000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [branchId, assignedAreaIds, supabase]);

  return { requests, setRequests, connectionStatus, refreshRequests: refreshAuthoritativeRequests };
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NotificationDTO } from '@/server/services/notification.service';
import {
  getUserNotificationsAction,
  getUnreadCountAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/server/actions/notification';

export function useNotifications(userId: string | null, businessId: string | null) {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const lastEventMap = useRef<Map<string, number>>(new Map());

  // Load initial notifications & unread count
  const loadNotifications = useCallback(async () => {
    if (!userId || !businessId) return;

    try {
      const [listRes, countRes] = await Promise.all([
        getUserNotificationsAction({ limit: 20 }),
        getUnreadCountAction({}),
      ]);

      if (listRes.success && listRes.data) {
        setNotifications(listRes.data);
      }

      if (countRes.success && typeof countRes.data === 'number') {
        setUnreadCount(countRes.data);
      }
    } catch (err) {
      console.warn('[useNotifications] Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, businessId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
  }, [loadNotifications]);

  // User-centric Supabase Realtime subscription + Polling recovery fallback
  useEffect(() => {
    if (!userId || !businessId) return;

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      channel = supabase
        .channel(`user_notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_user_id=eq.${userId}`,
          },
          async (payload) => {
            const row = payload.new as Record<string, unknown>;
            if (!row || !row.id) return;

            const notificationId = String(row.id);
            const now = Date.now();
            const lastTime = lastEventMap.current.get(notificationId) || 0;

            // 2-Second Sliding Window Deduplication Guard
            if (now - lastTime < 2000) {
              return;
            }
            lastEventMap.current.set(notificationId, now);

            // Fetch enriched notification DTO with branch name
            const freshListRes = await getUserNotificationsAction({ limit: 20 });
            if (freshListRes.success && freshListRes.data) {
              setNotifications(freshListRes.data);
            }

            const freshCountRes = await getUnreadCountAction({});
            if (freshCountRes.success && typeof freshCountRes.data === 'number') {
              setUnreadCount(freshCountRes.data);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (err) {
              console.warn('[Realtime] Notifications channel connection issue:', status, err);
            }
          }
        });
    };

    setupSubscription();

    // Revalidate notifications when tab regains focus (visibilitychange)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // 15-Second Polling Fallback to reconcile missed events or connection loss
    const pollInterval = setInterval(async () => {
      try {
        const countRes = await getUnreadCountAction({});
        if (countRes.success && typeof countRes.data === 'number') {
          setUnreadCount(countRes.data);
        }
      } catch {
        // Silent polling failure
      }
    }, 15000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, businessId, loadNotifications]);

  // Optimistic Mark Single as Read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) return;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
      );

      setUnreadCount((prev) => {
        const target = notifications.find((n) => n.id === notificationId);
        if (target && target.readAt === null && prev > 0) {
          return prev - 1;
        }
        return prev;
      });

      await markNotificationAsReadAction(notificationId);
    },
    [notifications]
  );

  // Optimistic Mark All as Read
  const markAllAsRead = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || nowIso })));
    setUnreadCount(0);

    await markAllNotificationsAsReadAction();
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications: loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}

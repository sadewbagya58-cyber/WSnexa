'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TenantSubscriptionInfo } from '@/types';

interface SubscriptionRealtimeListenerProps {
  businessId: string;
  userRole: string;
  subscription?: TenantSubscriptionInfo;
}

export function SubscriptionRealtimeListener({
  businessId,
  userRole,
  subscription,
}: SubscriptionRealtimeListenerProps) {
  const router = useRouter();
  const lastStateRef = useRef<string | null>(subscription?.effectiveStatus || null);

  useEffect(() => {
    if (!businessId) return;

    const supabase = createClient();
    const channelName = `sub_realtime_${businessId}`;

    const channel = supabase
      .channel(channelName)
      // 1. Listen to commercial subscription changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_subscriptions',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            status?: string;
            trial_ends_at?: string;
            current_period_ends_at?: string;
            grace_ends_at?: string;
            suspended_at?: string;
            cancelled_at?: string;
          } | null;

          if (!newRow) return;

          const storedStatus = newRow.status;
          const now = new Date();

          let effective: string = (storedStatus || 'trialing').toUpperCase();
          if (storedStatus === 'trialing') {
            const trialEnd = newRow.trial_ends_at ? new Date(newRow.trial_ends_at) : null;
            if (trialEnd && trialEnd <= now) {
              const graceLimit = new Date(trialEnd.getTime() + 7 * 86400000);
              effective = now <= graceLimit ? 'GRACE_PERIOD' : 'SUSPENDED';
            }
          } else if (storedStatus === 'active') {
            const periodEnd = newRow.current_period_ends_at ? new Date(newRow.current_period_ends_at) : null;
            if (periodEnd && periodEnd <= now) {
              const graceEnd = newRow.grace_ends_at
                ? new Date(newRow.grace_ends_at)
                : new Date(periodEnd.getTime() + 7 * 86400000);
              effective = now <= graceEnd ? 'GRACE_PERIOD' : 'SUSPENDED';
            }
          } else if (storedStatus === 'grace_period') {
            const graceEnd = newRow.grace_ends_at ? new Date(newRow.grace_ends_at) : null;
            if (graceEnd && graceEnd <= now) {
              effective = 'SUSPENDED';
            }
          }

          const currentPath = window.location.pathname;

          if (lastStateRef.current !== effective) {
            lastStateRef.current = effective;

            if (effective === 'SUSPENDED' || effective === 'CANCELLED') {
              if (userRole === 'business_owner') {
                if (currentPath !== '/dashboard/settings/subscription') {
                  router.replace('/dashboard/settings/subscription');
                } else {
                  router.refresh();
                }
              } else {
                const reason = effective === 'CANCELLED' ? 'subscription_cancelled' : 'subscription_suspended';
                router.replace(`/account/pending-access?reason=${reason}`);
              }
            } else {
              // ACTIVE / GRACE_PERIOD / TRIALING
              if (currentPath.includes('/account/pending-access')) {
                router.replace('/dashboard');
              } else {
                router.refresh();
              }
            }
          } else {
            // Dates or limits changed without status string change -> refresh view
            router.refresh();
          }
        }
      )
      // 2. Listen to platform business status changes (abuse/security suspension)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${businessId}`,
        },
        (payload) => {
          const newRow = payload.new as { status?: string } | null;
          if (!newRow) return;

          const currentPath = window.location.pathname;
          if (newRow.status === 'suspended' || newRow.status === 'archived') {
            router.replace('/account/pending-access?reason=platform_suspended');
          } else if (newRow.status === 'active' && currentPath.includes('/account/pending-access')) {
            router.replace('/dashboard');
          } else {
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, userRole, router]);

  return null;
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getActiveOrdersFromStorage,
  SafeActiveOrderRecord,
} from '@/features/cart/active-order-storage';

interface GuestActiveOrderBannerProps {
  branchId: string;
  token: string;
}

export const GuestActiveOrderBanner: React.FC<GuestActiveOrderBannerProps> = ({
  branchId,
  token,
}) => {
  const [activeOrders, setActiveOrders] = useState<SafeActiveOrderRecord[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);

  useEffect(() => {
    const handleStorage = () => {
      const orders = getActiveOrdersFromStorage(branchId);
      setActiveOrders(orders);
    };

    handleStorage();

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [branchId]);

  if (activeOrders.length === 0) return null;

  const primaryOrder = activeOrders[0];

  const statusVariantMap: Record<string, 'neutral' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    confirmed: 'warning',
    preparing: 'warning',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'destructive',
  };

  return (
    <>
      {/* Floating Active Order Alert Bar */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-4 max-w-md mx-auto pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-zinc-950/95 text-white p-3.5 shadow-xl border border-zinc-800 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-lg border border-emerald-500/30">
              🔔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-tight">
                  Order {primaryOrder.orderNumberFormatted}
                </span>
                <Badge variant={statusVariantMap[primaryOrder.latestStatus] || 'neutral'}>
                  {primaryOrder.latestStatus.toUpperCase()}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">
                {primaryOrder.tableName ? `📍 ${primaryOrder.tableName}` : 'Direct Order'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/m/${token}/order/${primaryOrder.orderId}?access_token=${primaryOrder.accessToken}`}
            >
              <Button size="sm" className="text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-100">
                View Status →
              </Button>
            </Link>

            {activeOrders.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold text-white border-zinc-700 hover:bg-zinc-800"
                onClick={() => setShowDrawer(true)}
              >
                ({activeOrders.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Drawer / Modal for Multiple Recent Orders */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-950">Recent Orders ({activeOrders.length})</h3>
              <button
                type="button"
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 text-sm font-bold"
                onClick={() => setShowDrawer(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {activeOrders.map((rec) => (
                <div
                  key={rec.orderId}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-950">
                        {rec.orderNumberFormatted}
                      </span>
                      <Badge variant={statusVariantMap[rec.latestStatus] || 'neutral'}>
                        {rec.latestStatus.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {rec.tableName ? `📍 ${rec.tableName}` : 'Direct Order'} •{' '}
                      {new Date(rec.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <Link
                    href={`/m/${token}/order/${rec.orderId}?access_token=${rec.accessToken}`}
                    onClick={() => setShowDrawer(false)}
                  >
                    <Button size="sm" className="text-xs font-bold">
                      View Status
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

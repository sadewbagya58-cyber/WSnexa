'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderRecord } from '@/server/services/order.service';
import { useRealtimeOrder } from '@/hooks/use-realtime-order';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { submitCustomerAssistanceAction } from '@/server/actions/waiter';
import { WaiterRequestType } from '@/lib/validation/waiter';
import { SaveOrderButton } from '@/components/guest/save-order-button';

interface RealtimeOrderTrackerProps {
  initialOrder: OrderRecord;
  token: string;
  businessName: string;
  accessToken?: string;
}

export const RealtimeOrderTracker: React.FC<RealtimeOrderTrackerProps> = ({
  initialOrder,
  token,
  businessName,
  accessToken,
}) => {
  const { order, connectionStatus } = useRealtimeOrder(initialOrder, accessToken);
  const [isPending, startTransition] = useTransition();
  const [assistanceFeedback, setAssistanceFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const statusVariantMap: Record<string, 'neutral' | 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    confirmed: 'warning',
    preparing: 'warning',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'destructive',
  };

  const statusEmojiMap: Record<string, string> = {
    pending: '⏳',
    confirmed: '📋',
    preparing: '🍳',
    ready: '🔔',
    completed: '✅',
    cancelled: '❌',
  };

  const steps = [
    { key: 'pending', label: 'Order Received' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready to Serve' },
    { key: 'completed', label: 'Completed' },
  ];

  const getStepStatus = (stepKey: string) => {
    if (order.status === 'cancelled') return 'cancelled';

    const orderIndex = steps.findIndex((s) => s.key === order.status);
    const stepIndex = steps.findIndex((s) => s.key === stepKey);

    if (stepIndex < orderIndex) return 'completed';
    if (stepIndex === orderIndex) return 'current';
    return 'upcoming';
  };

  const handleAssistanceRequest = (type: WaiterRequestType, label: string) => {
    if (!order.table_id) {
      setAssistanceFeedback({
        success: false,
        message: 'Table verification required to request assistance.',
      });
      return;
    }

    setAssistanceFeedback(null);
    startTransition(async () => {
      const res = await submitCustomerAssistanceAction({
        rawQrToken: token,
        tableId: order.table_id!,
        requestType: type,
        orderId: order.id,
      });

      if (res.success) {
        setAssistanceFeedback({
          success: true,
          message: `Request sent: "${label}". A waiter will attend to your table shortly!`,
        });
      } else {
        setAssistanceFeedback({
          success: false,
          message: res.message || 'Failed to send assistance request.',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {businessName}
            </span>
            <h1 className="text-base font-black tracking-tight text-zinc-950">
              Live Order Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
            {connectionStatus === 'reconnecting' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                Reconnecting...
              </span>
            )}
            {connectionStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 border border-zinc-200">
                Offline
              </span>
            )}
            <Badge variant={statusVariantMap[order.status] || 'neutral'}>
              {statusEmojiMap[order.status] || '📦'} {order.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Status Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm text-center space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-4xl border border-emerald-200 shadow-inner">
            {statusEmojiMap[order.status] || '🎉'}
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              Order Number
            </span>
            <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
              {order.order_number_formatted}
            </h2>
          </div>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed font-medium">
            {order.status === 'pending' && 'Your order has been received by the kitchen. Preparation will begin shortly.'}
            {order.status === 'confirmed' && 'Your order has been confirmed by the kitchen.'}
            {order.status === 'preparing' && 'Your meal is actively being prepared in the kitchen!'}
            {order.status === 'ready' && 'Your order is ready! It will be served to your table shortly.'}
            {order.status === 'completed' && 'Order completed. Thank you for dining with us!'}
            {order.status === 'cancelled' && 'This order was cancelled.'}
          </p>

          {/* Timeline Progress Tracker */}
          {order.status !== 'cancelled' && (
            <div className="pt-4 border-t border-zinc-100">
              <div className="relative flex items-center justify-between">
                {steps.map((step, idx) => {
                  const status = getStepStatus(step.key);
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center relative z-10">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          status === 'completed'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : status === 'current'
                            ? 'bg-amber-500 text-white ring-4 ring-amber-100 shadow-sm animate-pulse'
                            : 'bg-zinc-200 text-zinc-500'
                        }`}
                      >
                        {status === 'completed' ? '✓' : idx + 1}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-600 mt-1.5 text-center leading-tight">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Customer Assistance Quick Action Buttons */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Need Assistance at Your Table?
          </div>

          {assistanceFeedback && (
            <div
              className={`rounded-xl p-3 text-xs font-bold border ${
                assistanceFeedback.success
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {assistanceFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              onClick={() => handleAssistanceRequest('call_waiter', 'Call Waiter')}
              disabled={isPending}
            >
              <span>🔔</span> Call Waiter
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              onClick={() => handleAssistanceRequest('need_water', 'Need Water')}
              disabled={isPending}
            >
              <span>💧</span> Need Water
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              onClick={() => handleAssistanceRequest('need_bill', 'Need Bill')}
              disabled={isPending}
            >
              <span>🍽️</span> Need Bill
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              onClick={() => handleAssistanceRequest('need_assistance', 'Need Assistance')}
              disabled={isPending}
            >
              <span>❓</span> Need Assistance
            </Button>
          </div>
        </div>

        {/* Order Info Details */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Order Metadata
          </span>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>Dining Table:</span>
            {order.table ? (
              <span className="text-emerald-800 font-extrabold">📍 {order.table.name}</span>
            ) : (
              <span className="text-zinc-500 font-normal">Direct Order</span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span>Placed At:</span>
            <span className="font-mono text-xs">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {order.guest_name && (
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>Guest Name:</span>
              <span className="font-semibold text-zinc-900">{order.guest_name}</span>
            </div>
          )}
          {order.guest_notes && (
            <div className="pt-2 border-t border-zinc-100 text-xs text-amber-900 italic">
              📝 Special Notes: &quot;{order.guest_notes}&quot;
            </div>
          )}
        </div>

        {/* Itemized Order Breakdown */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
            Itemized Order
          </h3>

          <div className="space-y-3 divide-y divide-zinc-100">
            {order.items?.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-950">
                    <span className="font-mono text-zinc-500 text-xs">{item.quantity}x</span>
                    <span>{item.item_name_snapshot}</span>
                  </div>

                  {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                    <div className="pl-6 space-y-0.5 text-xs text-zinc-500">
                      {item.order_item_modifiers.map((mod) => (
                        <div key={mod.id}>
                          • {mod.group_name_snapshot}: {mod.option_name_snapshot}
                        </div>
                      ))}
                    </div>
                  )}

                  {item.special_instructions && (
                    <div className="pl-6 text-xs text-amber-900 italic">
                      📝 &quot;{item.special_instructions}&quot;
                    </div>
                  )}
                </div>

                <div className="text-sm font-black text-zinc-950">
                  {formatCurrency(item.line_subtotal_cents, order.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-200 space-y-2">
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Subtotal</span>
              <span className="font-mono font-bold">
                {formatCurrency(order.subtotal_cents, order.currency)}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
              <span>Total Amount</span>
              <span>{formatCurrency(order.total_cents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
              Payment Summary
            </span>
            <Badge
              variant={
                order.payment_status === 'paid'
                  ? 'success'
                  : order.payment_status === 'partially_paid'
                  ? 'warning'
                  : 'destructive'
              }
            >
              {order.payment_status === 'paid' && '💵 Payment Completed'}
              {order.payment_status === 'partially_paid' && '⚖️ Partially Paid'}
              {order.payment_status === 'unpaid' && '🔴 Unpaid'}
              {!['paid', 'partially_paid', 'unpaid'].includes(order.payment_status) &&
                order.payment_status.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-1.5 text-xs text-zinc-700 font-bold">
            <div className="flex justify-between">
              <span>Payment Method:</span>
              <span className="capitalize">{order.payment_method.replace('_', ' ')}</span>
            </div>
            {order.payment_status === 'paid' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-black text-emerald-800">
                ✅ Payment Completed. Thank you!
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-900">
                Please settle payment at the cashier counter.
              </div>
            )}
          </div>
        </div>

        {/* Optional Account Upgrade Banner */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-xl">
              ⭐
            </span>
            <div>
              <h4 className="text-xs font-bold text-zinc-950">Save this order to your WSNexa account</h4>
              <p className="text-[11px] text-zinc-500">
                Keep your order history, view digital receipts anytime, and track lifetime venue visits.
              </p>
            </div>
          </div>
          <SaveOrderButton orderId={order.id} accessToken={accessToken || ''} />
        </div>

        {/* Return to Menu Button */}
        <div className="space-y-3">
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold py-3">← Back to Digital Menu</Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

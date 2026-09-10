'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { CashierOrderRecord } from '@/server/services/payment.service';

interface OrderPaymentCardProps {
  order: CashierOrderRecord;
  onSettlePayment: (order: CashierOrderRecord) => void;
  onPrintReceipt: (orderId: string) => void;
  onAcknowledgeBill?: (requestId: string) => void;
  canRecordPayments?: boolean;
}

export const OrderPaymentCard: React.FC<OrderPaymentCardProps> = ({
  order,
  onSettlePayment,
  onPrintReceipt,
  onAcknowledgeBill,
  canRecordPayments = true,
}) => {
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    if (isAcknowledging || !order.waiter_request_id || !onAcknowledgeBill) return;
    setIsAcknowledging(true);
    try {
      await onAcknowledgeBill(order.waiter_request_id);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const formattedTime = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const getKitchenBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">⏳ Pending Kitchen</Badge>;
      case 'confirmed':
        return <Badge variant="neutral">📋 Confirmed</Badge>;
      case 'preparing':
        return <Badge variant="warning">🔥 Preparing</Badge>;
      case 'ready':
        return <Badge variant="success">🔔 Ready to Serve</Badge>;
      case 'completed':
        return <Badge variant="neutral">✅ Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">❌ Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success">💵 Fully Paid</Badge>;
      case 'partially_paid':
        return <Badge variant="warning">⚖️ Partially Paid</Badge>;
      case 'unpaid':
        return <Badge variant="destructive">🔴 Unpaid</Badge>;
      case 'refunded':
      case 'partially_refunded':
      case 'voided':
        return <Badge variant="neutral">↩️ {status.replace('_', ' ')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm space-y-4 transition-all ${
        order.bill_requested
          ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-50/30 animate-pulse'
          : 'border-zinc-200 hover:border-zinc-300'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-zinc-950 font-mono">
            {order.order_number_formatted}
          </span>
          {order.table?.name && (
            <Badge variant="neutral" className="font-bold">
              📍 {order.table.name}
            </Badge>
          )}
        </div>
        <span className="text-xs font-semibold text-zinc-400">{formattedTime}</span>
      </div>

      {/* Bill Requested Alert Banner */}
      {order.bill_requested && (
        <div className="rounded-xl border border-amber-300 bg-amber-100 p-2.5 flex items-center justify-between text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold">
            <span>🍽️</span>
            <span>Guest Requested Bill!</span>
          </div>
          {onAcknowledgeBill && order.waiter_request_id && (
            <Button
              size="sm"
              variant="outline"
              disabled={isAcknowledging}
              aria-busy={isAcknowledging}
              className="text-[10px] h-7 min-h-[32px] bg-white border-amber-400 hover:bg-amber-50 touch-manipulation active:scale-[0.98] transition-all flex items-center gap-1 font-bold"
              onClick={handleAcknowledge}
            >
              {isAcknowledging ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>Acknowledging...</span>
                </>
              ) : (
                'Acknowledge'
              )}
            </Button>
          )}
        </div>
      )}

      {/* Badges Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {getKitchenBadge(order.status)}
        {getPaymentBadge(order.payment_status)}
        {order.refund_eligibility === 'eligible' && (
          <Badge variant="destructive" className="font-extrabold bg-rose-600 text-white">
            ↩️ Refund Required
          </Badge>
        )}
        {order.payment_method && (
          <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
            Preferred: {order.payment_method === 'cash' ? '💵 Cash' : order.payment_method === 'card' ? '💳 Card' : order.payment_method === 'qr_pay' ? '📱 QR Pay' : '🏪 Pay at Counter'}
          </span>
        )}
        {order.guest_name && (
          <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
            👤 {order.guest_name}
          </span>
        )}
        {(() => {
          const cancelledCount = (order.items || []).filter(
            (i) => i.status === 'cancelled' || (i.cancelled_quantity || 0) > 0
          ).length;
          if (cancelledCount === 0) return null;
          return (
            <Badge variant="destructive" className="font-extrabold bg-red-100 text-red-800 border-red-200">
              ❌ {cancelledCount} Item{cancelledCount > 1 ? 's' : ''} Cancelled
            </Badge>
          );
        })()}
      </div>

      {/* Line Item Preview Summary (QA-12: Display cancelled items and quantities clearly) */}
      <div className="space-y-1.5 text-xs text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
        {(order.items || []).slice(0, 3).map((item) => {
          const isCancelled = item.status === 'cancelled';
          const isPartiallyCancelled = item.status === 'partially_cancelled' && Boolean(item.cancelled_quantity);
          const activeQty = isCancelled ? 0 : item.quantity - (item.cancelled_quantity || 0);

          return (
            <div
              key={item.id}
              className={`flex justify-between items-center ${
                isCancelled ? 'text-zinc-400' : ''
              }`}
            >
              <span className="truncate pr-2 flex items-center gap-1 min-w-0">
                {isCancelled ? (
                  <span className="line-through text-zinc-400 truncate">
                    <strong className="text-zinc-400">{item.quantity}x</strong> {item.item_name_snapshot}
                  </span>
                ) : isPartiallyCancelled ? (
                  <span className="truncate">
                    <strong className="text-zinc-950">{activeQty}x</strong> {item.item_name_snapshot}
                    <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                      ({item.cancelled_quantity}x cancelled)
                    </span>
                  </span>
                ) : (
                  <span className="truncate">
                    <strong className="text-zinc-950">{item.quantity}x</strong> {item.item_name_snapshot}
                  </span>
                )}
                {isCancelled && (
                  <span className="shrink-0 text-[9px] font-black uppercase text-red-700 bg-red-50 border border-red-200 px-1 py-0.2 rounded ml-1">
                    Cancelled
                  </span>
                )}
              </span>
              <span className={`font-mono shrink-0 ${isCancelled ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                {formatCurrency(item.line_subtotal_cents, order.currency)}
              </span>
            </div>
          );
        })}
        {(order.items || []).length > 3 && (
          <p className="text-[10px] text-zinc-400 italic">
            + {(order.items || []).length - 3} more items...
          </p>
        )}
      </div>

      {/* Totals & Balance Bar */}
      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-zinc-100">
        <div>
          <span className="text-zinc-400 block text-[10px] uppercase">Order Total</span>
          <span className="text-sm font-black text-zinc-950">
            {formatCurrency(order.total_cents, order.currency)}
          </span>
        </div>
        <div>
          <span className="text-zinc-400 block text-[10px] uppercase">Paid</span>
          <span className="text-sm font-bold text-emerald-700">
            {formatCurrency(order.paid_cents, order.currency)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-zinc-400 block text-[10px] uppercase">Balance Due</span>
          <span
            className={`text-sm font-black font-mono ${
              order.balance_due_cents > 0 ? 'text-amber-800' : 'text-zinc-950'
            }`}
          >
            {formatCurrency(order.balance_due_cents, order.currency)}
          </span>
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs font-bold min-h-[40px] touch-manipulation active:scale-[0.98] transition-all"
          onClick={() => onPrintReceipt(order.id)}
        >
          🖨️ Receipt
        </Button>
        {order.status === 'cancelled' && (order.paid_cents > 0 || order.payment_status === 'paid') ? (
          <Button
            size="sm"
            className="flex-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white min-h-[40px] touch-manipulation active:scale-[0.98] transition-all shadow-xs"
            onClick={() => onSettlePayment(order)}
          >
            ↩️ Process Refund ({formatCurrency(order.paid_cents || order.total_cents, order.currency)})
          </Button>
        ) : order.balance_due_cents > 0 ? (
          <Button
            size="sm"
            disabled={!canRecordPayments}
            className="flex-1 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white disabled:opacity-50 min-h-[40px] touch-manipulation active:scale-[0.98] transition-all shadow-xs"
            onClick={() => onSettlePayment(order)}
          >
            💳 Settle ({formatCurrency(order.balance_due_cents, order.currency)})
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-200 min-h-[40px]"
            disabled
          >
            ✅ Settlement Complete
          </Button>
        )}
      </div>
    </div>
  );
};

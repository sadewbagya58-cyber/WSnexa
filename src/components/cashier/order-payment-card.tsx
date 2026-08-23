'use client';

import React from 'react';
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
              className="text-[10px] h-7 bg-white border-amber-400 hover:bg-amber-50"
              onClick={() => onAcknowledgeBill(order.waiter_request_id!)}
            >
              Acknowledge
            </Button>
          )}
        </div>
      )}

      {/* Badges Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {getKitchenBadge(order.status)}
        {getPaymentBadge(order.payment_status)}
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
      </div>

      {/* Line Item Preview Summary */}
      <div className="space-y-1 text-xs text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
        {(order.items || []).slice(0, 3).map((item) => (
          <div key={item.id} className="flex justify-between">
            <span className="truncate pr-2">
              <strong className="text-zinc-950">{item.quantity}x</strong> {item.item_name_snapshot}
            </span>
            <span className="font-mono text-zinc-900">
              {formatCurrency(item.line_subtotal_cents, order.currency)}
            </span>
          </div>
        ))}
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
          className="flex-1 text-xs font-bold"
          onClick={() => onPrintReceipt(order.id)}
        >
          🖨️ Receipt
        </Button>
        {order.balance_due_cents > 0 ? (
          <Button
            size="sm"
            disabled={!canRecordPayments}
            className="flex-1 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white disabled:opacity-50"
            onClick={() => onSettlePayment(order)}
          >
            💳 Settle ({formatCurrency(order.balance_due_cents, order.currency)})
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-200"
            disabled
          >
            ✅ Settlement Complete
          </Button>
        )}
      </div>
    </div>
  );
};

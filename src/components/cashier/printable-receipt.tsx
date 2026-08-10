'use client';

import React from 'react';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { ReceiptData } from '@/server/services/payment.service';

interface PrintableReceiptProps {
  data: ReceiptData;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({ data }) => {
  const { business, branch, order, items, payments } = data;

  const formattedDate = new Date(order.created_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="w-full max-w-[80mm] mx-auto bg-white p-4 font-mono text-xs text-zinc-950 leading-tight print:p-0 print:max-w-none">
      {/* Business & Branch Header */}
      <div className="text-center space-y-1 border-b border-dashed border-zinc-400 pb-3 mb-3">
        <h2 className="text-base font-black uppercase tracking-wider">{business.name}</h2>
        <p className="font-bold">{branch.name}</p>
        {branch.address && <p className="text-[11px] text-zinc-700">{branch.address}</p>}
        {branch.phone && <p className="text-[11px] text-zinc-700">Tel: {branch.phone}</p>}
        <p className="text-[10px] text-zinc-500 uppercase mt-1">*** OFFICIAL RECEIPT ***</p>
      </div>

      {/* Order Meta Info */}
      <div className="space-y-1 border-b border-dashed border-zinc-400 pb-2 mb-3 text-[11px]">
        <div className="flex justify-between font-bold">
          <span>Order #:</span>
          <span>{order.order_number_formatted}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
        {order.table_name && (
          <div className="flex justify-between font-bold">
            <span>Table:</span>
            <span>{order.table_name} ({order.table_code})</span>
          </div>
        )}
        {order.guest_name && (
          <div className="flex justify-between">
            <span>Guest:</span>
            <span>{order.guest_name}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-left border-b border-dashed border-zinc-400 pb-2 mb-3">
        <thead>
          <tr className="border-b border-zinc-300 text-[10px] font-bold uppercase">
            <th className="py-1">Qty Item</th>
            <th className="py-1 text-right">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              <tr>
                <td className="py-1.5 align-top">
                  <span className="font-bold">{item.quantity}x</span> {item.name}
                </td>
                <td className="py-1.5 text-right font-bold align-top">
                  {formatCurrency(item.line_subtotal_cents, order.currency)}
                </td>
              </tr>
              {item.modifiers.map((mod, idx) => (
                <tr key={idx} className="text-[10px] text-zinc-600">
                  <td className="pl-4 py-0.5" colSpan={2}>
                    + {mod.option_name} ({formatCurrency(mod.additional_price_cents, order.currency)})
                  </td>
                </tr>
              ))}
              {item.special_instructions && (
                <tr className="text-[10px] italic text-zinc-500">
                  <td className="pl-4 py-0.5" colSpan={2}>
                    Note: {item.special_instructions}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Totals Summary */}
      <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(order.subtotal_cents, order.currency)}</span>
        </div>
        {(order.discount_cents ?? 0) > 0 && (
          <div className="flex justify-between text-zinc-900 font-bold">
            <span>🎁 Reward ({order.reward_title_snapshot || 'Discount'}):</span>
            <span className="text-emerald-700">-{formatCurrency(order.discount_cents || 0, order.currency)}</span>
          </div>
        )}
        {(order.reward_points_redeemed_snapshot ?? 0) > 0 && (
          <div className="flex justify-between text-zinc-600 text-[10px]">
            <span>Points Redeemed:</span>
            <span>{order.reward_points_redeemed_snapshot} pts</span>
          </div>
        )}
        {order.tax_cents > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>Tax:</span>
            <span>{formatCurrency(order.tax_cents, order.currency)}</span>
          </div>
        )}
        {order.service_charge_cents > 0 && (
          <div className="flex justify-between text-zinc-700">
            <span>Service Charge:</span>
            <span>{formatCurrency(order.service_charge_cents, order.currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black border-t border-zinc-950 pt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total_cents, order.currency)}</span>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-400 pb-3 mb-3">
        <span className="font-bold text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
          Payment Breakdown
        </span>
        {payments.length === 0 ? (
          <p className="text-zinc-500 italic">No payments recorded</p>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span className="capitalize">{p.payment_method.replace('_', ' ')} ({p.payment_reference}):</span>
              <span className="font-bold">{formatCurrency(p.amount_cents, order.currency)}</span>
            </div>
          ))
        )}
        <div className="flex justify-between font-bold border-t border-zinc-200 pt-1">
          <span>Total Paid:</span>
          <span className="text-emerald-700">{formatCurrency(order.paid_cents, order.currency)}</span>
        </div>
        <div className="flex justify-between font-black text-sm pt-0.5">
          <span>Balance Due:</span>
          <span className={order.balance_due_cents > 0 ? 'text-amber-800' : 'text-zinc-950'}>
            {formatCurrency(order.balance_due_cents, order.currency)}
          </span>
        </div>
      </div>

      {/* Footer Message */}
      <div className="text-center text-[10px] text-zinc-500 space-y-1">
        <p className="font-bold uppercase">Thank you for your visit!</p>
        <p>Powered by WSNexa OS</p>
      </div>
    </div>
  );
};

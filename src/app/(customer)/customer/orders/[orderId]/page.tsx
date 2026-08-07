import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerOrderService } from '@/server/services/customer-order.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface CustomerOrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export const metadata: Metadata = {
  title: 'Order Details & Receipt | WSNexa Customer',
  description: 'View customer order details and digital payment receipt',
};

export default async function CustomerOrderDetailPage({ params }: CustomerOrderDetailPageProps) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: memberships }, customerData, order] = await Promise.all([
    supabase
      .from('business_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .limit(1),
    AccountService.getCustomerProfile(user.id),
    CustomerOrderService.getCustomerOrderDetails(user.id, orderId),
  ]);

  if (!order) {
    notFound();
  }

  const hasBusinessAccess = !!(memberships && memberships.length > 0);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs">
          <Link href="/customer/orders" className="text-zinc-400 hover:text-white font-bold transition-colors">
            ← Back to All Orders
          </Link>
          <span className="font-mono text-zinc-500">{order.orderNumberFormatted}</span>
        </div>

        {/* Master Header Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {order.businessName}
              </span>
              <h1 className="text-2xl font-black text-white mt-0.5">
                Order {order.orderNumberFormatted}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {order.branchName} • {order.tableName || 'Direct Order'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-extrabold uppercase tracking-wider">
                {order.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-zinc-500 block">Date & Time</span>
              <span className="font-semibold text-zinc-200">
                {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Payment Method</span>
              <span className="font-semibold text-zinc-200 capitalize">
                {order.paymentMethod.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Payment Status</span>
              <span className={`font-bold ${order.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {order.paymentStatus.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Total Amount</span>
              <span className="font-black text-amber-400 text-sm">
                {formatCurrency(order.totalCents, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Order Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3">
            Itemized Order Breakdown
          </h3>

          <div className="space-y-3 divide-y divide-zinc-800/60">
            {order.items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm">
                    <span className="font-mono text-amber-400 mr-2">{item.quantity}x</span>
                    {item.itemName}
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="pl-6 space-y-0.5 text-zinc-400 text-[11px]">
                      {item.modifiers.map((m, idx) => (
                        <div key={idx}>
                          • {m.groupName}: {m.optionName} (+{formatCurrency(m.additionalPriceCents, order.currency)})
                        </div>
                      ))}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <div className="pl-6 text-[11px] text-amber-400 italic">
                      📝 &quot;{item.specialInstructions}&quot;
                    </div>
                  )}
                </div>
                <div className="font-bold text-white font-mono">
                  {formatCurrency(item.lineSubtotalCents, order.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(order.subtotalCents, order.currency)}</span>
            </div>
            {order.taxCents > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Tax</span>
                <span className="font-mono">{formatCurrency(order.taxCents, order.currency)}</span>
              </div>
            )}
            {order.serviceChargeCents > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Service Charge</span>
                <span className="font-mono">{formatCurrency(order.serviceChargeCents, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-white pt-2 border-t border-zinc-800">
              <span>Total Paid</span>
              <span className="text-amber-400">{formatCurrency(order.totalCents, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Digital Payment Breakdown / Receipt */}
        {order.payments.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 text-xs">
            <h3 className="font-extrabold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              Payment & Settlement Receipt
            </h3>
            {order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div>
                  <div className="font-bold text-white capitalize">{p.paymentMethod.replace('_', ' ')}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {p.completedAt ? new Date(p.completedAt).toLocaleString() : 'Settled'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400 font-mono">
                    {formatCurrency(p.amountCents, p.currency)}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">{p.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FormattedCustomerOrder } from '@/server/services/customer-order.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface CustomerOrdersListProps {
  initialOrders: FormattedCustomerOrder[];
  initialFilter?: string;
}

export function CustomerOrdersList({ initialOrders, initialFilter = 'all' }: CustomerOrdersListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>(
    (['all', 'active', 'completed', 'cancelled'].includes(initialFilter)
      ? initialFilter
      : 'all') as 'all' | 'active' | 'completed' | 'cancelled'
  );

  const filteredOrders = initialOrders.filter((o) => {
    if (filter === 'active') return ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status);
    if (filter === 'completed') return o.status === 'completed';
    if (filter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">⏳ Received</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">📋 Confirmed</span>;
      case 'preparing':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">🍳 Preparing</span>;
      case 'ready':
        return <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">🔔 Ready</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold">✅ Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">❌ Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">My Orders</h1>
          <p className="text-xs text-zinc-400 mt-1">View and manage your saved hospitality order history</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs font-bold">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                filter === f
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((o) => (
            <Link
              key={o.id}
              href={`/customer/orders/${o.id}`}
              className="bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 rounded-2xl p-5 space-y-3 transition-all block group"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-white group-hover:text-amber-400 transition-colors">
                    {o.businessName}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {o.branchName} ({o.branchCode}) • {o.tableName || 'Direct'}
                  </div>
                </div>
                {getStatusBadge(o.status)}
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <div className="font-mono text-zinc-400">
                  {o.orderNumberFormatted} • {new Date(o.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm font-black text-amber-400">
                  {formatCurrency(o.totalCents, o.currency)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs space-y-2">
          <div className="text-3xl mb-2">🧾</div>
          <div className="font-bold text-zinc-300">No {filter !== 'all' ? filter : ''} orders found.</div>
          <div className="text-[11px] text-zinc-500">
            Scan a venue table QR code and click &quot;Save Order to My Account&quot; to save your hospitality visits.
          </div>
        </div>
      )}
    </div>
  );
}

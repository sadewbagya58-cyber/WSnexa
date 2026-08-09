'use client';

import React from 'react';
import Link from 'next/link';
import { CustomerAnalyticsSummary, FormattedCustomerOrder } from '@/server/services/customer-order.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

import { VenueRankingMetrics, CustomerPersonalizedInsight } from '@/lib/validation/ranking';
import { VenueCarousel } from '@/components/discovery/venue-carousel';
import { CustomerLoyaltyAccountRecord } from '@/lib/validation/loyalty';

interface CustomerDashboardProps {
  displayName: string;
  email: string;
  analytics: CustomerAnalyticsSummary;
  recentOrders: FormattedCustomerOrder[];
  recommendations?: VenueRankingMetrics[];
  retentionInsights?: CustomerPersonalizedInsight | null;
  loyaltyAccounts?: CustomerLoyaltyAccountRecord[];
}

export function CustomerDashboard({
  displayName,
  email,
  analytics,
  recentOrders,
  recommendations = [],
  loyaltyAccounts,
}: CustomerDashboardProps) {
  const activeOrders = recentOrders.filter((o) =>
    ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
  );
  const totalLoyaltyPoints = (loyaltyAccounts || []).reduce((sum, a) => sum + a.pointsBalance, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Hospitality Member</span>
          <h1 className="text-2xl font-black text-white mt-1">Welcome, {displayName}!</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">{email}</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-950/80 px-4 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-300">
          <span>🛡️</span>
          <span>Verified Customer Account</span>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/customer/loyalty" className="block">
          <div className="bg-gradient-to-br from-amber-500/10 to-zinc-900 border border-amber-500/30 hover:border-amber-400 transition-all rounded-2xl p-5 space-y-2">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>Loyalty Points</span>
              <span>🎁</span>
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {totalLoyaltyPoints} pts
            </div>
            <div className="text-[10px] text-zinc-400">
              {loyaltyAccounts && loyaltyAccounts.length > 0
                ? `${loyaltyAccounts.length} active venue program${loyaltyAccounts.length > 1 ? 's' : ''}`
                : 'Across participating venues'}
            </div>
          </div>
        </Link>

        <Link href="/customer/orders?filter=active" className="block">
          <div className="bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/50 transition-all rounded-2xl p-5 space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase">Active Orders</div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {analytics.activeOrdersCount}
            </div>
            <div className="text-[10px] text-zinc-500">Orders currently in service</div>
          </div>
        </Link>

        <Link href="/customer/orders" className="block">
          <div className="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all rounded-2xl p-5 space-y-2">
            <div className="text-xs font-bold text-zinc-400 uppercase">Completed Orders</div>
            <div className="text-2xl font-black font-mono text-white">
              {analytics.ordersCompletedCount}
            </div>
            <div className="text-[10px] text-zinc-500">Fulfilled hospitality orders</div>
          </div>
        </Link>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase">Lifetime Spend</div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {formatCurrency(analytics.lifetimeSpendCents, analytics.currency)}
          </div>
          <div className="text-[10px] text-zinc-500">Settled order total</div>
        </div>
      </div>

      {/* Personalized Recommendations Section */}
      {recommendations.length > 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
          <VenueCarousel
            title="✨ Recommended For You"
            subtitle="Handpicked venues based on your visits and preferences"
            venues={recommendations}
          />
        </div>
      )}

      {/* Live Active Orders Banner */}
      {activeOrders.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <span>🔥</span> Live Active Orders ({activeOrders.length})
            </h3>
            <Link
              href="/customer/orders?filter=active"
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              View All Active →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeOrders.map((o) => (
              <div
                key={o.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-extrabold text-white text-xs">
                    {o.businessName} ({o.branchName})
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    {o.orderNumberFormatted} • {o.tableName || 'Direct'}
                  </div>
                </div>
                <Link
                  href={`/customer/orders/${o.id}`}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors"
                >
                  Track Order
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity & Order History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🧾</span> Recent Order Activity
            </h3>
            <Link href="/customer/orders" className="text-xs font-semibold text-amber-400 hover:underline">
              View History →
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-2.5">
              {recentOrders.slice(0, 5).map((o) => (
                <Link
                  key={o.id}
                  href={`/customer/orders/${o.id}`}
                  className="block p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{o.businessName}</span>
                    <span className="font-mono text-zinc-400">{o.orderNumberFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                    <span>
                      {new Date(o.createdAt).toLocaleDateString()} • {o.itemCount} items
                    </span>
                    <span className="font-extrabold text-amber-400">
                      {formatCurrency(o.totalCents, o.currency)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
              <div>No claimed guest orders found.</div>
              <div className="text-[10px] text-zinc-600">
                Scan a table QR code and click &quot;Save Order to My Account&quot; to build your history!
              </div>
            </div>
          )}
        </div>

        {/* Quick Links Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Quick Links
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/customer/loyalty"
              className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors space-y-1 block"
            >
              <div className="text-lg">🎁</div>
              <div className="text-xs font-bold text-amber-400">Loyalty & Rewards</div>
              <div className="text-[11px] text-zinc-400">View points balances & redeem rewards</div>
            </Link>

            <Link
              href="/customer/orders"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 transition-colors space-y-1 block"
            >
              <div className="text-lg">🧾</div>
              <div className="text-xs font-bold text-white">All Orders</div>
              <div className="text-[11px] text-zinc-500">View complete order history & receipts</div>
            </Link>

            <Link
              href="/customer/venues"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 transition-colors space-y-1 block"
            >
              <div className="text-lg">🏬</div>
              <div className="text-xs font-bold text-white">Venues Visited</div>
              <div className="text-[11px] text-zinc-500">See all restaurants & hotels visited</div>
            </Link>

            <Link
              href="/customer/favorites"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 transition-colors space-y-1 block"
            >
              <div className="text-lg">⭐</div>
              <div className="text-xs font-bold text-white">Favorites</div>
              <div className="text-[11px] text-zinc-500">Manage saved venues & items</div>
            </Link>

            <Link
              href="/customer/profile"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 transition-colors space-y-1 block"
            >
              <div className="text-lg">👤</div>
              <div className="text-xs font-bold text-white">Profile & Preferences</div>
              <div className="text-[11px] text-zinc-500">Update account details</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

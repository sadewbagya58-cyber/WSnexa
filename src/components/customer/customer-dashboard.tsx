'use client';

import React from 'react';
import Link from 'next/link';
import { CustomerAnalyticsSummary, FormattedCustomerOrder } from '@/server/services/customer-order.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

import { VenueRankingMetrics, CustomerPersonalizedInsight } from '@/lib/validation/ranking';
import { VenueCarousel } from '@/components/discovery/venue-carousel';
import { CustomerLoyaltyAccountRecord } from '@/lib/validation/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

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
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">Customer Portal</span>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 mt-0.5">Good afternoon, {displayName} 👋</h1>
          <p className="text-xs text-zinc-500 mt-1">{email}</p>
        </div>
        <Link
          href="/explore"
          className="px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <span>🔍</span> Explore Venues
        </Link>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/customer/loyalty" className="block group">
          <div className="bg-white border border-zinc-200 hover:border-zinc-300 transition-all rounded-2xl p-5 space-y-2 shadow-xs group-hover:shadow-md">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Loyalty & Rewards</span>
              <span className="text-base">🎁</span>
            </div>
            {IS_LOYALTY_ENABLED ? (
              <>
                <div className="text-3xl font-black text-zinc-950">
                  {totalLoyaltyPoints} <span className="text-sm font-bold text-zinc-500">pts</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {loyaltyAccounts && loyaltyAccounts.length > 0
                    ? `${loyaltyAccounts.length} active venue program${loyaltyAccounts.length > 1 ? 's' : ''}`
                    : 'Across participating venues'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-sm font-black text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    Coming Soon
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium">
                  Points & rewards in upcoming update →
                </div>
              </>
            )}
          </div>
        </Link>

        <Link href="/customer/orders?filter=active" className="block group">
          <div className="bg-white border border-zinc-200 hover:border-zinc-300 transition-all rounded-2xl p-5 space-y-2 shadow-xs group-hover:shadow-md">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Active Orders</span>
              <span className="text-base">🔥</span>
            </div>
            <div className="text-3xl font-black text-zinc-950">
              {analytics.activeOrdersCount}
            </div>
            <div className="text-[11px] text-zinc-500">Orders currently in service</div>
          </div>
        </Link>

        <Link href="/customer/orders" className="block group">
          <div className="bg-white border border-zinc-200 hover:border-zinc-300 transition-all rounded-2xl p-5 space-y-2 shadow-xs group-hover:shadow-md">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span>Completed Orders</span>
              <span className="text-base">🧾</span>
            </div>
            <div className="text-3xl font-black text-zinc-950">
              {analytics.ordersCompletedCount}
            </div>
            <div className="text-[11px] text-zinc-500">Fulfilled hospitality orders</div>
          </div>
        </Link>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Spend</span>
            <span className="text-base">💳</span>
          </div>
          <div className="text-3xl font-black text-zinc-950">
            {formatCurrency(analytics.lifetimeSpendCents, analytics.currency)}
          </div>
          <div className="text-[11px] text-zinc-500">Settled order total</div>
        </div>
      </div>

      {/* Live Active Orders Banner */}
      {activeOrders.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950 flex items-center gap-2">
              <span>🔥</span> Live Active Orders ({activeOrders.length})
            </h3>
            <Link
              href="/customer/orders?filter=active"
              className="text-xs font-bold text-zinc-900 hover:underline"
            >
              View All Active →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeOrders.map((o) => (
              <div
                key={o.id}
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-extrabold text-zinc-950 text-xs">
                    {o.businessName} ({o.branchName})
                  </div>
                  <div className="text-[11px] font-mono text-zinc-600 mt-0.5">
                    {o.orderNumberFormatted} • {o.tableName || 'Direct'}
                  </div>
                </div>
                <Link
                  href={`/customer/orders/${o.id}`}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 text-white font-extrabold text-xs hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  Track Order
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Recommendations Section */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
          <VenueCarousel
            title="✨ Recommended For You"
            subtitle="Handpicked venues based on your visits and preferences"
            venues={recommendations}
          />
        </div>
      )}

      {/* Activity & Order History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <span>🧾</span> Recent Order Activity
            </h3>
            <Link href="/customer/orders" className="text-xs font-bold text-zinc-900 hover:underline">
              View History →
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-2.5">
              {recentOrders.slice(0, 5).map((o) => (
                <Link
                  key={o.id}
                  href={`/customer/orders/${o.id}`}
                  className="block p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-zinc-100 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-zinc-950">{o.businessName}</span>
                    <span className="font-mono text-zinc-600 font-bold">{o.orderNumberFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1">
                    <span>
                      {new Date(o.createdAt).toLocaleDateString()} • {o.itemCount} items
                    </span>
                    <span className="font-black text-zinc-950">
                      {formatCurrency(o.totalCents, o.currency)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-200 rounded-xl space-y-2">
              <div>No claimed guest orders found.</div>
              <div className="text-[10px] text-zinc-400">
                Scan a table QR code and click &quot;Save Order to My Account&quot; to build your history!
              </div>
            </div>
          )}
        </div>

        {/* Quick Links Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Quick Links
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/customer/loyalty"
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors space-y-1 block"
            >
              <div className="text-lg">🎁</div>
              <div className="text-xs font-black text-zinc-950">Loyalty & Rewards</div>
              <div className="text-[11px] text-zinc-500">View points balances & redeem rewards</div>
            </Link>

            <Link
              href="/customer/orders"
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors space-y-1 block"
            >
              <div className="text-lg">🧾</div>
              <div className="text-xs font-black text-zinc-950">All Orders</div>
              <div className="text-[11px] text-zinc-500">View complete order history & receipts</div>
            </Link>

            <Link
              href="/customer/venues"
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors space-y-1 block"
            >
              <div className="text-lg">🏬</div>
              <div className="text-xs font-black text-zinc-950">Venues Visited</div>
              <div className="text-[11px] text-zinc-500">See all restaurants & hotels visited</div>
            </Link>

            <Link
              href="/customer/favorites"
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors space-y-1 block"
            >
              <div className="text-lg">⭐</div>
              <div className="text-xs font-black text-zinc-950">Favorites</div>
              <div className="text-[11px] text-zinc-500">Manage saved venues & items</div>
            </Link>

            <Link
              href="/customer/profile"
              className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors space-y-1 block"
            >
              <div className="text-lg">👤</div>
              <div className="text-xs font-black text-zinc-950">Profile & Preferences</div>
              <div className="text-[11px] text-zinc-500">Update account details</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

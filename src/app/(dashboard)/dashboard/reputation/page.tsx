import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VenueRankingService } from '@/server/services/venue-ranking.service';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Business Reputation & Ranking Insights | WSNexa Dashboard',
  description: 'View public rating confidence, review metrics, customer retention rate, and venue discovery rank',
};

export default async function ReputationDashboardPage() {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext) redirect('/dashboard');

  const hasPerm = await can({
    context: authContext,
    permission: 'reputation.view',
  });

  if (!hasPerm) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-rose-500 font-bold text-lg">⚠️ Access Denied</div>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">reputation.view</code> permission required to access business reputation insights.
        </p>
      </div>
    );
  }

  const metrics = await VenueRankingService.getBusinessReputationMetrics(authContext.businessId);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-white to-white border border-amber-500/20 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Business Reputation & Ranking</h1>
          </div>
          <p className="text-xs text-zinc-600 font-medium leading-relaxed">
            Real-time public performance indicators, verified review confidence, customer retention rate, and WSNexa ranking positions.
          </p>
        </div>

        {metrics.hasProfile && (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="warning" className="font-extrabold text-xs py-1.5 px-3">
              🏆 Overall Rank #{metrics.overallRank}
            </Badge>
            <Badge variant="neutral" className="font-bold text-xs py-1.5 px-3 border-zinc-300">
              🏷️ Category Rank #{metrics.categoryRank}
            </Badge>
          </div>
        )}
      </div>

      {!metrics.hasProfile ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-4 shadow-sm">
          <div className="text-3xl">🏪</div>
          <h3 className="text-lg font-bold text-zinc-950">No Published Public Venue Profile</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Your business does not have an active public venue profile. Publish your venue profile to start tracking public reputation and discovery rankings.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Rating Confidence */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Rating Confidence</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-500 font-mono">
                  {metrics.bayesianRatingScore.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  / 5.0 (Raw: {metrics.rawRatingAverage.toFixed(1)})
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">Bayesian-weighted from verified visits</p>
            </div>

            {/* Verified Reviews */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Verified Reviews</div>
              <div className="text-3xl font-black text-zinc-950 font-mono">
                {metrics.verifiedReviewCount}
              </div>
              <p className="text-[11px] text-zinc-500">100% verified dining visits</p>
            </div>

            {/* Repeat Customer Rate */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Repeat Customer Rate</div>
              <div className="text-3xl font-black text-emerald-600 font-mono">
                {Math.round(metrics.repeatCustomerRate * 100)}%
              </div>
              <p className="text-[11px] text-zinc-500">
                {metrics.repeatCustomersCount} of {metrics.uniqueCustomersCount} unique diners returned
              </p>
            </div>

            {/* Favorites Count */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Public Favorites</div>
              <div className="text-3xl font-black text-rose-500 font-mono">
                {metrics.favoritesCount}
              </div>
              <p className="text-[11px] text-zinc-500">Saved by hospitality customers</p>
            </div>
          </div>

          {/* Detailed Performance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <span>📈</span> Discovery & Order Signals
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="font-bold text-zinc-700">Total Completed Orders</span>
                  <span className="font-mono font-black text-zinc-950">{metrics.completedOrdersCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="font-bold text-zinc-700">Recent 7-Day Orders</span>
                  <span className="font-mono font-black text-amber-600">{metrics.recentOrders7d}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="font-bold text-zinc-700">Recent 30-Day Orders</span>
                  <span className="font-mono font-black text-zinc-950">{metrics.recentOrders30d}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="font-bold text-zinc-700">Popularity Score</span>
                  <span className="font-mono font-black text-emerald-600">{metrics.popularityScore}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <span>🛡️</span> Anti-Gaming & Quality Rules
              </h3>
              <ul className="space-y-2 text-xs text-zinc-600 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-extrabold">✓</span>
                  <span>Unverified or hidden reviews add 0 points to your public rating score.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-extrabold">✓</span>
                  <span>Only completed, non-cancelled orders contribute to popularity & trending.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-extrabold">✓</span>
                  <span>Unique customer capping prevents single-user spam from distorting rankings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-extrabold">✓</span>
                  <span>Bayesian confidence calculation prevents 1 review from outranking established venues.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

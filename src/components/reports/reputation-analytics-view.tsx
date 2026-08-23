'use client';

import React from 'react';
import { ReviewAnalyticsResult } from '@/server/analytics/review-analytics';

interface ReputationAnalyticsViewProps {
  reviews: ReviewAnalyticsResult;
}

export function ReputationAnalyticsView({ reviews }: ReputationAnalyticsViewProps) {
  const avgRating = reviews.avgRating.value;
  const reviewCount = reviews.reviewCount.value || 0;
  const responseRate = reviews.responseRate.value;
  const unrespondedCount = reviews.unrespondedReviewCount.value || 0;

  return (
    <div className="space-y-6">
      {/* Reputation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-1">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Average Rating</div>
          <div className="text-3xl font-black text-amber-400 font-mono flex items-center gap-1">
            <span>{avgRating !== null ? avgRating : 'N/A'}</span>
            <span className="text-xl">★</span>
          </div>
          <div className="text-xs text-zinc-500">{reviewCount} customer reviews</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-1">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Response Rate</div>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            {responseRate !== null ? `${responseRate}%` : 'N/A'}
          </div>
          <div className="text-xs text-zinc-500">Staff response coverage</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-1">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Awaiting Response</div>
          <div className="text-3xl font-black text-rose-400 font-mono">
            {unrespondedCount}
          </div>
          <div className="text-xs text-zinc-500">Unresponded reviews</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-1">
          <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Total Feedback</div>
          <div className="text-3xl font-black text-white font-mono">
            {reviewCount}
          </div>
          <div className="text-xs text-zinc-500">Reviews in date range</div>
        </div>
      </div>

      {/* Star Distribution Breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>⭐</span> Star Rating Breakdown
        </h3>

        {!reviews.ratingDistribution || reviews.ratingDistribution.length === 0 ? (
          <div className="text-xs text-zinc-500 italic p-4 text-center">
            No star reviews recorded for selected period.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.ratingDistribution.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono">{item.value} reviews</span>
                    <span className="text-amber-400 font-bold font-mono">({item.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(item.percentage || 0, 100)}%` }}
                    className="bg-amber-400 h-full rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SubscriptionPlanCode, getPlanDefinition } from '@/lib/config/subscription-plans';
import {
  createSubscriptionPaymentIntentAction,
  CheckoutPreviewResult,
  PaymentIntentRecord,
} from '@/server/actions/subscription-checkout';
import { EnterprisePricingInput } from '@/server/services/subscription-pricing.service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SubscriptionCheckoutReviewClientProps {
  businessName: string;
  planCode: SubscriptionPlanCode;
  enterpriseConfig?: EnterprisePricingInput;
  preview: CheckoutPreviewResult;
}

export function SubscriptionCheckoutReviewClient({
  businessName,
  planCode,
  enterpriseConfig,
  preview,
}: SubscriptionCheckoutReviewClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIntent, setCreatedIntent] = useState<PaymentIntentRecord | null>(null);

  const planDef = getPlanDefinition(planCode);
  const { quote, allowed, conflicts, isUpgrade, isDowngrade, isRenewal } = preview;

  const handleCreateIntent = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Generate a stable checkout attempt identifier per session
      const attemptId = `attempt_${Date.now()}`;
      const res = await createSubscriptionPaymentIntentAction({
        planCode,
        enterpriseConfig,
        checkoutAttemptId: attemptId,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.message || res.error || 'Failed to create payment intent');
        setIsSubmitting(false);
        return;
      }

      setCreatedIntent(res.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Gateway Unavailable / Payment Intent Prepared Screen
  if (createdIntent) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4">
        <Card className="p-8 space-y-6 border-zinc-200 shadow-xl rounded-3xl text-center bg-white">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mx-auto shadow-xs">
            💳
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-full">
              Payment Intent Pending
            </span>
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight mt-3">
              Online Payment Coming Soon
            </h1>
            <p className="text-xs text-zinc-600 font-medium mt-1 max-w-lg mx-auto">
              Your subscription checkout intent has been successfully prepared for{' '}
              <span className="font-extrabold text-zinc-950">{businessName}</span>.
            </p>
          </div>

          {/* Prepared Intent Details */}
          <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 text-left text-xs space-y-2 font-mono text-zinc-700">
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Intent Reference:</span>
              <span className="font-bold text-zinc-950">#{createdIntent.id.slice(0, 13)}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Plan Selection:</span>
              <span className="font-bold text-zinc-950">{planDef.name} Plan</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 pb-2">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Billing Amount:</span>
              <span className="font-bold text-emerald-700 font-mono">
                LKR {createdIntent.amountLkr.toLocaleString()} / month
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 font-bold uppercase text-[10px]">Intent Status:</span>
              <span className="font-extrabold text-amber-700 uppercase">{createdIntent.status}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left space-y-1">
            <div className="font-extrabold uppercase text-[10px] text-amber-800">Gateway Status Note</div>
            <p className="leading-relaxed">
              Dialog Gateway connection is not yet available. Please contact WSNexa support or sales for manual activation, or return when online payments are enabled.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/dashboard/settings/subscription" className="flex-1">
              <Button type="button" variant="outline" className="w-full h-11 text-xs font-bold rounded-2xl">
                Return to Subscription & Billing
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button type="button" className="w-full h-11 text-xs font-extrabold bg-zinc-950 text-white rounded-2xl hover:bg-zinc-800">
                Back to Overview
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Checkout Review Screen
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Review Subscription Checkout</h1>
          <p className="text-xs font-medium text-zinc-600 mt-0.5">
            Review order details and verify plan configuration for {businessName}.
          </p>
        </div>
        <Link href="/dashboard/settings/subscription">
          <Button variant="outline" className="text-xs h-9">
            ← Change Plan
          </Button>
        </Link>
      </div>

      {/* Downgrade Conflicts Warning */}
      {!allowed && conflicts && conflicts.length > 0 && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm">
            <span>⚠️</span> Cannot Switch to {planDef.name} Yet
          </div>
          <p className="text-xs text-red-800 font-medium">
            Your current resource usage exceeds the limits for the {planDef.name} plan. Please reduce usage before changing your subscription.
          </p>
          <ul className="text-xs font-mono text-red-900 space-y-1 pl-2">
            {conflicts.map((c, idx) => (
              <li key={idx}>
                • {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Order Itemization Card */}
      <Card className="p-6 space-y-6 border-zinc-200 shadow-sm rounded-3xl bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Selected Plan</div>
            <div className="text-xl font-black text-zinc-950 flex items-center gap-2 mt-0.5">
              <span>{planDef.name}</span>
              {isRenewal && (
                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                  RENEWAL
                </span>
              )}
              {isUpgrade && (
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                  UPGRADE
                </span>
              )}
              {isDowngrade && (
                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                  DOWNGRADE
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Billing Interval</div>
            <div className="text-sm font-bold text-zinc-900 mt-0.5 capitalize">Monthly</div>
          </div>
        </div>

        {/* Enterprise Configuration Breakdown */}
        {planCode === 'enterprise' && quote.breakdown && (
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-2 text-xs">
            <div className="font-black text-zinc-950 uppercase text-[10px] tracking-wider border-b border-zinc-200 pb-1">
              Enterprise Scale Configuration
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Requested Scale:</span>
              <span className="font-bold text-zinc-950">
                {quote.breakdown.requestedBranches} Branches / {quote.breakdown.requestedStaff} Staff
              </span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Base Enterprise (5 Branches / 75 Staff):</span>
              <span className="font-mono font-bold text-zinc-900">
                LKR {quote.breakdown.basePrice.toLocaleString()} / mo
              </span>
            </div>
            {quote.breakdown.extraBranches > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>Extra Branches ({quote.breakdown.extraBranches}):</span>
                <span className="font-mono font-bold text-zinc-900">
                  +LKR {quote.breakdown.extraBranchCharge.toLocaleString()} / mo
                </span>
              </div>
            )}
            {quote.breakdown.extraStaffBlocks > 0 && (
              <div className="flex justify-between text-zinc-700">
                <span>Extra Staff ({quote.breakdown.extraStaffBlocks} blocks of 25):</span>
                <span className="font-mono font-bold text-zinc-900">
                  +LKR {quote.breakdown.extraStaffCharge.toLocaleString()} / mo
                </span>
              </div>
            )}
          </div>
        )}

        {/* Total Price Summary */}
        <div className="pt-2 border-t border-zinc-100 flex justify-between items-center">
          <div>
            <span className="text-xs font-black uppercase text-zinc-500">Final Monthly Amount</span>
            <p className="text-[11px] font-medium text-zinc-400">Verified calculated price</p>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-950">
            LKR {quote.total.toLocaleString()} <span className="text-xs font-normal text-zinc-500">/ mo</span>
          </div>
        </div>
      </Card>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-900">
          {errorMessage}
        </div>
      )}

      {/* Primary Action Button */}
      <div className="pt-2">
        <Button
          type="button"
          disabled={!allowed || isSubmitting}
          onClick={handleCreateIntent}
          className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40"
        >
          {isSubmitting ? 'Preparing Payment Intent...' : 'Continue to Payment ⚡'}
        </Button>
      </div>
    </div>
  );
}

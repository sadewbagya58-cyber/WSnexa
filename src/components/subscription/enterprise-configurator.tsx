'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionPricingService } from '@/server/services/subscription-pricing.service';
import { SUBSCRIPTION_PRICING_CONFIG } from '@/lib/config/subscription-plans';
import { Button } from '@/components/ui/button';

interface EnterpriseConfiguratorProps {
  initialBranches?: number;
  initialStaff?: number;
  onCancel?: () => void;
}

export function EnterpriseConfigurator({
  initialBranches = 5,
  initialStaff = 75,
  onCancel,
}: EnterpriseConfiguratorProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<number>(Math.max(1, initialBranches));
  const [staff, setStaff] = useState<number>(Math.max(1, initialStaff));

  // Compute live estimate using client-side SubscriptionPricingService call
  let quote = null;
  let calculationError = null;
  try {
    quote = SubscriptionPricingService.calculateEnterprisePrice({
      branches,
      activeStaff: staff,
    });
  } catch (err: unknown) {
    calculationError = err instanceof Error ? err.message : 'Invalid configuration';
  }

  const handleProceedToCheckout = () => {
    if (!quote) return;
    const params = new URLSearchParams({
      plan: 'enterprise',
      branches: String(branches),
      staff: String(staff),
    });
    router.push(`/dashboard/settings/subscription/checkout?${params.toString()}`);
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xl space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-0.5 rounded-full">
            Custom Enterprise Scale
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mt-1">
          Enterprise Scale Configurator
        </h2>
        <p className="text-xs text-zinc-500 font-semibold mt-0.5">
          Configure required venue branches and staff seats. Base Enterprise includes 5 branches & 75 staff.
        </p>
      </div>

      {/* Interactive Controls */}
      <div className="space-y-5">
        {/* Branches Control */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-black text-zinc-950 uppercase">Required Branches</span>
              <p className="text-[11px] font-medium text-zinc-500">
                Includes 5 branches (Extra: LKR {SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraBranchMonthlyLkr.toLocaleString()}/mo per branch)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={100}
                value={branches}
                onChange={(e) => setBranches(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 h-9 px-2 text-right text-base font-black font-mono text-zinc-950 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
              <span className="text-xs font-bold text-zinc-500">branches</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBranches((b) => Math.max(1, b - 1))}
              disabled={branches <= 1}
              className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-extrabold text-base hover:bg-zinc-100 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              -
            </button>

            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={branches}
              onChange={(e) => setBranches(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="flex-1 accent-zinc-950 cursor-pointer"
            />

            <button
              type="button"
              onClick={() => setBranches((b) => b + 1)}
              className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-extrabold text-base hover:bg-zinc-100 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              +
            </button>
          </div>
        </div>

        {/* Staff Seats Control */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-black text-zinc-950 uppercase">Required Active Staff</span>
              <p className="text-[11px] font-medium text-zinc-500">
                Includes 75 staff (Extra: LKR {SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraStaffBlockMonthlyLkr.toLocaleString()}/mo per 25-staff block)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={1000}
                value={staff}
                onChange={(e) => setStaff(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 h-9 px-2 text-right text-base font-black font-mono text-zinc-950 bg-white border border-zinc-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-950"
              />
              <span className="text-xs font-bold text-zinc-500">staff</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStaff((s) => Math.max(1, s - 1))}
              disabled={staff <= 1}
              className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-extrabold text-base hover:bg-zinc-100 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              -
            </button>

            <input
              type="range"
              min={1}
              max={500}
              step={1}
              value={staff}
              onChange={(e) => setStaff(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="flex-1 accent-zinc-950 cursor-pointer"
            />

            <button
              type="button"
              onClick={() => setStaff((s) => s + 1)}
              className="w-10 h-10 rounded-xl bg-white border border-zinc-200 text-zinc-900 font-extrabold text-base hover:bg-zinc-100 transition-all cursor-pointer flex items-center justify-center shadow-2xs shrink-0"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Breakdown Summary */}
      {quote && quote.breakdown && (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950 text-white p-5 space-y-3 shadow-md">
          <div className="text-xs font-black uppercase text-zinc-400">Enterprise Quote Summary</div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-300">Base Enterprise (5 Branches / 75 Staff):</span>
              <span className="font-mono font-bold text-white">LKR {quote.breakdown.basePrice.toLocaleString()} / mo</span>
            </div>

            {quote.breakdown.extraBranches > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-300">
                  {quote.breakdown.extraBranches} Extra Branch(es) (+LKR 3,000/ea):
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  +LKR {quote.breakdown.extraBranchCharge.toLocaleString()} / mo
                </span>
              </div>
            )}

            {quote.breakdown.extraStaffBlocks > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-300">
                  {quote.breakdown.extraStaffBlocks} Extra Staff Block(s) ({quote.breakdown.extraStaffCount} staff above 75):
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  +LKR {quote.breakdown.extraStaffCharge.toLocaleString()} / mo
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-sm font-extrabold text-white">Total Enterprise Price:</span>
            <span className="text-xl font-black font-mono text-emerald-400">
              LKR {quote.total.toLocaleString()} <span className="text-xs font-normal text-zinc-400">/ mo</span>
            </span>
          </div>
        </div>
      )}

      {calculationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800">
          {calculationError}
        </div>
      )}

      {/* Action CTAs */}
      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 text-xs h-11"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          disabled={!quote}
          onClick={handleProceedToCheckout}
          className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs h-11 rounded-2xl shadow-sm transition-all cursor-pointer"
        >
          Proceed to Enterprise Checkout ⚡
        </Button>
      </div>
    </div>
  );
}

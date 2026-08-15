'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getProgramSettingsAction, updateProgramSettingsAction } from '@/server/actions/loyalty';
import { EarningModel } from '@/lib/validation/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

export default function LoyaltySettingsPage() {
  const [loading, setLoading] = useState(IS_LOYALTY_ENABLED);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [earningModel, setEarningModel] = useState<EarningModel>('spend_based');
  const [spendLkrPerPoint, setSpendLkrPerPoint] = useState(100);
  const [pointsPerVisit, setPointsPerVisit] = useState(10);
  const [minimumOrderSpendCents, setMinimumOrderSpendCents] = useState(0);
  const [minRedemptionBalance, setMinRedemptionBalance] = useState(0);

  useEffect(() => {
    if (!IS_LOYALTY_ENABLED) return;

    let ignore = false;
    async function loadSettings() {
      const res = await getProgramSettingsAction();
      if (!ignore && res.success && res.settings) {
        setIsEnabled(res.settings.isEnabled);
        setEarningModel(res.settings.earningModel);
        setSpendLkrPerPoint(res.settings.spendLkrPerPoint);
        setPointsPerVisit(res.settings.pointsPerVisit);
        setMinimumOrderSpendCents(res.settings.minimumOrderSpendCents);
        setMinRedemptionBalance(res.settings.minRedemptionBalance);
        setLoading(false);
      }
    }
    loadSettings();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSave() {
    if (!IS_LOYALTY_ENABLED) return;
    setSaving(true);
    setMsg(null);

    const res = await updateProgramSettingsAction({
      isEnabled,
      earningModel,
      spendLkrPerPoint: Number(spendLkrPerPoint),
      pointsPerVisit: Number(pointsPerVisit),
      minimumOrderSpendCents: Number(minimumOrderSpendCents),
      minRedemptionBalance: Number(minRedemptionBalance),
    });

    if (res.success) {
      setMsg({ type: 'success', text: 'Loyalty program settings updated successfully!' });
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to update settings.' });
    }
    setSaving(false);
  }

  // ── 1. Coming Soon State for V1 ──────────────────────────────────────────
  if (!IS_LOYALTY_ENABLED) {
    return (
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
                🎁 Loyalty & Rewards Engine
              </h1>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Planned for a future WSNexa platform update.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/loyalty/rewards">
              <Button variant="outline" size="sm" className="text-xs font-bold">
                🏆 Manage Rewards
              </Button>
            </Link>
            <Link href="/dashboard/loyalty/customers">
              <Button variant="outline" size="sm" className="text-xs font-bold">
                👥 Loyalty Customers
              </Button>
            </Link>
          </div>
        </div>

        {/* Coming Soon Hero Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 text-center space-y-6 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-3xl mx-auto shadow-2xs">
            🎁
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950">
              Customer Retention Engine — Coming Soon
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 leading-relaxed">
              We are finalizing the automated points calculation, tier progression, and reward redemption architecture for hospitality venues. In an upcoming update, you will be able to customize points formulas and offer exclusive rewards to your patrons.
            </p>
          </div>

          {/* Planned Capabilities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left pt-2">
            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1.5">
              <div className="text-xl">💰</div>
              <h3 className="text-xs font-bold text-zinc-950">Spend-Based & Visit Points</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Set conversion rates (e.g. 1 point per 100 LKR spent) or flat visit rewards.</p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1.5">
              <div className="text-xl">🏆</div>
              <h3 className="text-xs font-bold text-zinc-950">Flexible Rewards Catalog</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Create fixed discounts, percentage vouchers, and complimentary items.</p>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1.5">
              <div className="text-xl">📊</div>
              <h3 className="text-xs font-bold text-zinc-950">Patron Retention Roster</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Track repeat guest visit frequencies and lifetime dining spending.</p>
            </div>
          </div>

          <div className="pt-4">
            <Link
              href="/dashboard"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-6 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              ← Back to Overview Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Full Active Configuration (Preserved for Future Update) ───────────
  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading Loyalty Program Configuration...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            🎁 Loyalty & Rewards Program
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Build customer retention with plain-English points and reward rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/loyalty/rewards">
            <Button variant="outline" size="sm" className="font-semibold">
              🏆 Manage Rewards
            </Button>
          </Link>
          <Link href="/dashboard/loyalty/customers">
            <Button variant="outline" size="sm" className="font-semibold">
              👥 Loyalty Customers
            </Button>
          </Link>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Program Toggle */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Program Status</h3>
            <p className="text-xs text-zinc-500">
              When active, customers automatically earn points on qualifying completed orders.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            onClick={() => setIsEnabled(!isEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              isEnabled ? 'bg-amber-500' : 'bg-zinc-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Earning Model Settings */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-bold">Earning Model</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setEarningModel('spend_based')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              earningModel === 'spend_based'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="font-bold text-sm">💰 Spend-Based</div>
            <p className="text-xs text-zinc-500 mt-1">
              Points proportional to money spent (e.g. 1 pt per 100 LKR).
            </p>
          </div>

          <div
            onClick={() => setEarningModel('visit_based')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              earningModel === 'visit_based'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="font-bold text-sm">📍 Visit-Based</div>
            <p className="text-xs text-zinc-500 mt-1">
              Fixed points awarded per completed dining visit.
            </p>
          </div>

          <div
            onClick={() => setEarningModel('combined')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              earningModel === 'combined'
                ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="font-bold text-sm">⚡ Combined</div>
            <p className="text-xs text-zinc-500 mt-1">
              Points awarded for visiting + additional points per spend amount.
            </p>
          </div>
        </div>

        {/* Dynamic Formula Config */}
        <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          {(earningModel === 'spend_based' || earningModel === 'combined') && (
            <div>
              <label className="block text-xs font-bold text-zinc-700">
                Spend Amount per 1 Point (LKR)
              </label>
              <input
                type="number"
                min="1"
                value={spendLkrPerPoint}
                onChange={(e) => setSpendLkrPerPoint(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                E.g. 100 means customer earns 1 pt for every 100 LKR spent.
              </p>
            </div>
          )}

          {(earningModel === 'visit_based' || earningModel === 'combined') && (
            <div>
              <label className="block text-xs font-bold text-zinc-700">
                Points Awarded per Visit
              </label>
              <input
                type="number"
                min="1"
                value={pointsPerVisit}
                onChange={(e) => setPointsPerVisit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Flat points granted when an order is completed.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-700">
              Minimum Order Spend for Points (LKR)
            </label>
            <input
              type="number"
              min="0"
              value={minimumOrderSpendCents / 100}
              onChange={(e) => setMinimumOrderSpendCents(Number(e.target.value) * 100)}
              className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700">
              Minimum Points Balance to Redeem
            </label>
            <input
              type="number"
              min="0"
              value={minRedemptionBalance}
              onChange={(e) => setMinRedemptionBalance(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="font-bold">
            {saving ? 'Saving...' : 'Save Program Rules'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getProgramSettingsAction, updateProgramSettingsAction } from '@/server/actions/loyalty';
import { EarningModel } from '@/lib/validation/loyalty';

export default function LoyaltySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [earningModel, setEarningModel] = useState<EarningModel>('spend_based');
  const [spendLkrPerPoint, setSpendLkrPerPoint] = useState(100);
  const [pointsPerVisit, setPointsPerVisit] = useState(10);
  const [minimumOrderSpendCents, setMinimumOrderSpendCents] = useState(0);
  const [minRedemptionBalance, setMinRedemptionBalance] = useState(0);

  useEffect(() => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
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
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Program Status Switch */}
      <Card>
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold">Program Status</h3>
            <p className="text-xs text-zinc-500">Turn your loyalty program on or off for this venue.</p>
          </div>
          <Badge variant={isEnabled ? 'success' : 'neutral'} className="text-xs px-3 py-1 font-bold">
            {isEnabled ? '● Active' : '○ Disabled'}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => setIsEnabled(!isEnabled)}
          className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-between transition-all ${
            isEnabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
          }`}
        >
          <span>{isEnabled ? 'Loyalty Program is ENABLED for customers' : 'Enable Loyalty Program'}</span>
          <span>{isEnabled ? 'Switch OFF' : 'Switch ON'}</span>
        </button>
      </Card>

      {/* Plain-English Earning Rules */}
      <Card>
        <div className="border-b border-zinc-100 pb-4 mb-4">
          <h3 className="text-lg font-bold">How Customers Earn Points</h3>
          <p className="text-xs text-zinc-500">Choose how your customers earn loyalty points on eligible orders.</p>
        </div>
        <div className="space-y-6">
          {/* Earning Model Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setEarningModel('spend_based')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                earningModel === 'spend_based'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="text-lg mb-1">💳 Spend Based</div>
              <p className="text-xs text-zinc-500">Customers earn points based on total LKR spent.</p>
            </div>

            <div
              onClick={() => setEarningModel('visit_based')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                earningModel === 'visit_based'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="text-lg mb-1">📍 Visit Based</div>
              <p className="text-xs text-zinc-500">Customers earn fixed points per completed visit.</p>
            </div>

            <div
              onClick={() => setEarningModel('combined')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                earningModel === 'combined'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
              }`}
            >
              <div className="text-lg mb-1">⚡ Combined</div>
              <p className="text-xs text-zinc-500">Customers earn points for both spend and visit.</p>
            </div>
          </div>

          {/* Configurable Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl">
            {(earningModel === 'spend_based' || earningModel === 'combined') && (
              <div className="space-y-2">
                <label className="font-semibold text-sm block">Customers earn 1 Point for every:</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-500">LKR</span>
                  <input
                    type="number"
                    value={spendLkrPerPoint}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpendLkrPerPoint(Number(e.target.value))}
                    min={1}
                    className="h-10 px-3 rounded-md border border-zinc-200 font-bold text-base w-full"
                  />
                  <span className="text-sm font-bold text-zinc-500">spent</span>
                </div>
              </div>
            )}

            {(earningModel === 'visit_based' || earningModel === 'combined') && (
              <div className="space-y-2">
                <label className="font-semibold text-sm block">Points per completed visit:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={pointsPerVisit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPointsPerVisit(Number(e.target.value))}
                    min={0}
                    className="h-10 px-3 rounded-md border border-zinc-200 font-bold text-base w-full"
                  />
                  <span className="text-sm font-bold text-zinc-500">Points</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Rules & Thresholds */}
      <Card>
        <div className="border-b border-zinc-100 pb-4 mb-4">
          <h3 className="text-lg font-bold">Program Thresholds & Rules</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="font-semibold text-sm block">Minimum Order Spend for Points (Cents)</label>
            <input
              type="number"
              value={minimumOrderSpendCents}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinimumOrderSpendCents(Number(e.target.value))}
              min={0}
              placeholder="0 (No minimum)"
              className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
            />
            <p className="text-xs text-zinc-500">Example: 50000 cents = LKR 500 minimum spend to earn points.</p>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-sm block">Minimum Points Balance to Redeem Rewards</label>
            <input
              type="number"
              value={minRedemptionBalance}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinRedemptionBalance(Number(e.target.value))}
              min={0}
              placeholder="0 (No minimum)"
              className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
            />
            <p className="text-xs text-zinc-500">Minimum points customer must hold before redeeming rewards.</p>
          </div>
        </div>
      </Card>

      {/* Save Action */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving} size="lg" className="font-bold px-8">
          {saving ? 'Saving Settings...' : 'Save Loyalty Settings'}
        </Button>
      </div>
    </div>
  );
}

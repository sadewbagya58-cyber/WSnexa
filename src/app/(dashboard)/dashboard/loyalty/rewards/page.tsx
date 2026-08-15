'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAvailableRewardsAction, createRewardAction } from '@/server/actions/loyalty';
import { LoyaltyRewardRecord, RewardType } from '@/lib/validation/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

export default function LoyaltyRewardsPage() {
  const [loading, setLoading] = useState(IS_LOYALTY_ENABLED);
  const [rewards, setRewards] = useState<LoyaltyRewardRecord[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsRequired, setPointsRequired] = useState(100);
  const [rewardType, setRewardType] = useState<RewardType>('fixed_discount');
  const [discountAmountCents, setDiscountAmountCents] = useState(50000); // 500 LKR
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [minOrderValueCents] = useState(0);

  useEffect(() => {
    if (!IS_LOYALTY_ENABLED) return;

    let ignore = false;
    async function fetchRewards() {
      const res = await getAvailableRewardsAction('current');
      if (!ignore) {
        if (res.success && res.rewards) {
          setRewards(res.rewards);
        }
        setLoading(false);
      }
    }
    fetchRewards();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    if (!IS_LOYALTY_ENABLED) return;
    setSaving(true);
    setMsg(null);

    const res = await createRewardAction({
      title,
      description: description || null,
      pointsRequired: Number(pointsRequired),
      rewardType,
      discountAmountCents: rewardType === 'fixed_discount' ? Number(discountAmountCents) : null,
      discountPercentage: rewardType === 'percentage_discount' ? Number(discountPercentage) : null,
      minOrderValueCents: Number(minOrderValueCents),
      isActive: true,
    });

    if (res.success) {
      setMsg({ type: 'success', text: 'Reward created successfully!' });
      setShowDrawer(false);
      setTitle('');
      setDescription('');
      const refreshed = await getAvailableRewardsAction('current');
      if (refreshed.success && refreshed.rewards) {
        setRewards(refreshed.rewards);
      }
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to create reward.' });
    }
    setSaving(false);
  }

  // ── 1. Coming Soon State for V1 ──────────────────────────────────────────
  if (!IS_LOYALTY_ENABLED) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/loyalty" className="text-xs font-bold text-zinc-500 hover:text-zinc-950">
                ← Loyalty Overview
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
                🏆 Rewards Catalog
              </h1>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Reward creation and voucher configuration will be enabled in a future WSNexa update.
            </p>
          </div>

          <Link href="/dashboard/loyalty">
            <Button variant="outline" size="sm" className="text-xs font-bold">
              ← Return to Loyalty
            </Button>
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 text-center space-y-6 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-3xl mx-auto shadow-2xs">
            🏆
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950">
              Rewards Catalog Coming Soon
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 leading-relaxed">
              When released, you will be able to create custom fixed discounts, percentage vouchers, and complimentary food/beverage redemptions linked to patron points balances.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard/loyalty"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-6 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              ← Back to Loyalty Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Full Active Catalog (Preserved for Future Update) ──────────────────
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/loyalty" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">
              ← Loyalty Settings
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mt-1">
            🏆 Rewards Catalog
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Create items, discounts, or vouchers customer can redeem with earned points.
          </p>
        </div>
        <Button onClick={() => setShowDrawer(true)} className="font-bold">
          + Create New Reward
        </Button>
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

      {loading ? (
        <div className="p-8 text-center text-zinc-500">Loading Rewards Catalog...</div>
      ) : rewards.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="text-xl font-bold">No active rewards created yet.</h3>
          <p className="max-w-md mx-auto text-sm text-zinc-500 mt-2">
            Reward your best patrons with discounts, vouchers, or free drinks!
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowDrawer(true)} className="font-bold">
              Create First Reward
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((r) => (
            <Card key={r.id} className="flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold">{r.title}</h3>
                  <Badge variant={r.isActive ? 'success' : 'neutral'}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {r.description && <p className="text-xs text-zinc-500">{r.description}</p>}
              </div>

              <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Cost</span>
                  <span className="text-xl font-black text-amber-600">{r.pointsRequired} pts</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Benefit</span>
                  <span className="text-sm font-bold text-zinc-800">
                    {r.rewardType === 'fixed_discount' && `LKR ${(r.discountAmountCents || 0) / 100} OFF`}
                    {r.rewardType === 'percentage_discount' && `${r.discountPercentage}% OFF`}
                    {r.rewardType === 'free_item' && `Free Item`}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Reward Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold">Create Loyalty Reward</h3>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReward} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700">Reward Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 500 LKR Off Any Order"
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700">Points Required *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={pointsRequired}
                  onChange={(e) => setPointsRequired(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700">Reward Type</label>
                <select
                  value={rewardType}
                  onChange={(e) => setRewardType(e.target.value as RewardType)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                >
                  <option value="fixed_discount">Fixed Amount Discount (LKR)</option>
                  <option value="percentage_discount">Percentage Discount (%)</option>
                </select>
              </div>

              {rewardType === 'fixed_discount' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700">Discount Amount (LKR) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={discountAmountCents / 100}
                    onChange={(e) => setDiscountAmountCents(Number(e.target.value) * 100)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                  />
                </div>
              )}

              {rewardType === 'percentage_discount' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700">Discount Percentage (%) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700">Short Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Terms or details for redemption..."
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDrawer(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="font-bold">
                  {saving ? 'Creating...' : 'Create Reward'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

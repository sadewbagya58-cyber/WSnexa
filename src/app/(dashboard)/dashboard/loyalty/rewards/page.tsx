'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAvailableRewardsAction, createRewardAction } from '@/server/actions/loyalty';
import { LoyaltyRewardRecord, RewardType } from '@/lib/validation/loyalty';

export default function LoyaltyRewardsPage() {
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/loyalty" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900">
              ← Loyalty Settings
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight mt-1">
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

      {/* Rewards Grid / List */}
      {loading ? (
        <div className="p-8 text-center text-zinc-500">Loading Rewards Catalog...</div>
      ) : rewards.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
            No rewards created yet.
          </h3>
          <p className="max-w-md mx-auto text-sm text-zinc-500 mt-2">
            Create your first reward (e.g. Free Coffee, LKR 500 Discount, or 10% Off) to encourage repeat visits.
          </p>
          <Button onClick={() => setShowDrawer(true)} className="mt-6 font-bold">
            + Create Your First Reward
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rewards.map((r) => (
            <Card key={r.id} className="relative overflow-hidden">
              <div className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{r.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1">{r.description || 'No description provided.'}</p>
                  </div>
                  <Badge variant="warning" className="font-extrabold text-sm px-3 py-1">
                    {r.pointsRequired} Points
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>
                  Type:{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {r.rewardType === 'fixed_discount'
                      ? `LKR ${(r.discountAmountCents || 0) / 100} Off`
                      : r.rewardType === 'percentage_discount'
                      ? `${r.discountPercentage}% Off`
                      : r.rewardType}
                  </strong>
                </span>
                <span>{r.isActive ? '● Active' : '○ Inactive'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Reward Drawer/Modal */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full bg-white dark:bg-zinc-900 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-lg font-bold">Create New Reward</h2>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="text-zinc-500 hover:text-zinc-900 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReward} className="space-y-4">
              <div className="space-y-2">
                <label className="font-semibold text-sm block">Reward Title</label>
                <input
                  required
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="e.g. Free Coffee or LKR 500 Discount"
                  className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-sm block">Description (Optional)</label>
                <input
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="e.g. Valid on any order above LKR 1000"
                  className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-semibold text-sm block">Points Required</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={pointsRequired}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPointsRequired(Number(e.target.value))}
                    className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-sm block">Reward Type</label>
                  <select
                    value={rewardType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRewardType(e.target.value as RewardType)}
                    className="w-full h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                  >
                    <option value="fixed_discount">Fixed Amount Discount (LKR)</option>
                    <option value="percentage_discount">Percentage Discount (%)</option>
                    <option value="free_item">Free Menu Item</option>
                    <option value="custom">Custom Reward</option>
                  </select>
                </div>
              </div>

              {rewardType === 'fixed_discount' && (
                <div className="space-y-2">
                  <label className="font-semibold text-sm block">Discount Amount (Cents)</label>
                  <input
                    type="number"
                    min={0}
                    value={discountAmountCents}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscountAmountCents(Number(e.target.value))}
                    placeholder="50000 (500 LKR)"
                    className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                  />
                </div>
              )}

              {rewardType === 'percentage_discount' && (
                <div className="space-y-2">
                  <label className="font-semibold text-sm block">Discount Percentage (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={discountPercentage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscountPercentage(Number(e.target.value))}
                    className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
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

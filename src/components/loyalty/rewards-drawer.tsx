'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoyaltyRewardRecord, CustomerLoyaltyAccountRecord } from '@/lib/validation/loyalty';
import { useCart } from '@/features/cart/cart-context';

interface RewardsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  loyaltyAccount: CustomerLoyaltyAccountRecord | null;
  availableRewards: LoyaltyRewardRecord[];
  subtotalCents: number;
}

export function RewardsDrawer({
  isOpen,
  onClose,
  isAuthenticated,
  loyaltyAccount,
  availableRewards,
  subtotalCents,
}: RewardsDrawerProps) {
  const pathname = usePathname();
  const { state: cartState, setSelectedReward } = useCart();

  if (!isOpen) return null;

  const pointsBalance = loyaltyAccount?.pointsBalance || 0;
  const selectedRewardId = cartState.selectedReward?.id || null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-zinc-900 border-zinc-800 text-white p-6 space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <h2 className="text-lg font-black tracking-tight">Available Rewards</h2>
            </div>
            {isAuthenticated && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Current venue balance:{' '}
                <strong className="text-amber-400 font-mono font-bold text-sm">{pointsBalance} pts</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!isAuthenticated ? (
            <div className="p-6 text-center bg-zinc-950/60 border border-zinc-800 rounded-2xl space-y-4">
              <div className="text-4xl">🔐</div>
              <div>
                <h3 className="text-base font-bold text-white">Sign in to use your rewards</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Sign in with your customer account to apply venue points & redeem discounts.
                </p>
              </div>
              <div className="pt-2">
                <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>
                  <Button className="w-full font-bold bg-amber-500 hover:bg-amber-400 text-black">
                    Sign In to Account
                  </Button>
                </Link>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Signing in preserves your current table PIN and cart items!
                </p>
              </div>
            </div>
          ) : availableRewards.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm italic">
              No rewards available for this venue right now.
            </div>
          ) : (
            availableRewards.map((reward) => {
              const pointsNeeded = reward.pointsRequired - pointsBalance;
              const hasEnoughPoints = pointsBalance >= reward.pointsRequired;
              const isSelected = selectedRewardId === reward.id;
              const minSpendMet = !reward.minOrderValueCents || subtotalCents >= reward.minOrderValueCents;

              let typeLabel = '';
              if (reward.rewardType === 'fixed_discount') {
                typeLabel = `LKR ${(reward.discountAmountCents || 0) / 100} OFF`;
              } else if (reward.rewardType === 'percentage_discount') {
                typeLabel = `${reward.discountPercentage}% OFF`;
              } else if (reward.rewardType === 'free_item') {
                typeLabel = 'Free Menu Item';
              } else {
                typeLabel = reward.title;
              }

              return (
                <div
                  key={reward.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500'
                      : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{reward.title}</h4>
                        <Badge variant="neutral" className="text-[10px] bg-zinc-800 text-amber-400 border-amber-500/30">
                          {typeLabel}
                        </Badge>
                      </div>
                      {reward.description && (
                        <p className="text-xs text-zinc-400 mt-1">{reward.description}</p>
                      )}
                      {reward.minOrderValueCents > 0 && (
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Min. spend required: LKR {(reward.minOrderValueCents / 100).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-xs font-black text-amber-400 block">
                        {reward.pointsRequired} pts
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                    {isSelected ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                          <span>✓</span> Selected for Cart
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReward(null)}
                          className="text-xs border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : hasEnoughPoints ? (
                      <Button
                        size="sm"
                        disabled={!minSpendMet}
                        onClick={() => {
                          setSelectedReward(reward);
                          onClose();
                        }}
                        className="w-full font-bold bg-amber-500 hover:bg-amber-400 text-black text-xs disabled:opacity-50"
                      >
                        {minSpendMet
                          ? `Use ${reward.pointsRequired} Points`
                          : `Min order LKR ${reward.minOrderValueCents / 100} required`}
                      </Button>
                    ) : (
                      <div className="w-full text-center py-1.5 px-3 rounded-lg bg-zinc-900 text-zinc-500 text-xs font-semibold">
                        [{pointsNeeded} more point{pointsNeeded > 1 ? 's' : ''} needed]
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800 flex justify-end">
          <Button variant="outline" onClick={onClose} className="text-xs font-bold border-zinc-700">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

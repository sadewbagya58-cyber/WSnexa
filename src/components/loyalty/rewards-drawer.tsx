'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
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

export const RewardsDrawer = React.memo(function RewardsDrawer({
  isOpen,
  onClose,
  isAuthenticated,
  loyaltyAccount,
  availableRewards,
  subtotalCents,
}: RewardsDrawerProps) {
  const pathname = usePathname();
  const { state: cartState, setSelectedReward } = useCart();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pointsBalance = loyaltyAccount?.pointsBalance || 0;
  const selectedRewardId = cartState.selectedReward?.id || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewards-modal-title"
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white border border-zinc-200 text-zinc-950 rounded-3xl shadow-xl p-5 sm:p-6 space-y-5 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>🎁</span>
              <h2 id="rewards-modal-title" className="text-lg font-black text-zinc-950 tracking-tight">
                Available Rewards
              </h2>
            </div>
            {isAuthenticated && (
              <p className="text-xs text-zinc-500 font-medium mt-1">
                Current venue balance:{' '}
                <strong className="text-amber-600 font-mono font-bold text-sm">{pointsBalance} pts</strong>
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close rewards modal"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 font-bold text-lg p-2 rounded-full hover:bg-zinc-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-2 focus:ring-zinc-300 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!isAuthenticated ? (
            <div className="p-6 text-center bg-amber-50/60 border border-amber-200 rounded-2xl space-y-4">
              <div className="text-4xl" aria-hidden>🔐</div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-950">Sign in to use your rewards</h3>
                <p className="text-xs text-zinc-600 font-medium">
                  Sign in with your customer account to apply venue points &amp; redeem discounts.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>
                  <Button className="w-full font-extrabold text-xs py-3.5 bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white rounded-xl min-h-[44px] touch-manipulation shadow-xs cursor-pointer">
                    Sign In to Account
                  </Button>
                </Link>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Signing in preserves your current table PIN and cart items!
                </p>
              </div>
            </div>
          ) : availableRewards.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-zinc-500 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              No rewards available for this venue right now.
            </div>
          ) : (
            availableRewards.map((reward) => {
              const pointsNeeded = reward.pointsRequired - pointsBalance;
              const hasEnoughPoints = pointsBalance >= reward.pointsRequired;
              const isSelected = selectedRewardId === reward.id;
              const minSpendMet = !reward.minOrderValueCents || subtotalCents >= reward.minOrderValueCents;

              let typeLabel = '';
              if (reward.rewardType === 'fixed_discount' && reward.discountAmountCents) {
                typeLabel = `LKR ${(reward.discountAmountCents / 100).toLocaleString()} OFF`;
              } else if (reward.rewardType === 'percentage_discount' && reward.discountPercentage) {
                typeLabel = `${reward.discountPercentage}% OFF`;
              } else if (reward.rewardType === 'free_item') {
                typeLabel = 'Free Menu Item';
              } else if (reward.title) {
                typeLabel = reward.title;
              }

              return (
                <div
                  key={reward.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isSelected
                      ? 'border-2 border-amber-500 bg-amber-50/40 shadow-xs'
                      : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-zinc-950 text-sm">{reward.title}</h4>
                        {typeLabel.trim() && (
                          <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-bold text-[11px] px-2 py-0.5 rounded-md">
                            {typeLabel}
                          </span>
                        )}
                      </div>
                      {reward.description && (
                        <p className="text-xs text-zinc-600 font-medium leading-relaxed">{reward.description}</p>
                      )}
                      {reward.minOrderValueCents > 0 && (
                        <p className="text-[11px] text-zinc-500 font-semibold">
                          Min. spend required: LKR {(reward.minOrderValueCents / 100).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl inline-block">
                        {reward.pointsRequired} pts
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                    {isSelected ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-xs text-emerald-800 font-extrabold flex items-center gap-1">
                          <span aria-hidden>✓</span> Selected for Cart
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReward(null)}
                          className="text-xs border-zinc-300 text-rose-600 hover:bg-rose-50 font-extrabold min-h-[40px] touch-manipulation cursor-pointer"
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
                        className="w-full font-extrabold bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white text-xs py-3 rounded-xl min-h-[44px] touch-manipulation shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        {minSpendMet
                          ? `Use ${reward.pointsRequired} Points`
                          : `Min order LKR ${(reward.minOrderValueCents / 100).toLocaleString()} required`}
                      </Button>
                    ) : (
                      <div className="w-full text-center py-3 px-4 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-bold min-h-[44px] flex items-center justify-center">
                        Need {pointsNeeded} more point{pointsNeeded > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-white border-zinc-300 text-zinc-900 hover:bg-zinc-100 text-xs font-extrabold px-5 py-2.5 rounded-xl min-h-[44px] touch-manipulation focus:ring-2 focus:ring-zinc-300 cursor-pointer"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
});

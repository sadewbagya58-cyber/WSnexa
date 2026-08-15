'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCustomerLoyaltyAccountsAction, getCustomerLedgerAction } from '@/server/actions/loyalty';
import { CustomerLoyaltyAccountRecord, LoyaltyLedgerRecord } from '@/lib/validation/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

export default function CustomerLoyaltyPage() {
  const [loading, setLoading] = useState(IS_LOYALTY_ENABLED);
  const [accounts, setAccounts] = useState<CustomerLoyaltyAccountRecord[]>([]);
  const [ledger, setLedger] = useState<LoyaltyLedgerRecord[]>([]);

  useEffect(() => {
    if (!IS_LOYALTY_ENABLED) return;

    let ignore = false;
    async function loadData() {
      const accRes = await getCustomerLoyaltyAccountsAction();
      const ledRes = await getCustomerLedgerAction();
      if (!ignore) {
        if (accRes.success && accRes.accounts) {
          setAccounts(accRes.accounts);
        }
        if (ledRes.success && ledRes.ledger) {
          setLedger(ledRes.ledger);
        }
        setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  // ── 1. Coming Soon State for V1 ──────────────────────────────────────────
  if (!IS_LOYALTY_ENABLED) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="border-b border-zinc-200 pb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
              🎁 Loyalty & Rewards
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
              Coming Soon
            </Badge>
          </div>
          <p className="text-xs font-semibold text-zinc-500 mt-1">
            Planned for a future WSNexa platform update.
          </p>
        </div>

        {/* Coming Soon Hero Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 sm:p-12 text-center space-y-6 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-3xl mx-auto shadow-2xs">
            🎁
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950">
              Rewards are on their way!
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 leading-relaxed">
              We are fine-tuning our automated loyalty and rewards system. In an upcoming update, you will be able to earn points automatically with every order, unlock venue perks, and redeem exclusive dining discounts.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left pt-2">
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
              <div className="text-lg">⭐</div>
              <h3 className="text-xs font-bold text-zinc-950">Earn Automatically</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Accumulate points seamlessly on completed table orders.</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
              <div className="text-lg">🏷️</div>
              <h3 className="text-xs font-bold text-zinc-950">Exclusive Discounts</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Redeem points for discounts and complimentary menu items.</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
              <div className="text-lg">🏆</div>
              <h3 className="text-xs font-bold text-zinc-950">Venue Tiers</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Unlock higher VIP tiers at your favorite restaurants and cafes.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/explore"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-950 px-6 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              🔍 Explore Venues
            </Link>
            <Link
              href="/customer/orders"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-extrabold text-zinc-900 hover:bg-zinc-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              🧾 View Your Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Full Active State (Preserved for Future Update) ───────────────────
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
          🎁 My Loyalty Balances & Rewards
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track venue-specific points earned, membership tiers, and available rewards.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-zinc-500">Loading Loyalty Portfolio...</div>
      ) : accounts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <h3 className="text-xl font-bold text-zinc-900">
            No loyalty activity yet.
          </h3>
          <p className="max-w-md mx-auto text-sm text-zinc-500 mt-2">
            Earn points automatically when completing orders at participating WSNexa restaurants and cafes!
          </p>
          <div className="mt-6">
            <Link href="/explore">
              <Button className="font-bold">Explore Venues</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Venue Balances Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <div className="pb-3 flex items-center justify-between border-b border-zinc-100">
                  <div>
                    <h3 className="text-lg font-bold">{acc.businessName}</h3>
                    <Badge variant="neutral" className="mt-1 text-xs">
                      {acc.tierName}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-600">
                      {acc.pointsBalance} pts
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium">Points Balance</span>
                  </div>
                </div>
                <div className="pt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-zinc-500 block">Lifetime Earned</span>
                    <strong className="text-zinc-900 font-bold">{acc.lifetimePointsEarned} pts</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Visits</span>
                    <strong className="text-zinc-900 font-bold">{acc.lifetimeVisitCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Lifetime Spend</span>
                    <strong className="text-zinc-900 font-bold">
                      LKR {(acc.lifetimeSpendCents / 100).toLocaleString()}
                    </strong>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-end">
                  <Link href="/explore">
                    <Button size="sm" variant="outline" className="text-xs font-bold text-amber-600 border-amber-500/30 hover:bg-amber-50">
                      Order & Use Rewards →
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Recent Points Activity Ledger */}
          <Card>
            <div className="pb-3 mb-4 border-b border-zinc-100">
              <h3 className="text-lg font-bold">Recent Points Activity</h3>
              <p className="text-xs text-zinc-500">Auditable transaction log of all earned, redeemed, or adjusted points.</p>
            </div>
            {ledger.length === 0 ? (
              <p className="text-sm text-zinc-500 italic py-4">No recent points transactions.</p>
            ) : (
              <div className="space-y-3">
                {ledger.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900">{l.reason}</div>
                      <div className="text-xs text-zinc-500">{new Date(l.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div
                      className={`font-black text-base ${
                        l.points > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {l.points > 0 ? `+${l.points}` : l.points} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

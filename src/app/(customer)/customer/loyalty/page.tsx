'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCustomerLoyaltyAccountsAction, getCustomerLedgerAction } from '@/server/actions/loyalty';
import { CustomerLoyaltyAccountRecord, LoyaltyLedgerRecord } from '@/lib/validation/loyalty';

export default function CustomerLoyaltyPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<CustomerLoyaltyAccountRecord[]>([]);
  const [ledger, setLedger] = useState<LoyaltyLedgerRecord[]>([]);

  useEffect(() => {
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
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
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
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
                <div className="pb-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-lg font-bold">{acc.businessName}</h3>
                    <Badge variant="neutral" className="mt-1 text-xs">
                      {acc.tierName}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {acc.pointsBalance} pts
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium">Points Balance</span>
                  </div>
                </div>
                <div className="pt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-zinc-500 block">Lifetime Earned</span>
                    <strong className="text-zinc-900 dark:text-white font-bold">{acc.lifetimePointsEarned} pts</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Visits</span>
                    <strong className="text-zinc-900 dark:text-white font-bold">{acc.lifetimeVisitCount}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Lifetime Spend</span>
                    <strong className="text-zinc-900 dark:text-white font-bold">
                      LKR {(acc.lifetimeSpendCents / 100).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Recent Points Activity Ledger */}
          <Card>
            <div className="pb-3 mb-4 border-b border-zinc-100 dark:border-zinc-800">
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
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-white">{l.reason}</div>
                      <div className="text-xs text-zinc-500">{new Date(l.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div
                      className={`font-black text-base ${
                        l.points > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
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

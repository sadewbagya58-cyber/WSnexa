'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBusinessLoyaltyCustomersAction, adjustCustomerPointsAction } from '@/server/actions/loyalty';

interface CustomerRosterItem {
  id: string;
  customerUserId: string;
  customerName: string;
  avatarUrl: string | null;
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  lifetimeVisitCount: number;
  lifetimeSpendCents: number;
  tierName: string;
  updatedAt: string;
}

export default function LoyaltyCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerRosterItem[]>([]);
  const [selectedCust, setSelectedCust] = useState<CustomerRosterItem | null>(null);
  const [pointsDelta, setPointsDelta] = useState(50);
  const [reason, setReason] = useState('Service recovery');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchCustomers() {
      const res = await getBusinessLoyaltyCustomersAction();
      if (!ignore) {
        if (res.success && res.customers) {
          setCustomers(res.customers);
        }
        setLoading(false);
      }
    }
    fetchCustomers();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleAdjustPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCust) return;
    setSaving(true);
    setMsg(null);

    const res = await adjustCustomerPointsAction({
      customerUserId: selectedCust.customerUserId,
      pointsDelta: Number(pointsDelta),
      reason,
    });

    if (res.success) {
      setMsg({ type: 'success', text: `Successfully adjusted points for ${selectedCust.customerName}.` });
      setSelectedCust(null);
      const refreshed = await getBusinessLoyaltyCustomersAction();
      if (refreshed.success && refreshed.customers) {
        setCustomers(refreshed.customers);
      }
    } else {
      setMsg({ type: 'error', text: res.message || 'Failed to adjust points.' });
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
            👥 Loyalty Customers
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Inspect points balances, lifetime spend, visits, and manually adjust points.
          </p>
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

      {/* Roster Table */}
      {loading ? (
        <div className="p-8 text-center text-zinc-500">Loading Loyalty Customers...</div>
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
            No loyalty customers yet.
          </h3>
          <p className="max-w-md mx-auto text-sm text-zinc-500 mt-2">
            Customers will appear here after making eligible completed orders at your venue.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Points Balance</th>
                  <th className="p-4">Lifetime Earned</th>
                  <th className="p-4">Visits</th>
                  <th className="p-4">Spend</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="p-4 font-semibold text-zinc-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{c.customerName}</span>
                        <Badge variant="neutral" className="text-[10px] py-0 px-2">
                          {c.tierName}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-amber-600 dark:text-amber-400">
                      {c.pointsBalance} pts
                    </td>
                    <td className="p-4 text-zinc-500">{c.lifetimePointsEarned} pts</td>
                    <td className="p-4 text-zinc-500">{c.lifetimeVisitCount}</td>
                    <td className="p-4 text-zinc-500">LKR {(c.lifetimeSpendCents / 100).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCust(c)}
                        className="font-bold text-xs"
                      >
                        Adjust Points
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Adjust Points Modal */}
      {selectedCust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white dark:bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold">Adjust Points: {selectedCust.customerName}</h2>
              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="text-zinc-500 hover:text-zinc-900 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustPoints} className="space-y-4">
              <div className="space-y-2">
                <label className="font-semibold text-sm block">Points Delta (+ or -)</label>
                <input
                  type="number"
                  required
                  value={pointsDelta}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPointsDelta(Number(e.target.value))}
                  placeholder="e.g. +50 or -20"
                  className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm font-bold"
                />
                <p className="text-xs text-zinc-500">Current Balance: {selectedCust.pointsBalance} pts</p>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-sm block">Reason (Mandatory Audit Log)</label>
                <input
                  required
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
                  placeholder="e.g. Service recovery, Birthday bonus"
                  className="h-10 px-3 rounded-md border border-zinc-200 w-full text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setSelectedCust(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="font-bold">
                  {saving ? 'Adjusting...' : 'Save Adjustment'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

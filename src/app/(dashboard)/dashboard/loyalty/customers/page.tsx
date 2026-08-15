'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBusinessLoyaltyCustomersAction, adjustCustomerPointsAction } from '@/server/actions/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

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
  const [loading, setLoading] = useState(IS_LOYALTY_ENABLED);
  const [customers, setCustomers] = useState<CustomerRosterItem[]>([]);
  const [selectedCust, setSelectedCust] = useState<CustomerRosterItem | null>(null);
  const [pointsDelta, setPointsDelta] = useState(50);
  const [reason, setReason] = useState('Service recovery');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!IS_LOYALTY_ENABLED) return;

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
    if (!IS_LOYALTY_ENABLED || !selectedCust) return;
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
                👥 Patron Loyalty Roster
              </h1>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Customer points tracking and membership balances will be unlocked in an upcoming release.
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
            👥
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950">
              Patron Loyalty Roster Coming Soon
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-zinc-500 leading-relaxed">
              When enabled, your venue team can inspect customer visit histories, check lifetime spending, and perform manual loyalty point adjustments for service recovery.
            </p>
          </div>

          <div className="pt-2">
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

  // ── 2. Full Active Roster (Preserved for Future Update) ───────────────────
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

      {loading ? (
        <div className="p-8 text-center text-zinc-500">Loading Loyalty Customers...</div>
      ) : customers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-xl font-bold">No loyalty patrons yet.</h3>
          <p className="max-w-md mx-auto text-sm text-zinc-500 mt-2">
            Patrons will automatically appear here once they complete their first order while enrolled in your loyalty program.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold text-xs">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Tier</th>
                  <th className="p-4 text-right">Points Balance</th>
                  <th className="p-4 text-right">Lifetime Earned</th>
                  <th className="p-4 text-right">Visits</th>
                  <th className="p-4 text-right">Lifetime Spend</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50">
                    <td className="p-4 font-bold text-zinc-900">{c.customerName}</td>
                    <td className="p-4">
                      <Badge variant="neutral">{c.tierName}</Badge>
                    </td>
                    <td className="p-4 text-right font-black text-amber-600">{c.pointsBalance} pts</td>
                    <td className="p-4 text-right font-semibold text-zinc-600">{c.lifetimePointsEarned} pts</td>
                    <td className="p-4 text-right font-semibold text-zinc-600">{c.lifetimeVisitCount}</td>
                    <td className="p-4 text-right font-mono font-bold text-zinc-900">
                      LKR {(c.lifetimeSpendCents / 100).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCust(c)}
                        className="text-xs font-bold"
                      >
                        Adjust Points
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {selectedCust && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold">Adjust Points Balance</h3>
                <p className="text-xs text-zinc-500">Customer: {selectedCust.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCust(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustPoints} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700">Current Balance</label>
                <div className="text-xl font-black text-amber-600 mt-1">{selectedCust.pointsBalance} pts</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700">Points Delta (+ or -)</label>
                <input
                  type="number"
                  required
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                />
                <p className="text-[11px] text-zinc-400 mt-1">Use negative values to deduct points (e.g. -50).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700">Reason / Note *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Service recovery, promotional gift..."
                  className="mt-1 w-full rounded-xl border border-zinc-200 p-2.5 text-sm font-semibold"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedCust(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="font-bold">
                  {saving ? 'Adjusting...' : 'Confirm Adjustment'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

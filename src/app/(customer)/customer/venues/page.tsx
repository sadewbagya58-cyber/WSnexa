import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerOrderService } from '@/server/services/customer-order.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { formatCurrency } from '@/features/cart/cart-calculations';

export const metadata: Metadata = {
  title: 'Venues Visited | WSNexa Customer',
  description: 'View hospitality venues and restaurants you have visited',
};

export default async function CustomerVenuesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [{ data: memberships }, customerData, venues] = await Promise.all([
    supabase
      .from('business_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .limit(1),
    AccountService.getCustomerProfile(user.id),
    CustomerOrderService.getCustomerVenues(user.id),
  ]);

  const hasBusinessAccess = !!(memberships && memberships.length > 0);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Venues Visited</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Restaurants, hotels, and cafes where you have placed orders
          </p>
        </div>

        {venues.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((v) => (
              <div
                key={`${v.businessId}:${v.branchId}`}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">
                    🏬
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm">{v.businessName}</h3>
                    <p className="text-xs text-zinc-400">
                      {v.branchName} ({v.branchCode})
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Total Visits</span>
                    <span className="font-extrabold text-white">{v.visitCount} visits</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Total Spend</span>
                    <span className="font-extrabold text-emerald-400 font-mono">
                      {formatCurrency(v.totalSpendCents, v.currency)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-mono pt-1">
                  Last visited: {new Date(v.lastVisitAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs space-y-2">
            <div className="text-3xl mb-2">🏬</div>
            <div className="font-bold text-zinc-300">No venues recorded yet.</div>
            <div className="text-[11px] text-zinc-500">
              Scan a table QR code and save your order to start tracking your visited hospitality venues!
            </div>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}

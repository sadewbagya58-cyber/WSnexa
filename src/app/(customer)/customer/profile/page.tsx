import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';

export const metadata: Metadata = {
  title: 'Customer Profile | WSNexa',
  description: 'Manage personal details and account settings',
};

export default async function CustomerProfilePage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) redirect('/login');

  const customerData = await AccountService.getCustomerProfile(context.user.id);
  const hasBusinessAccess = !!(context.membership && context.membership.status === 'active');

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-black text-white uppercase tracking-wider">Customer Profile</h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
            <div className="w-14 h-14 rounded-full bg-amber-500 text-black font-black text-xl flex items-center justify-center">
              {customerData.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{customerData.displayName}</h2>
              <p className="text-xs text-zinc-400 font-mono">{customerData.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="text-zinc-500 uppercase text-[10px] block font-sans font-bold">Account Identity</span>
              <span className="text-zinc-200 mt-1 block truncate">{customerData.userId}</span>
            </div>
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="text-zinc-500 uppercase text-[10px] block font-sans font-bold">Member Since</span>
              <span className="text-zinc-200 mt-1 block">
                {new Date(customerData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}

import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { sendStockTransferAction, receiveStockTransferAction } from '@/server/actions/inventory';

export const metadata: Metadata = {
  title: 'Stock Transfers | WSNexa Inventory',
  description: 'Manage internal and cross-branch inventory transfers and receipts',
};

export default async function StockTransfersPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/transfers');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const activeBranchId = context.activeBranch.id;
  const transfers = await InventoryService.getStockTransfers(
    context.business.id,
    activeBranchId
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description={`Internal location transfers and cross-branch dispatches for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Transfers' },
        ]}
        helpSlug="managing-stock-transfers"
        primaryAction={{
          label: '+ New Transfer',
          href: '/dashboard/inventory/transfers/new',
        }}
      />

      {transfers.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center shadow-xs">
          <span className="text-3xl">🚚</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">No stock transfers found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Transfer stock between storage areas (e.g. Main Store → Main Kitchen) or across authorized branches.
          </p>
          <div className="mt-4">
            <Link href="/dashboard/inventory/transfers/new">
              <Button size="sm" className="font-bold text-xs">
                Create Stock Transfer
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-950">
                      {t.transferNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-900">{t.sourceBranchName}</div>
                      <div className="text-[11px] text-zinc-400">{t.sourceLocationName}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-900">{t.destinationBranchName}</div>
                      <div className="text-[11px] text-zinc-400">{t.destinationLocationName}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          t.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'in_transit'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : t.status === 'sent'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}
                      >
                        {t.status === 'in_transit' ? 'In Transit 🚚' : t.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {t.status === 'draft' ? (
                        <form
                          action={async () => {
                            'use server';
                            await sendStockTransferAction(t.id);
                          }}
                          className="inline-block"
                        >
                          <Button size="sm" type="submit" className="text-xs font-bold bg-zinc-950 text-white h-7">
                            Dispatch →
                          </Button>
                        </form>
                      ) : t.status === 'in_transit' && t.destinationBranchId === activeBranchId ? (
                        <form
                          action={async () => {
                            'use server';
                            await receiveStockTransferAction({ transferId: t.id });
                          }}
                          className="inline-block"
                        >
                          <Button size="sm" type="submit" className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7">
                            Receive Stock ✓
                          </Button>
                        </form>
                      ) : (
                        <span className="text-zinc-400 text-[11px] italic">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

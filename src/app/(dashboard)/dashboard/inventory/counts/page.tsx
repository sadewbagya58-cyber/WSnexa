import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Stock Counts | WSNexa Inventory',
  description: 'Conduct physical inventory audits and reconcile stock variances',
};

export default async function StockCountsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/counts');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let hasCostPermission = false;
  try {
    const authContext = await resolveAuthorizationContext();
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view' });
  } catch {
    hasCostPermission = false;
  }

  const counts = await InventoryService.getStockCounts(
    context.business.id,
    context.activeBranch.id,
    hasCostPermission
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Physical Stock Counts"
        description={`Audit count sheets and variance reconciliations for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Counts' },
        ]}
        helpSlug="performing-physical-stock-counts"
        primaryAction={{
          label: '+ Start New Count',
          href: '/dashboard/inventory/counts/new',
        }}
      />

      {counts.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-2xl p-10 text-center shadow-xs">
          <span className="text-3xl">📋</span>
          <h3 className="text-sm font-bold text-zinc-900 mt-2">No physical stock counts performed yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Start a stock count audit sheet to compare physical counts on shelves against expected system stock.
          </p>
          <div className="mt-4">
            <Link href="/dashboard/inventory/counts/new">
              <Button size="sm" className="font-bold text-xs">
                Start Physical Count
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
                  <th className="py-3 px-4">Count Sheet</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Category Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Items Counted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {counts.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/dashboard/inventory/counts/${c.id}`}
                        className="font-bold text-zinc-950 hover:underline block"
                      >
                        {c.title}
                      </Link>
                      <span className="text-[11px] font-mono text-zinc-400">{c.countNumber}</span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700 font-medium">{c.locationName}</td>
                    <td className="py-3.5 px-4 text-zinc-500">{c.categoryName}</td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          c.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-zinc-800">{c.totalItemsCounted} items</td>

                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/dashboard/inventory/counts/${c.id}`}>
                        <Button size="sm" variant="outline" className="text-xs font-bold h-7">
                          {c.status === 'counting' ? 'Continue Count →' : 'View Audit →'}
                        </Button>
                      </Link>
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

import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PurchasingService } from '@/server/services/purchasing.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';
import { approvePurchaseOrderAction } from '@/server/actions/purchasing';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Purchase Orders & Deliveries | WSNexa Inventory',
  description: 'Manage purchase orders, approval workflows, vendor replenishment, and track goods receiving',
};

export default async function PurchasingPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const purchaseOrders = await PurchasingService.getPurchaseOrders();
  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description={`Track vendor orders, procurement approvals, and incoming shipments for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Purchasing' },
        ]}
        helpSlug="creating-purchase-orders"
        primaryAction={{
          label: '+ New Purchase Order',
          href: '/dashboard/inventory/purchasing/new',
        }}
        secondaryAction={{
          label: '📥 Receive Deliveries',
          href: '/dashboard/inventory/receiving',
        }}
      />

      {purchaseOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3 shadow-xs">
          <div className="text-4xl">📦</div>
          <h3 className="text-base font-bold text-zinc-900">No Purchase Orders Created</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Create a purchase order to request goods from suppliers, track delivery dates, and streamline stock receiving.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/inventory/purchasing/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-xs"
            >
              + Create First Purchase Order
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase text-zinc-500">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lines</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-950">
                      {po.poNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-900">{po.supplierName}</div>
                      <div className="text-[11px] text-zinc-400">Target: {po.destinationLocationName}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          po.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : po.status === 'partially_received'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : po.status === 'approved'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}
                      >
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-zinc-700">
                      {po.items.length} items
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-950">
                      {formatCurrencyMinor(po.totalCents, po.currency || currency)}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {po.status === 'draft' ? (
                        <form
                          action={async () => {
                            'use server';
                            await approvePurchaseOrderAction(po.id);
                          }}
                          className="inline-block"
                        >
                          <Button size="sm" type="submit" className="text-xs font-bold bg-zinc-950 text-white h-7">
                            Approve ✓
                          </Button>
                        </form>
                      ) : po.status === 'approved' || po.status === 'partially_received' ? (
                        <Link
                          href="/dashboard/inventory/receiving"
                          className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          Receive Stock 📥
                        </Link>
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

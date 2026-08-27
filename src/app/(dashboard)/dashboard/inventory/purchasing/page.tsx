import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PurchasingService } from '@/server/services/purchasing.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { formatCurrencyMinor } from '@/lib/utils/currency';
import { PurchaseOrderActions } from '@/components/inventory/purchase-order-actions';

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

  let canManagePO = false;
  let canReceive = false;
  try {
    const authContext = await resolveAuthorizationContext();
    const branchResource = {
      resourceType: 'branch' as const,
      resourceId: context.activeBranch.id,
      businessId: context.business.id,
      branchId: context.activeBranch.id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    };
    const hasPOManage =
      (await can({ context: authContext, permission: 'purchasing.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'purchasing.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.purchasing.manage', resource: branchResource }));
    const hasReceive =
      (await can({ context: authContext, permission: 'purchasing.receive', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.receiving.manage', resource: branchResource }));
    const hasManage = await can({ context: authContext, permission: 'inventory.manage', resource: branchResource });

    canManagePO = hasPOManage || hasManage || authContext.isBusinessOwner;
    canReceive = hasReceive || hasManage || authContext.isBusinessOwner;
  } catch {
    canManagePO = false;
    canReceive = false;
  }

  const purchaseOrders = await PurchasingService.getPurchaseOrders();
  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchasing & Suppliers"
        description={`Track vendor orders, procurement approvals, and incoming shipments for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Purchasing & Suppliers' },
        ]}
        helpSlug="creating-purchase-orders"
        primaryAction={
          canManagePO ? (
            <Link
              href="/dashboard/inventory/purchasing/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + New Purchase Order
            </Link>
          ) : undefined
        }
        secondaryActions={
          canReceive ? (
            <Link
              href="/dashboard/inventory/receiving"
              className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
            >
              📥 Receive Deliveries
            </Link>
          ) : undefined
        }
      />

      {purchaseOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3 shadow-xs">
          <div className="text-4xl">📦</div>
          <h3 className="text-base font-bold text-zinc-900">No Purchase Orders Created</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Create a purchase order to request goods from suppliers, track delivery dates, and streamline stock receiving.
          </p>
          {canManagePO && (
            <div className="pt-2">
              <Link
                href="/dashboard/inventory/purchasing/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-xs"
              >
                + Create First Purchase Order
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile PO Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {purchaseOrders.map((po) => (
              <div
                key={po.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/inventory/purchasing/${po.id}`}
                      className="font-mono font-bold text-zinc-950 hover:underline text-sm block truncate"
                    >
                      {po.poNumber}
                    </Link>
                    <div className="font-semibold text-zinc-800 text-xs mt-0.5 truncate">
                      {po.supplierName}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase whitespace-nowrap ${
                        po.status === 'received'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : po.status === 'partially_received'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : po.status === 'approved'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : po.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}
                    >
                      {po.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-zinc-500 text-[11px] font-medium">Order Total:</span>
                    <span className="font-mono font-bold text-zinc-950 text-sm">
                      {formatCurrencyMinor(po.totalCents, po.currency || currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-600 border-t border-zinc-200/50 pt-1.5">
                    <span>Delivery Location:</span>
                    <span className="font-medium text-zinc-900">📍 {po.destinationLocationName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/50 pt-1.5 text-[11px]">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Line Items</span>
                      <span className="font-semibold text-zinc-700">{po.items.length} items</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Created Date</span>
                      <span className="text-zinc-700">{new Date(po.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* PO Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/dashboard/inventory/purchasing/${po.id}`}
                    className="text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition-colors text-center min-h-[38px] flex items-center justify-center flex-1"
                  >
                    View Details →
                  </Link>
                  <div className="flex-1 flex justify-end">
                    <PurchaseOrderActions
                      poId={po.id}
                      poNumber={po.poNumber}
                      status={po.status}
                      variant="row"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
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
                        <Link
                          href={`/dashboard/inventory/purchasing/${po.id}`}
                          className="hover:underline hover:text-zinc-700"
                        >
                          {po.poNumber}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-900">{po.supplierName}</div>
                        <div className="text-[11px] text-zinc-400">Target: {po.destinationLocationName}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase whitespace-nowrap ${
                            po.status === 'received'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : po.status === 'partially_received'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : po.status === 'approved'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : po.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
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
                        <PurchaseOrderActions
                          poId={po.id}
                          poNumber={po.poNumber}
                          status={po.status}
                          variant="row"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

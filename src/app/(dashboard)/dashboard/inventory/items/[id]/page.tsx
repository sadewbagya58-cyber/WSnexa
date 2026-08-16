import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PermissionService } from '@/server/services/permission.service';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryMovementTimeline } from '@/components/inventory/inventory-movement-timeline';

interface ItemDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Item Details | WSNexa Inventory',
  description: 'Detailed stock breakdown, location balances, and movement ledger',
};

export default async function InventoryItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = await params;
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/items');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const hasCostPermission = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.costs.view'
  );

  const [item, movements] = await Promise.all([
    InventoryService.getInventoryItemById(context.business.id, context.activeBranch.id, id, hasCostPermission),
    InventoryService.getMovements(context.business.id, context.activeBranch.id, {
      itemId: id,
      hasCostPermission,
      limit: 100,
    }),
  ]);

  if (!item) {
    notFound();
  }

  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={item.name}
        description={`Category: ${item.categoryName || 'General'} • Base Unit: ${item.baseUnit}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Items', href: '/dashboard/inventory/items' },
          { label: item.name },
        ]}
        helpSlug="understanding-stock-levels"
      />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Available</span>
          <div className="text-2xl font-black text-zinc-950 mt-0.5">
            {item.currentStockQuantity} <span className="text-xs font-normal text-zinc-500">{item.baseUnit}</span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Stock Status</span>
          <div className="mt-1">
            {item.stockStatus === 'out_of_stock' ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Out of Stock
              </span>
            ) : item.stockStatus === 'low_stock' ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Low Stock
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Healthy
              </span>
            )}
          </div>
        </div>

        {hasCostPermission && (
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Unit Cost</span>
            <div className="text-sm font-black text-zinc-900 mt-1">
              {formatCurrency(item.costPerUnitCents, item.currency)}
              <span className="text-[10px] text-zinc-400">/{item.baseUnit}</span>
            </div>
          </div>
        )}

        {hasCostPermission && (
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Stock Value</span>
            <div className="text-sm font-black text-zinc-900 mt-1">
              {formatCurrency(item.totalStockValueCents || 0, item.currency)}
            </div>
          </div>
        )}
      </div>

      {/* Storage Locations Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
          Storage Locations in {context.activeBranch.name}
        </h3>

        {item.locationBalances && item.locationBalances.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {item.locationBalances.map((loc, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">{loc.locationName}</span>
                <span className="text-xs font-black text-zinc-950">
                  {loc.quantity} {item.baseUnit}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">No storage location balances recorded yet.</p>
        )}
      </div>

      {/* Movement Timeline */}
      <InventoryMovementTimeline
        movements={movements}
        baseUnit={item.baseUnit}
        hasCostPermission={hasCostPermission}
      />
    </div>
  );
}

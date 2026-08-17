import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PermissionService } from '@/server/services/permission.service';
import { InventoryService } from '@/server/services/inventory.service';
import { PurchasingService } from '@/server/services/purchasing.service';
import { InventoryMovementTimeline } from '@/components/inventory/inventory-movement-timeline';
import { ItemBatchesCard } from '@/components/inventory/item-batches-card';
import { ItemSupplierPricingCard } from '@/components/inventory/item-supplier-pricing-card';
import { ItemPriceHistoryCard } from '@/components/inventory/item-price-history-card';
import { ItemForecastCard } from '@/components/inventory/item-forecast-card';

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

  const [item, movements, batches, supplierComparison, priceHistoryPayload, forecast] = await Promise.all([
    InventoryService.getInventoryItemById(context.business.id, context.activeBranch.id, id, hasCostPermission),
    InventoryService.getMovements(context.business.id, context.activeBranch.id, {
      itemId: id,
      hasCostPermission,
      limit: 100,
    }),
    InventoryService.getBatchesByItem(context.business.id, context.activeBranch.id, id, {
      hasCostPermission,
      includeDepleted: true,
    }),
    PurchasingService.getSupplierPriceComparison(context.business.id, id, {
      hasCostPermission,
    }),
    PurchasingService.getItemPriceHistory(context.business.id, id, {
      hasCostPermission,
    }),
    InventoryService.getItemReorderForecast(context.business.id, context.activeBranch.id, id, {
      hasCostPermission,
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

  const lastMovement = movements[0];
  const lastUpdated = lastMovement
    ? new Date(lastMovement.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  const currentStock = item.currentStockQuantity !== undefined ? item.currentStockQuantity : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={item.name}
        description={`Category: ${item.categoryName || 'General'} • Base Unit: ${item.baseUnit}${item.sku ? ` • SKU: ${item.sku}` : ''}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Items', href: '/dashboard/inventory/items' },
          { label: item.name },
        ]}
        helpSlug="understanding-stock-levels"
      />

      {/* Hero Stock Summary Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Current Stock</span>
              {item.stockStatus === 'out_of_stock' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Out of Stock
                </span>
              ) : item.stockStatus === 'low_stock' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Low Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  In Stock
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-4xl font-black text-zinc-950 mt-1 flex items-baseline gap-1.5">
              <span>{currentStock.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              <span className="text-base font-bold text-zinc-500">{item.baseUnit}</span>
            </div>

            {lastUpdated && (
              <p className="text-[11px] text-zinc-400 mt-1">
                Last movement: <span className="text-zinc-600 font-medium">{lastUpdated}</span>
              </p>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 sm:pt-0">
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 min-w-[120px]">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Min Threshold</span>
              <div className="text-sm font-black text-zinc-900 mt-0.5">
                {item.minStockLevel > 0 ? `${item.minStockLevel} ${item.baseUnit}` : 'None'}
              </div>
            </div>

            {hasCostPermission && (
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 min-w-[120px]">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Unit Cost</span>
                <div className="text-sm font-black text-zinc-900 mt-0.5">
                  {formatCurrency(item.costPerUnitCents, item.currency)}
                </div>
              </div>
            )}

            {hasCostPermission && (
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 min-w-[120px]">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Stock Value</span>
                <div className="text-sm font-black text-zinc-950 mt-0.5">
                  {formatCurrency(item.totalStockValueCents || 0, item.currency)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Storage Locations Breakdown */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
              Storage Locations in {context.activeBranch.name}
            </h3>
            <span className="text-[11px] text-zinc-400">
              Branch Total: <strong className="text-zinc-900 font-bold">{currentStock} {item.baseUnit}</strong>
            </span>
          </div>

          {item.locationBalances && item.locationBalances.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {item.locationBalances.map((loc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between hover:bg-zinc-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span className="text-xs font-bold text-zinc-900">{loc.locationName}</span>
                  </div>
                  <span className="text-xs font-black text-zinc-950 bg-white px-2 py-1 rounded-lg border border-zinc-200/60 shadow-2xs">
                    {loc.quantity} {item.baseUnit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-center text-xs text-zinc-500">
              No stock balances recorded in any storage location yet.
            </div>
          )}
        </div>
      </div>

      {/* Demand Forecasting & Smart Reorder */}
      <ItemForecastCard
        forecast={forecast}
        currency={item.currency || context.business.defaultCurrency || 'USD'}
        hasCostPermission={hasCostPermission}
      />

      {/* Batches & Lots Breakdown */}
      <ItemBatchesCard
        batches={batches}
        baseUnit={item.baseUnit}
        currency={item.currency || context.business.defaultCurrency || 'USD'}
        hasCostPermission={hasCostPermission}
      />

      {/* Supplier Price Comparison */}
      <ItemSupplierPricingCard
        comparison={supplierComparison}
        hasCostPermission={hasCostPermission}
      />

      {/* Purchase Price History & Cost Trend */}
      <ItemPriceHistoryCard
        payload={priceHistoryPayload}
        hasCostPermission={hasCostPermission}
      />

      {/* Movement Ledger Timeline */}
      <InventoryMovementTimeline
        movements={movements}
        baseUnit={item.baseUnit}
        hasCostPermission={hasCostPermission}
      />
    </div>
  );
}

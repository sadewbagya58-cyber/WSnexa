import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryKpiSummary } from '@/components/inventory/inventory-kpi-summary';
import { InventoryHealthCard } from '@/components/inventory/inventory-health-card';
import { InventoryNeedsAttention } from '@/components/inventory/inventory-needs-attention';
import { InventoryExpiryAlerts } from '@/components/inventory/inventory-expiry-alerts';
import { InventoryReorderSuggestions } from '@/components/inventory/inventory-reorder-suggestions';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Inventory Hub | WSNexa Hospitality',
  description: 'Multi-branch hospitality inventory, storage locations, stock counts, and waste tracking',
};

export default async function InventoryHubPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let hasCostPermission = false;
  let canManageItems = false;
  let canManageCounts = false;
  let canManagePurchasing = false;

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
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view', resource: branchResource });
    const hasItemsManage =
      (await can({ context: authContext, permission: 'inventory.items.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.items.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    const hasCountsManage =
      (await can({ context: authContext, permission: 'inventory.counts.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    const hasPOManage =
      (await can({ context: authContext, permission: 'inventory.purchasing.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'purchasing.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'purchasing.manage', resource: branchResource }));

    canManageItems = hasItemsManage || authContext.isBusinessOwner;
    canManageCounts = hasCountsManage || authContext.isBusinessOwner;
    canManagePurchasing = hasPOManage || authContext.isBusinessOwner;
  } catch {
    hasCostPermission = false;
    canManageItems = false;
    canManageCounts = false;
    canManagePurchasing = false;
  }

  const [overview, expiringSummary, reorderOverview] = await Promise.all([
    InventoryService.getInventoryOverview(
      context.business.id,
      context.activeBranch.id,
      context.business.defaultCurrency || 'USD',
      hasCostPermission
    ),
    InventoryService.getExpiringBatches(
      context.business.id,
      context.activeBranch.id,
      { hasCostPermission, maxDaysAhead: 14 }
    ),
    InventoryService.getReorderSuggestions(
      context.business.id,
      context.activeBranch.id,
      { hasCostPermission }
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Hub"
        description={`Operational ingredient balances and stock health for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub' },
        ]}
        helpSlug="inventory-quick-start"
        primaryAction={
          canManageItems ? (
            <Link
              href="/dashboard/inventory/items/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + Add Ingredient
            </Link>
          ) : undefined
        }
        secondaryActions={
          canManageCounts ? (
            <Link
              href="/dashboard/inventory/counts/new"
              className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
            >
              📋 Physical Count
            </Link>
          ) : undefined
        }
      />

      {/* KPI Cards Summary */}
      <InventoryKpiSummary overview={overview} />

      {/* Main Grid: Health Card & Needs Attention Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InventoryHealthCard overview={overview} />
        <InventoryNeedsAttention items={overview.needsAttention} />
      </div>

      {/* Near-Expiry & Perishable Alerts */}
      <InventoryExpiryAlerts
        summary={expiringSummary}
        currency={context.business.defaultCurrency || 'USD'}
        hasCostPermission={hasCostPermission}
      />

      {/* Smart Reorder & Stockout Forecast */}
      <InventoryReorderSuggestions
        overview={reorderOverview}
        hasCostPermission={hasCostPermission}
        canManagePO={canManagePurchasing}
      />

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <Link
          href="/dashboard/inventory/items"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🥦</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Stock Items</span>
            <span className="text-[11px] text-zinc-400">View & adjust balances</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/recipes"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🍽️</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Recipes & BOM</span>
            <span className="text-[11px] text-zinc-400">Food cost % & portioning</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/purchasing"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">📦</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Purchase Orders</span>
            <span className="text-[11px] text-zinc-400">Vendor orders & approvals</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/receiving"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">📥</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Receive Goods</span>
            <span className="text-[11px] text-zinc-400">Accept vendor deliveries</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/suppliers"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🏢</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Suppliers</span>
            <span className="text-[11px] text-zinc-400">Vendor directory & terms</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/production"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🍲</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Prep Production</span>
            <span className="text-[11px] text-zinc-400">Produce sub-recipe batches</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/counts"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">📋</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Stock Counts</span>
            <span className="text-[11px] text-zinc-400">Physical count & audit</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/settings"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">⚙️</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Settings</span>
            <span className="text-[11px] text-zinc-400">Deduction timing & cost</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

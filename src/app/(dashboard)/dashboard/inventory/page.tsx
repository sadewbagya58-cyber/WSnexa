import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PermissionService } from '@/server/services/permission.service';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryKpiSummary } from '@/components/inventory/inventory-kpi-summary';
import { InventoryHealthCard } from '@/components/inventory/inventory-health-card';
import { InventoryNeedsAttention } from '@/components/inventory/inventory-needs-attention';
import { InventoryExpiryAlerts } from '@/components/inventory/inventory-expiry-alerts';
import { InventoryReorderSuggestions } from '@/components/inventory/inventory-reorder-suggestions';

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

  const hasCostPermission = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.costs.view'
  );

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
        primaryAction={{
          label: '+ Add Ingredient',
          href: '/dashboard/inventory/items/new',
        }}
        secondaryAction={{
          label: '📋 Physical Count',
          href: '/dashboard/inventory/counts/new',
        }}
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

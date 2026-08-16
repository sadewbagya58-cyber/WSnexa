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

  const overview = await InventoryService.getInventoryOverview(
    context.business.id,
    context.activeBranch.id,
    context.business.defaultCurrency || 'USD',
    hasCostPermission
  );

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
          href="/dashboard/inventory/counts"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">📋</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Stock Counts</span>
            <span className="text-[11px] text-zinc-400">Audit & reconcile sheets</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/waste"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🗑️</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Waste Log</span>
            <span className="text-[11px] text-zinc-400">Track kitchen spoilage</span>
          </div>
        </Link>

        <Link
          href="/dashboard/inventory/transfers"
          className="bg-white p-4 rounded-2xl border border-zinc-200 hover:border-zinc-950 transition-all shadow-xs flex flex-col justify-between"
        >
          <span className="text-xl">🚚</span>
          <div className="mt-3">
            <span className="text-xs font-bold text-zinc-950 block">Stock Transfers</span>
            <span className="text-[11px] text-zinc-400">Internal & cross-branch</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

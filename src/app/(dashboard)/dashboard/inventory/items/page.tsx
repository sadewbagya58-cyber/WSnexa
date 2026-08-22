import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryItemsTable } from '@/components/inventory/inventory-items-table';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Stock Items | WSNexa Inventory',
  description: 'Manage ingredients, raw items, and real-time storage balances',
};

export default async function InventoryItemsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/items');
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

  const [items, categories, locations] = await Promise.all([
    InventoryService.getInventoryItems(context.business.id, context.activeBranch.id, { hasCostPermission }),
    InventoryService.getCategories(context.business.id),
    InventoryService.getBranchLocations(context.business.id, context.activeBranch.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Items"
        description={`Tracked ingredients and inventory balances for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Items' },
        ]}
        helpSlug="adding-inventory-items-and-units"
        primaryAction={
          <Link
            href="/dashboard/inventory/items/new"
            className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
          >
            + Add Ingredient
          </Link>
        }
        secondaryActions={
          <Link
            href="/dashboard/inventory/locations"
            className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            📦 Manage Locations
          </Link>
        }
      />

      <InventoryItemsTable
        items={items}
        categories={categories}
        locations={locations}
        hasCostPermission={hasCostPermission}
      />
    </div>
  );
}

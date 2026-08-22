import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
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
        primaryAction={{
          label: '+ Add Ingredient',
          href: '/dashboard/inventory/items/new',
        }}
        secondaryAction={{
          label: '📦 Manage Locations',
          href: '/dashboard/inventory/locations',
        }}
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

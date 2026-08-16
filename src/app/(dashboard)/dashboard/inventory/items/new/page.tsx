import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryItemForm } from '@/components/inventory/inventory-item-form';

export const metadata: Metadata = {
  title: 'Add Inventory Item | WSNexa Inventory',
  description: 'Add a new raw ingredient or tracked stock item',
};

export default async function NewInventoryItemPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/items/new');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const [categories, locations] = await Promise.all([
    InventoryService.getCategories(context.business.id),
    InventoryService.getBranchLocations(context.business.id, context.activeBranch.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Inventory Item"
        description="Define a new ingredient, unit, and optional opening stock"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Items', href: '/dashboard/inventory/items' },
          { label: 'New Item' },
        ]}
        helpSlug="adding-inventory-items-and-units"
      />

      <InventoryItemForm
        categories={categories}
        locations={locations}
        defaultCurrency={context.business.defaultCurrency || 'USD'}
      />
    </div>
  );
}

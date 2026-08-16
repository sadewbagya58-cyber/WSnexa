import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { StockCountWizard } from '@/components/inventory/stock-count-wizard';

export const metadata: Metadata = {
  title: 'Start Physical Count | WSNexa Inventory',
  description: 'Initialize a physical stock audit count sheet for your outlet',
};

export default async function NewStockCountPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/counts');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const [locations, categories] = await Promise.all([
    InventoryService.getBranchLocations(context.business.id, context.activeBranch.id),
    InventoryService.getCategories(context.business.id),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Start Physical Count"
        description="Initialize a physical stock audit count sheet for your outlet"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Counts', href: '/dashboard/inventory/counts' },
          { label: 'Start Count' },
        ]}
        helpSlug="performing-physical-stock-counts"
      />

      <StockCountWizard
        locations={locations}
        categories={categories}
        branchId={context.activeBranch.id}
      />
    </div>
  );
}

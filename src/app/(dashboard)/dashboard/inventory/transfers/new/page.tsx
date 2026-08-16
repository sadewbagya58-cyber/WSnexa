import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { StockTransferForm } from '@/components/inventory/stock-transfer-form';

export const metadata: Metadata = {
  title: 'Create Stock Transfer | WSNexa Inventory',
  description: 'Dispatch stock between storage locations or authorized outlets',
};

export default async function NewStockTransferPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/transfers');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const { createAdminClient } = await import('@/lib/supabase/server');
  const admin = createAdminClient();

  const [{ data: branchesData }, locations, items] = await Promise.all([
    admin.from('branches').select('id, name').eq('business_id', context.business.id).eq('status', 'active'),
    InventoryService.getBranchLocations(context.business.id, context.activeBranch.id),
    InventoryService.getInventoryItems(context.business.id, context.activeBranch.id),
  ]);

  const branches = (branchesData && branchesData.length > 0)
    ? branchesData
    : [{ id: context.activeBranch.id, name: context.activeBranch.name }];

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Create Stock Transfer"
        description="Dispatch ingredients or stock between locations or branches"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Transfers', href: '/dashboard/inventory/transfers' },
          { label: 'New Transfer' },
        ]}
        helpSlug="managing-stock-transfers"
      />

      <StockTransferForm
        branches={branches}
        locations={locations}
        items={items}
        activeBranchId={context.activeBranch.id}
      />
    </div>
  );
}

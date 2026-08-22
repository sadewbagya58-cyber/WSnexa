import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { StockCountMobileSheet } from '@/components/inventory/stock-count-mobile-sheet';
import { can, resolveAuthorizationContext } from '@/server/auth';

interface StockCountDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Audit Sheet | WSNexa Inventory',
  description: 'Physical stock count audit sheet and reconciliation',
};

export default async function StockCountDetailPage({ params }: StockCountDetailPageProps) {
  const { id } = await params;
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/counts');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let hasCostPermission = false;
  let canApprove = false;
  try {
    const authContext = await resolveAuthorizationContext();
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view' });
    canApprove = await can({ context: authContext, permission: 'inventory.counts.approve' });
  } catch {
    hasCostPermission = false;
    canApprove = false;
  }

  const count = await InventoryService.getStockCountById(
    context.business.id,
    context.activeBranch.id,
    id,
    hasCostPermission
  );

  if (!count) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={count.title}
        description={`Audit Sheet ${count.countNumber} • ${count.locationName}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Counts', href: '/dashboard/inventory/counts' },
          { label: count.countNumber },
        ]}
        helpSlug="performing-physical-stock-counts"
      />

      <StockCountMobileSheet
        count={count}
        canApprove={canApprove}
        hasCostPermission={hasCostPermission}
      />
    </div>
  );
}

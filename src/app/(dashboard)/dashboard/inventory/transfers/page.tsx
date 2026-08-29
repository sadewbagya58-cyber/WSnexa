import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { resolveInventorySubNavPermissions } from '@/server/inventory/inventory-nav-permissions';
import { StockTransfersClient } from '@/components/inventory/stock-transfers-client';

export const metadata: Metadata = {
  title: 'Stock Transfers | WSNexa Inventory',
  description: 'Manage internal and cross-branch inventory transfers and receipts',
};

export default async function StockTransfersPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/transfers');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role, context?.membership?.customRoleId)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let canManageTransfers = false;
  let navPermissions: Awaited<ReturnType<typeof resolveInventorySubNavPermissions>> = {
    canViewInventory: false,
    canViewItems: false,
    canViewCounts: false,
    canViewRecipes: false,
    canViewPurchasing: false,
    canViewReceiving: false,
    canViewTransfers: false,
    canViewSuppliers: false,
    canViewLocations: false,
    canViewWaste: false,
    canViewSettings: false,
  };

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
    const hasPerm =
      (await can({ context: authContext, permission: 'inventory.transfers.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    canManageTransfers = hasPerm || authContext.isBusinessOwner;

    navPermissions = await resolveInventorySubNavPermissions(
      authContext,
      context.activeBranch.id,
      context.business.id
    );
  } catch {
    canManageTransfers = false;
  }

  const activeBranchId = context.activeBranch.id;
  const branchName = context.activeBranch.name;
  const transfers = await InventoryService.getStockTransfers(
    context.business.id,
    activeBranchId
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Transfers"
        description={`Internal location transfers and cross-branch dispatches for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Transfers' },
        ]}
        helpSlug="managing-stock-transfers"
        primaryAction={
          canManageTransfers
            ? {
                label: '+ New Transfer',
                href: '/dashboard/inventory/transfers/new',
              }
            : undefined
        }
      />

      <InventorySubNav {...navPermissions} />

      {/* Transfer Lifecycle Flow Guide */}
      <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 text-xs text-zinc-600">
        <span className="font-bold text-zinc-900 block mb-1">Transfer Lifecycle:</span>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="bg-white border border-zinc-200 px-2.5 py-1 rounded-lg font-semibold text-zinc-700">
            1. Create Draft
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-white border border-zinc-200 px-2.5 py-1 rounded-lg font-semibold text-zinc-700">
            2. Dispatch Transfer <span className="text-zinc-400">(Source stock deducted)</span>
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold text-amber-800">
            3. In Transit 🚚
          </span>
          <span className="text-zinc-400">→</span>
          <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold text-emerald-800">
            4. Receive Stock <span className="text-emerald-600">(Destination stock updated)</span>
          </span>
        </div>
      </div>

      <StockTransfersClient
        transfers={transfers}
        activeBranchId={activeBranchId}
        branchName={branchName}
        canManageTransfers={canManageTransfers}
      />
    </div>
  );
}

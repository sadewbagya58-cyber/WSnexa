import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { InventoryItemsTable } from '@/components/inventory/inventory-items-table';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { resolveInventorySubNavPermissions } from '@/server/inventory/inventory-nav-permissions';
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
  let canManageItems = false;
  let canAdjust = false;
  let canWaste = false;
  let canManageLocations = false;
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
    hasCostPermission = await can({ context: authContext, permission: 'inventory.costs.view', resource: branchResource });
    const hasItemsCreate =
      (await can({ context: authContext, permission: 'inventory.items.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.items.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    const hasAdjustPerm =
      (await can({ context: authContext, permission: 'inventory.adjust', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    const hasWastePerm =
      (await can({ context: authContext, permission: 'inventory.waste.record', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    const hasLocationsManage =
      (await can({ context: authContext, permission: 'inventory.locations.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));

    canManageItems = hasItemsCreate || authContext.isBusinessOwner;
    canAdjust = hasAdjustPerm || authContext.isBusinessOwner;
    canWaste = hasWastePerm || authContext.isBusinessOwner;
    canManageLocations = hasLocationsManage || authContext.isBusinessOwner;

    navPermissions = await resolveInventorySubNavPermissions(
      authContext,
      context.activeBranch.id,
      context.business.id
    );
  } catch {
    hasCostPermission = false;
    canManageItems = false;
    canAdjust = false;
    canWaste = false;
    canManageLocations = false;
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
        description={`Manage physical ingredient stock, units, reorder levels, and balances for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Stock Items' },
        ]}
        helpSlug="adding-inventory-items-and-units"
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
          canManageLocations ? (
            <Link
              href="/dashboard/inventory/locations"
              className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
            >
              📦 Manage Locations
            </Link>
          ) : undefined
        }
      />

      <InventorySubNav {...navPermissions} />

      <InventoryItemsTable
        items={items}
        categories={categories}
        locations={locations}
        currency={context.business.defaultCurrency || 'USD'}
        hasCostPermission={hasCostPermission}
        canManageItems={canManageItems}
        canAdjust={canAdjust}
        canWaste={canWaste}
      />
    </div>
  );
}

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { InventoryService } from '@/server/services/inventory.service';
import { StorageLocationManager } from '@/components/inventory/storage-location-manager';

export const metadata: Metadata = {
  title: 'Storage Locations | WSNexa Inventory',
  description: 'Manage branch storage locations, walk-in coolers, dry stores, and bar caches',
};

export default async function StorageLocationsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/locations');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  const locations = await InventoryService.getBranchLocations(
    context.business.id,
    context.activeBranch.id
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage Locations"
        description={`Manage physical stock storage areas for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Storage Locations' },
        ]}
        helpSlug="understanding-storage-locations"
      />

      <StorageLocationManager
        locations={locations}
        branchId={context.activeBranch.id}
        branchName={context.activeBranch.name}
      />
    </div>
  );
}

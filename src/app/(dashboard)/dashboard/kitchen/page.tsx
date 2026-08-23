import React from 'react';
import { redirect } from 'next/navigation';
import { OrderService } from '@/server/services/order.service';
import { PageHeader } from '@/components/ui/page-header';
import { KitchenOrderQueue } from '@/components/kitchen/kitchen-order-queue';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';

export default async function KitchenPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/kitchen');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canUpdate = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canUpdateKitchen = await can({
        context: authContext,
        permission: 'kitchen.update',
        resource: {
          resourceType: 'branch',
          resourceId: branchId,
          businessId,
          branchId,
          departmentId: null,
          organizationUnitId: null,
          serviceAreaId: null,
          ownerUserId: null,
        },
      });
      canUpdate = canUpdateKitchen || authContext.isBusinessOwner;
    }
  } catch {
    canUpdate = tenantContext.membership?.role === 'business_owner';
  }

  const initialOrders = await OrderService.getKitchenQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen Display Queue"
        description={`Active orders for ${tenantContext.activeBranch.name} (${tenantContext.activeBranch.code || 'Main'}).`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Kitchen Queue' },
        ]}
        helpSlug="kitchen-queue-overview"
      />

      <KitchenOrderQueue
        initialOrders={initialOrders}
        branchName={tenantContext.activeBranch.name}
        branchId={tenantContext.activeBranch.id}
        canUpdate={canUpdate}
      />
    </div>
  );
}

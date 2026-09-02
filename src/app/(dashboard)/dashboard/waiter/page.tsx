import React from 'react';
import { redirect } from 'next/navigation';
import { WaiterService } from '@/server/services/waiter.service';
import { PageHeader } from '@/components/ui/page-header';
import { WaiterRequestCenter } from '@/components/waiter/waiter-request-center';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';

export default async function WaiterPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/waiter');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canManageRequests = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canManage = await can({
        context: authContext,
        permission: 'waiter.requests.manage',
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
      canManageRequests = canManage || authContext.isBusinessOwner;
    }
  } catch {
    canManageRequests = tenantContext.membership?.role === 'business_owner';
  }

  const initialRequests = await WaiterService.getBranchWaiterRequests();

  let assignedAreaIds: string[] | null = null;
  const isPropertyLevel =
    tenantContext.membership.role === 'business_owner' ||
    tenantContext.membership.role === 'branch_manager' ||
    tenantContext.membership.role === 'admin';

  if (!isPropertyLevel) {
    const { ServiceAreaService } = await import('@/server/services/service-area.service');
    assignedAreaIds = await ServiceAreaService.getStaffAssignedAreaIds(tenantContext.membership.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waiter Request Center"
        description={`Realtime customer table assistance requests for ${tenantContext.activeBranch.name}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Waiter Assistance' },
        ]}
        helpSlug="waiter-dashboard-overview"
      />

      <WaiterRequestCenter
        initialRequests={initialRequests}
        branchName={tenantContext.activeBranch.name}
        branchId={tenantContext.activeBranch.id}
        assignedAreaIds={assignedAreaIds}
        canManageRequests={canManageRequests}
      />
    </div>
  );
}

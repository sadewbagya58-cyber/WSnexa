import React from 'react';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { OrderSecurityService } from '@/server/services/order-security.service';
import { OrderSecuritySettings } from '@/components/settings/order-security-settings';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { SettingsSubNav } from '@/components/settings/settings-subnav';

export default async function OrderSecurityPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/settings/order-security');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canManage = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canManageOrderSecurity = await can({
        context: authContext,
        permission: 'order_security.manage',
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
      canManage = canManageOrderSecurity || authContext.isBusinessOwner;
    }
  } catch {
    canManage = tenantContext.membership?.role === 'business_owner';
  }
  const initialSettings = await OrderSecurityService.getBranchSecuritySettings(branchId);
  const isOwner = tenantContext.membership?.role === 'business_owner';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SettingsSubNav canViewSubscription={isOwner} />
      <OrderSecuritySettings
        branchId={branchId}
        branchName={tenantContext.activeBranch.name}
        initialSettings={initialSettings}
        canManage={canManage}
      />
    </div>
  );
}

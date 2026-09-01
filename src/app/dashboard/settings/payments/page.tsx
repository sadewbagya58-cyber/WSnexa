import React from 'react';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { BranchPaymentSettings } from '@/components/settings/branch-payment-settings';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { SettingsSubNav } from '@/components/settings/settings-subnav';
import { resolveSettingsSubNavPermissions } from '@/server/navigation/settings-nav-permissions';

export default async function BranchPaymentsPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/settings/payments');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canManage = false;
  let navPermissions;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canManageBranchPayments = await can({
        context: authContext,
        permission: 'branches.manage',
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
      canManage = canManageBranchPayments || authContext.isBusinessOwner;
    }
    navPermissions = await resolveSettingsSubNavPermissions(authContext, branchId, businessId);
  } catch {
    canManage = tenantContext.membership?.role === 'business_owner';
    navPermissions = await resolveSettingsSubNavPermissions(null, branchId, businessId);
  }

  const initialMethods = await BranchPaymentService.getBranchPaymentMethods(branchId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full min-w-0">
      <SettingsSubNav {...navPermissions} />
      <BranchPaymentSettings
        branchId={branchId}
        branchName={tenantContext.activeBranch.name}
        initialMethods={initialMethods}
        canManage={canManage}
      />
    </div>
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { BranchPaymentSettings } from '@/components/settings/branch-payment-settings';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';

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
  } catch {
    canManage = tenantContext.membership?.role === 'business_owner';
  }

  const initialMethods = await BranchPaymentService.getBranchPaymentMethods(branchId);

  return (
    <BranchPaymentSettings
      branchId={branchId}
      branchName={tenantContext.activeBranch.name}
      initialMethods={initialMethods}
      canManage={canManage}
    />
  );
}

import React from 'react';
import { redirect } from 'next/navigation';
import { PaymentService } from '@/server/services/payment.service';
import { CashierDashboard } from '@/components/cashier/cashier-dashboard';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';

export default async function CashierDashboardPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/cashier');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/onboarding');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canRecordPayments = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canRecord = await can({
        context: authContext,
        permission: 'payments.record',
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
      canRecordPayments = canRecord || authContext.isBusinessOwner;
    }
  } catch {
    canRecordPayments = tenantContext.membership?.role === 'business_owner';
  }

  const initialOrders = await PaymentService.getCashierOrders();

  return (
    <div className="p-6">
      <CashierDashboard
        branchId={tenantContext.activeBranch.id}
        branchName={tenantContext.activeBranch.name}
        businessName={tenantContext.business.name}
        initialOrders={initialOrders}
        canRecordPayments={canRecordPayments}
      />
    </div>
  );
}

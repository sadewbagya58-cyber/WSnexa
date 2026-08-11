import React from 'react';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { BranchPaymentSettings } from '@/components/settings/branch-payment-settings';
import { redirect } from 'next/navigation';

export default async function BranchPaymentsPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const initialMethods = await BranchPaymentService.getBranchPaymentMethods(
    tenantContext.activeBranch.id
  );

  return (
    <BranchPaymentSettings
      branchId={tenantContext.activeBranch.id}
      branchName={tenantContext.activeBranch.name}
      initialMethods={initialMethods}
    />
  );
}

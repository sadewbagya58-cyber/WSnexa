import React from 'react';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { OrderSecurityService } from '@/server/services/order-security.service';
import { OrderSecuritySettings } from '@/components/settings/order-security-settings';
import { redirect } from 'next/navigation';

export default async function OrderSecurityPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const initialSettings = await OrderSecurityService.getBranchSecuritySettings(
    tenantContext.activeBranch.id
  );

  return (
    <OrderSecuritySettings
      branchId={tenantContext.activeBranch.id}
      branchName={tenantContext.activeBranch.name}
      initialSettings={initialSettings}
    />
  );
}

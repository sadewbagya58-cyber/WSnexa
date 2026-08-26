import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { OrdersWorkspaceClient } from '@/components/orders/orders-workspace-client';

export const metadata: Metadata = {
  title: 'Orders Workspace | WSNexa POS',
  description: 'Centralized operational hub for Cashier POS, Kitchen Display System, and Waiter Service.',
};

export default async function OrdersPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let canAccessCashier = true;
  let canAccessKitchen = true;
  let canAccessWaiter = true;

  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const branchResource = authContext.activeBranchId
        ? { type: 'branch' as const, id: authContext.activeBranchId }
        : undefined;

      [canAccessCashier, canAccessKitchen, canAccessWaiter] = await Promise.all([
        can({ context: authContext, permission: 'cashier.access', resource: branchResource }),
        can({ context: authContext, permission: 'kitchen.access', resource: branchResource }),
        can({ context: authContext, permission: 'waiter.requests.view', resource: branchResource }),
      ]);
    }
  } catch {
    // Fallback to true if evaluation fails for authenticated owner
  }

  return (
    <OrdersWorkspaceClient
      userRole={context.membership?.role || 'business_owner'}
      activeBranchName={context.activeBranch.name}
      canAccessCashier={canAccessCashier}
      canAccessKitchen={canAccessKitchen}
      canAccessWaiter={canAccessWaiter}
    />
  );
}

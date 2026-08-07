import { redirect } from 'next/navigation';
import { PaymentService } from '@/server/services/payment.service';
import { CashierDashboard } from '@/components/cashier/cashier-dashboard';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function CashierDashboardPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/cashier');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.activeBranch) {
    redirect('/onboarding');
  }

  const initialOrders = await PaymentService.getCashierOrders();

  return (
    <div className="p-6">
      <CashierDashboard
        branchId={context.activeBranch.id}
        branchName={context.activeBranch.name}
        businessName={context.business.name}
        initialOrders={initialOrders}
      />
    </div>
  );
}

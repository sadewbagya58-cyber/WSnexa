import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PaymentService } from '@/server/services/payment.service';
import { CashierDashboard } from '@/components/cashier/cashier-dashboard';

export default async function CashierDashboardPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/onboarding');
  }

  const { role } = context.membership;
  if (!['business_owner', 'branch_manager', 'cashier'].includes(role)) {
    redirect('/dashboard');
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

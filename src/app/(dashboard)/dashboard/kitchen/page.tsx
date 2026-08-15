import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { OrderService } from '@/server/services/order.service';
import { PageHeader } from '@/components/ui/page-header';
import { KitchenOrderQueue } from '@/components/kitchen/kitchen-order-queue';

export default async function KitchenPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const role = context.membership.role;
  if (
    role !== 'business_owner' &&
    role !== 'branch_manager' &&
    role !== 'kitchen_staff' &&
    role !== 'cashier' &&
    role !== 'waiter'
  ) {
    redirect('/dashboard');
  }

  const initialOrders = await OrderService.getKitchenQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen Display Queue"
        description={`Active orders for ${context.activeBranch.name} (${context.activeBranch.code || 'Main'}).`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Kitchen Queue' },
        ]}
        helpSlug="kitchen-queue-overview"
      />

      <KitchenOrderQueue
        initialOrders={initialOrders}
        branchName={context.activeBranch.name}
        branchId={context.activeBranch.id}
      />
    </div>
  );
}

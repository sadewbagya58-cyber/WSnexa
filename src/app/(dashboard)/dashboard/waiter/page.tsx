import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { WaiterService } from '@/server/services/waiter.service';
import { PageHeader } from '@/components/ui/page-header';
import { WaiterRequestCenter } from '@/components/waiter/waiter-request-center';

export default async function WaiterPage() {
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

  const initialRequests = await WaiterService.getBranchWaiterRequests();

  let assignedAreaIds: string[] | null = null;
  if (role === 'waiter') {
    const { ServiceAreaService } = await import('@/server/services/service-area.service');
    assignedAreaIds = await ServiceAreaService.getStaffAssignedAreaIds(context.membership.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waiter Request Center"
        description={`Realtime customer table assistance requests for ${context.activeBranch.name}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Waiter Assistance' },
        ]}
        helpSlug="waiter-dashboard-overview"
      />

      <WaiterRequestCenter
        initialRequests={initialRequests}
        branchName={context.activeBranch.name}
        branchId={context.activeBranch.id}
        assignedAreaIds={assignedAreaIds}
      />
    </div>
  );
}

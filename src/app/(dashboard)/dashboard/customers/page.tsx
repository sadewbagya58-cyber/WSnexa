import { redirect } from 'next/navigation';
import { requireRoutePermission } from '@/server/tenant/guard';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { CRMOverviewService } from '@/server/crm/crm-overview.service';
import { CustomerDirectoryService } from '@/server/crm/customer-directory.service';
import { CustomerActionService } from '@/server/crm/customer-action.service';
import { CRMHubClient } from '@/components/crm/crm-hub-client';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guest CRM & Retention | WSNexa',
  description: 'Manage guest profiles, behavioral segmentation, retention risk, and auditable CRM actions.',
};

export default async function CustomersPage() {
  const { allowed } = await requireRoutePermission('/dashboard/customers');
  if (!allowed) {
    redirect('/login');
  }

  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext || !authContext.businessId) {
    redirect('/login');
  }

  const hasViewPermission = await can({
    context: authContext,
    permission: 'customers.view',
  });

  if (!hasViewPermission) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m0-6V7a4 4 0 118 0v4h-8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to access the Guest CRM hub.
        </p>
      </div>
    );
  }

  const canManage = await can({
    context: authContext,
    permission: 'customers.manage',
  });

  const hasContactView = await can({
    context: authContext,
    permission: 'customers.contact_view',
  });

  const isOwner = authContext.isBusinessOwner;

  const [hasReviewsPermission, hasReputationPermission, hasLoyaltyPermission] = await Promise.all([
    can({ context: authContext, permission: 'reviews.view' }).then((v) => v || isOwner),
    can({ context: authContext, permission: 'reputation.view' }).then((v) => v || isOwner),
    can({ context: authContext, permission: 'loyalty.view' }).then((v) => (v || isOwner) && IS_LOYALTY_ENABLED),
  ]);

  const [overview, directoryResult, actionsResult] = await Promise.all([
    CRMOverviewService.getCRMOverview({
      businessId: authContext.businessId,
      branchIds: authContext.authorizedBranchIds,
    }),
    CustomerDirectoryService.searchCustomerDirectory(authContext, {
      businessId: authContext.businessId,
      limit: 25,
      offset: 0,
    }),
    CustomerActionService.listActions({
      businessId: authContext.businessId,
      branchIds: authContext.authorizedBranchIds,
      statusFilter: 'ACTIVE',
      limit: 25,
      offset: 0,
      hasContactViewPermission: hasContactView,
    }),
  ]);

  return (
    <CRMHubClient
      businessId={authContext.businessId}
      overview={overview}
      initialDirectory={directoryResult.items}
      initialTotalCustomers={directoryResult.totalCount}
      initialActions={actionsResult.actions}
      initialTotalActions={actionsResult.total}
      canManage={canManage}
      hasContactView={hasContactView}
      hasReviewsPermission={hasReviewsPermission}
      hasReputationPermission={hasReputationPermission}
      hasLoyaltyPermission={hasLoyaltyPermission}
      authorizedBranchIds={authContext.authorizedBranchIds}
    />
  );
}

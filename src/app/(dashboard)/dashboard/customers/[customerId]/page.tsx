import { notFound, redirect } from 'next/navigation';
import { requireRoutePermission } from '@/server/tenant/guard';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { CustomerProfileService } from '@/server/crm/customer-profile.service';
import { CustomerSegmentationService } from '@/server/crm/customer-segmentation.service';
import { CustomerNotesService } from '@/server/crm/customer-notes.service';
import { CustomerTagService } from '@/server/crm/customer-tag.service';
import { CustomerActionService } from '@/server/crm/customer-action.service';
import { CustomerProfileClient } from '@/components/crm/customer-profile-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guest Profile | WSNexa CRM',
  description: 'View unified guest profile, RFM segmentation, notes, tags, and active retention actions.',
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You do not have permission to view guest profiles.
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

  const [profile, segmentation, notesRes, tags, customerTags, actionsRes, availableTags] = await Promise.all([
    CustomerProfileService.getUnifiedCustomerProfile(customerId, authContext.businessId, authContext),
    CustomerSegmentationService.getCustomerSegmentation({
      businessId: authContext.businessId,
      customerId,
      branchIds: authContext.authorizedBranchIds,
    }),
    CustomerNotesService.listNotes({
      businessId: authContext.businessId,
      crmCustomerId: customerId,
      branchIds: authContext.authorizedBranchIds,
    }),
    CustomerTagService.listCustomerTags({
      businessId: authContext.businessId,
      crmCustomerId: customerId,
    }),
    CustomerTagService.listCustomerTags({
      businessId: authContext.businessId,
      crmCustomerId: customerId,
    }),
    CustomerActionService.listActions({
      businessId: authContext.businessId,
      branchIds: authContext.authorizedBranchIds,
      statusFilter: 'ALL',
      hasContactViewPermission: hasContactView,
    }),
    CustomerTagService.listTags(authContext.businessId),
  ]);

  if (!profile) {
    notFound();
  }

  const customerActions = actionsRes.actions.filter((a) => a.customerId === customerId);

  return (
    <CustomerProfileClient
      businessId={authContext.businessId}
      profile={profile}
      segmentation={segmentation}
      notes={notesRes.notes}
      tags={tags}
      actions={customerActions}
      availableTags={availableTags}
      canManage={canManage}
      hasContactView={hasContactView}
    />
  );
}

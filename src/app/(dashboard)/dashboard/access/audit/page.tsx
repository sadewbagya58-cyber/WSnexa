import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { AuditService } from '@/server/services/audit.service';
import { AuditHistoryClient } from '@/components/audit/audit-history-client';
import { PageHeader } from '@/components/layout/page-header';
import { TeamSubNav } from '@/components/team/team-subnav';
import { createAdminClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Audit History & Action Logs | WSNexa',
  description: 'Immutable historical audit log and lifecycle event tracking for enterprise accountability.',
};

export default async function AuditHistoryPage() {
  const { allowed } = await requireRoutePermission('/dashboard/access');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Audit History Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have permission to view enterprise audit history logs.
        </p>
      </div>
    );
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">No Active Business</h2>
        <p className="text-xs text-zinc-500">Please select an active business to view audit logs.</p>
      </div>
    );
  }

  const admin = createAdminClient();

  // Fetch branches for filter
  const { data: branchRows } = await admin
    .from('branches')
    .select('id, name')
    .eq('business_id', context.business.id)
    .order('name');

  const branches = (branchRows || []).map((b) => ({ id: b.id, name: b.name }));

  const activeBranchId = context.activeBranch?.id;
  const isOwner = context.membership?.role === 'owner';
  const allowedBranchIds = isOwner ? undefined : [activeBranchId].filter(Boolean) as string[];

  // Fetch initial 20 audit records
  const initialData = await AuditService.getAuditLogs({
    businessId: context.business.id,
    branchId: activeBranchId,
    branchIds: allowedBranchIds,
    limit: 20,
    offset: 0,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Audit History"
        description="Immutable chronological record of business events, inventory changes, financial operations, and workforce actions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Access Control', href: '/dashboard/access' },
          { label: 'Audit History' },
        ]}
      />

      <TeamSubNav canViewAudit={true} />

      <AuditHistoryClient
        initialLogs={initialData.logs}
        initialTotal={initialData.total}
        initialPage={1}
        initialPageSize={initialData.limit || 20}
        branches={branches}
        activeBranchId={activeBranchId}
        canViewAllBranches={isOwner}
      />
    </div>
  );
}

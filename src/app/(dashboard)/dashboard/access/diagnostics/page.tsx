import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  listTeamMembersAction,
  listPermissionCatalogAction,
} from '@/server/actions/permission';
import { BranchService } from '@/server/services/branch.service';
import { OrganizationService } from '@/server/services/organization.service';
import { AccessDiagnosticsClient } from '@/components/access/access-diagnostics-client';

export const metadata = {
  title: 'Access Diagnostics | Policy Engine | WSNexa',
  description: 'Interactive "Why Can / Can\'t This User?" Policy Engine evaluation tool.',
};

import { PageHeader } from '@/components/layout/page-header';
import { TeamSubNav } from '@/components/team/team-subnav';

export default async function AccessDiagnosticsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/access/diagnostics');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have permission to access Policy Engine Diagnostics.
        </p>
      </div>
    );
  }

  const [membersRes, catalogRes, branchesRes, deptsRes] = await Promise.all([
    listTeamMembersAction(),
    listPermissionCatalogAction(),
    BranchService.getBusinessBranches(context.business.id),
    OrganizationService.getDepartments(context.business.id),
  ]);

  const members = membersRes.success && membersRes.data ? membersRes.data : [];
  const catalog = catalogRes.success && catalogRes.data ? catalogRes.data : [];
  const branches = branchesRes || [];
  const departments = deptsRes || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Access Diagnostics Engine"
        description="Interactive Policy Engine evaluation tracer, provenance breakdown, and permission simulation."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team', href: '/dashboard/people' },
          { label: 'Diagnostics' },
        ]}
      />

      <TeamSubNav />

      <AccessDiagnosticsClient
        members={members}
        catalog={catalog}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}

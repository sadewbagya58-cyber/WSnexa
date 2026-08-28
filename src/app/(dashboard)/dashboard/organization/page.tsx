import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { OrganizationOverviewClient } from '@/components/organization/organization-overview-client';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Organization Overview | WSNexa',
  description: 'Enterprise organizational hierarchy, departments, positions, and leadership coverage',
};

import { PageHeader } from '@/components/layout/page-header';
import { TeamSubNav } from '@/components/team/team-subnav';

export default async function OrganizationOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business } = context;

  let canManage = false;
  try {
    const authContext = await resolveAuthorizationContext();
    canManage = await can({ context: authContext, permission: 'organization.manage' });
  } catch {
    canManage = false;
  }

  const [summary, issues] = await Promise.all([
    OrganizationService.getOrganizationSummary(business.id),
    OrganizationService.getOrganizationIntegrityIssues(business.id),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Organization Hub"
        description="Multi-branch organizational architecture, department hierarchy, and headcount hub."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team', href: '/dashboard/team' },
          { label: 'Organization Hub' },
        ]}
      />

      <TeamSubNav />

      <OrganizationOverviewClient
        summary={summary}
        recentIssues={issues}
        canManage={canManage}
      />
    </div>
  );
}

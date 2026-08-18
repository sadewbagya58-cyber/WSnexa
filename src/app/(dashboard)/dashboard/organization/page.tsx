import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { OrganizationOverviewClient } from '@/components/organization/organization-overview-client';

export const metadata: Metadata = {
  title: 'Organization Overview | WSNexa',
  description: 'Enterprise organizational hierarchy, departments, positions, and leadership coverage',
};

export default async function OrganizationOverviewPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch } = context;

  const [summary, issues, canManage] = await Promise.all([
    OrganizationService.getOrganizationSummary(business.id),
    OrganizationService.getOrganizationIntegrityIssues(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'organization.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <OrganizationOverviewClient
        summary={summary}
        recentIssues={issues}
        canManage={canManage}
      />
    </div>
  );
}

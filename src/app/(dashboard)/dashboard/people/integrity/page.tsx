import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { IntegrityCenterClient } from '@/components/organization/integrity-center-client';

export const metadata: Metadata = {
  title: 'Organization Integrity Center | WSNexa',
  description: 'Real-time structural diagnostics, branch access alignment, and temporal lifecycle scanner',
};

export default async function OrganizationIntegrityPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/people/integrity');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch } = context;

  const [issues, canManage] = await Promise.all([
    OrganizationService.getOrganizationIntegrityIssues(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'organization.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <IntegrityCenterClient
        issues={issues}
        canManage={canManage}
      />
    </div>
  );
}

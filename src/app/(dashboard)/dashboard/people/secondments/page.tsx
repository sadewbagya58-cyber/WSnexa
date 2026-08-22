import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { SecondmentsHubClient, SecondmentRow } from '@/components/organization/secondments-hub-client';

export const metadata: Metadata = {
  title: 'Cross-Property Secondments | WSNexa',
  description: 'Manage inter-branch employee secondments, taskforces, and temporary cross-property deployments',
};

export default async function SecondmentsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/people/secondments');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business } = context;
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  const authContext = await resolveAuthorizationContext();

  const [secondments, canManage] = await Promise.all([
    OrganizationService.listSecondments(business.id),
    authContext ? can({ context: authContext, permission: 'people.manage' }) : Promise.resolve(false),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <SecondmentsHubClient
        secondments={secondments as unknown as SecondmentRow[]}
        canManage={canManage}
      />
    </div>
  );
}

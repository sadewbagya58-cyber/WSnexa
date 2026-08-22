import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { ActingHubClient, ActingRow } from '@/components/organization/acting-hub-client';

export const metadata: Metadata = {
  title: 'Acting Leadership Hub | WSNexa',
  description: 'Manage temporary acting positions, leadership coverage, and absence replacements',
};

export default async function ActingHubPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/people/acting');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business } = context;
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  const authContext = await resolveAuthorizationContext();

  const [actingAssignments, canManage] = await Promise.all([
    OrganizationService.listActingAssignments(business.id),
    authContext ? can({ context: authContext, permission: 'people.manage' }) : Promise.resolve(false),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <ActingHubClient
        actingAssignments={actingAssignments as unknown as ActingRow[]}
        canManage={canManage}
      />
    </div>
  );
}

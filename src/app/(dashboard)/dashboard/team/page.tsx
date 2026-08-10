import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PermissionService } from '@/server/services/permission.service';
import { TeamManagement } from '@/components/team/team-management';

export const metadata: Metadata = {
  title: 'Team & Staff | WSNexa Business',
  description: 'Manage staff members, roles, permission overrides, and account authorization',
};

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

import { ServiceAreaService } from '@/server/services/service-area.service';

export default async function TeamDirectoryPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/team');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, membership, activeBranch } = context;

  const [catalog, members, customRoles, branchAreas] = await Promise.all([
    PermissionService.listPermissionCatalog(),
    PermissionService.listTeamMembers(business.id, activeBranch?.id),
    PermissionService.listCustomRoles(business.id),
    activeBranch?.id
      ? ServiceAreaService.listBranchAreas(business.id, activeBranch.id)
      : Promise.resolve([]),
  ]);

  return (
    <TeamManagement
      catalog={catalog}
      initialMembers={members}
      customRoles={customRoles}
      userRole={membership.role}
      activeBranchName={activeBranch?.name || 'Main Branch'}
      branchAreas={branchAreas.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}

import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  listRoleTemplatesAction,
  listCustomRolesAction,
  listPermissionScopeGrantsAction,
  listTeamMembersAction,
} from '@/server/actions/permission';
import { AccessHubOverview } from '@/components/access/access-hub-overview';

export const metadata = {
  title: 'Access Control Hub | WSNexa',
  description: 'Roles, permissions, and location access management hub.',
};

import { PageHeader } from '@/components/layout/page-header';

import { TeamSubNav } from '@/components/team/team-subnav';

export default async function AccessHubPage() {
  const { allowed } = await requireRoutePermission('/dashboard/access');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Control Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have permission to access the Access Control Hub.
        </p>
      </div>
    );
  }

  const [templatesRes, customRolesRes, scopeGrantsRes, membersRes] = await Promise.all([
    listRoleTemplatesAction(),
    listCustomRolesAction({ includeArchived: true }),
    listPermissionScopeGrantsAction(),
    listTeamMembersAction(),
  ]);

  const builtInTemplates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const customRoles = customRolesRes.success && customRolesRes.data ? customRolesRes.data : [];
  const scopeGrants = scopeGrantsRes.success && scopeGrantsRes.data ? scopeGrantsRes.data : [];
  const teamMembers = membersRes.success && membersRes.data ? membersRes.data : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Access Control Hub"
        description="Manage staff roles, custom permission bundles, and location access."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Team', href: '/dashboard/team' },
          { label: 'Access Control Hub' },
        ]}
      />

      <TeamSubNav />

      <AccessHubOverview
        builtInTemplates={builtInTemplates}
        customRoles={customRoles}
        scopeGrants={scopeGrants}
        teamMembers={teamMembers}
      />
    </div>
  );
}

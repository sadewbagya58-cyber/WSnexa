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
  description: 'RBAC & Scope V2 authorization management and diagnostics hub.',
};

export default async function AccessHubPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/access');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Control Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">roles.view</code> permission required to access the Access Control Hub.
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
      <AccessHubOverview
        builtInTemplates={builtInTemplates}
        customRoles={customRoles}
        scopeGrants={scopeGrants}
        teamMembers={teamMembers}
      />
    </div>
  );
}

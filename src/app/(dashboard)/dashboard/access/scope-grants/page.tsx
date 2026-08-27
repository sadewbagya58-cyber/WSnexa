import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  listPermissionScopeGrantsAction,
  listPermissionCatalogAction,
  listRoleTemplatesAction,
  listCustomRolesAction,
} from '@/server/actions/permission';
import { ScopeGrantManager } from '@/components/access/scope-grant-manager';
import { BranchService } from '@/server/services/branch.service';
import { OrganizationService } from '@/server/services/organization.service';

export const metadata = {
  title: 'Scoped Permission Grants | WSNexa',
  description: 'Manage fine-grained permission scope grants across properties and departments.',
};

import { PageHeader } from '@/components/layout/page-header';

export default async function ScopeGrantsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/access/scope-grants');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have permission to access Location Access Grants.
        </p>
      </div>
    );
  }

  const [grantsRes, catalogRes, templatesRes, customRolesRes, branchesRes, deptsRes] = await Promise.all([
    listPermissionScopeGrantsAction(),
    listPermissionCatalogAction(),
    listRoleTemplatesAction(),
    listCustomRolesAction({ includeArchived: false }),
    BranchService.getBusinessBranches(context.business.id),
    OrganizationService.getDepartments(context.business.id),
  ]);

  const grants = grantsRes.success && grantsRes.data ? grantsRes.data : [];
  const catalog = catalogRes.success && catalogRes.data ? catalogRes.data : [];
  const builtInTemplates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const customRoles = customRolesRes.success && customRolesRes.data ? customRolesRes.data : [];
  const branches = branchesRes || [];
  const departments = deptsRes || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Scope Grants Manager"
        description="Manage explicit scope grants across properties, departments, and service areas."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Access Control Hub', href: '/dashboard/access' },
          { label: 'Scope Grants' },
        ]}
      />

      <ScopeGrantManager
        grants={grants}
        catalog={catalog}
        builtInTemplates={builtInTemplates}
        customRoles={customRoles}
        branches={branches}
        departments={departments}
      />
    </div>
  );
}

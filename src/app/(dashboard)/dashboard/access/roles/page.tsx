import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  listRoleTemplatesAction,
  listCustomRolesAction,
  listPermissionCatalogAction,
} from '@/server/actions/permission';
import { BuiltInRolesView } from '@/components/access/built-in-roles-view';
import { CustomRolesList } from '@/components/access/custom-roles-list';
import { IconShieldCheck, IconSliders } from '@/components/access/access-icons';

export const metadata = {
  title: 'Roles & Templates | Access Control | WSNexa',
  description: 'Manage built-in templates and custom tenant roles.',
};

import { PageHeader } from '@/components/layout/page-header';

export default async function RolesManagementPage() {
  const { allowed } = await requireRoutePermission('/dashboard/access/roles');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">roles.view</code> permission required to access Role Management.
        </p>
      </div>
    );
  }

  const [templatesRes, customRolesRes, catalogRes] = await Promise.all([
    listRoleTemplatesAction(),
    listCustomRolesAction({ includeArchived: true }),
    listPermissionCatalogAction(),
  ]);

  const builtInTemplates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const customRoles = customRolesRes.success && customRolesRes.data ? customRolesRes.data : [];
  const catalog = catalogRes.success && catalogRes.data ? catalogRes.data : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Roles & Templates"
        description="Manage built-in role templates and custom capability permission bundles."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Access Control Hub', href: '/dashboard/access' },
          { label: 'Roles & Templates' },
        ]}
      />

      {/* Built-In Templates Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <IconShieldCheck className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-zinc-900">Standard Built-In Role Templates</h2>
        </div>
        <BuiltInRolesView templates={builtInTemplates} />
      </div>

      {/* Custom Roles Section */}
      <div className="space-y-3 pt-6 border-t border-zinc-200">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <IconSliders className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-zinc-900">Custom Tenant Roles</h2>
        </div>
        <CustomRolesList
          roles={customRoles}
          catalog={catalog}
          builtInTemplates={builtInTemplates}
        />
      </div>
    </div>
  );
}

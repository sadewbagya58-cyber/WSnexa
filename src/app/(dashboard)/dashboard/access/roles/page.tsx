import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  listRoleTemplatesAction,
  listCustomRolesAction,
  listPermissionCatalogAction,
} from '@/server/actions/permission';
import { BuiltInRolesView } from '@/components/access/built-in-roles-view';
import { CustomRolesList } from '@/components/access/custom-roles-list';
import Link from 'next/link';
import { IconArrowLeft, IconShieldCheck, IconSliders } from '@/components/access/access-icons';

export const metadata = {
  title: 'Roles & Templates | Access Control | WSNexa',
  description: 'Manage built-in templates and custom tenant roles.',
};

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
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/access"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <IconArrowLeft className="w-4 h-4" /> Back to Access Control Hub
        </Link>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-1">
        <h1 className="text-lg font-bold text-zinc-900">Role Capabilities & Governance</h1>
        <p className="text-xs text-zinc-500">
          Roles encapsulate WHAT staff capabilities are granted. System built-in templates provide standard baseline roles, while custom roles can be defined per business tenant.
        </p>
      </div>

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

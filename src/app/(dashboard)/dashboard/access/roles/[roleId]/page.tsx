import React from 'react';
import { requireRoutePermission } from '@/server/tenant/guard';
import {
  getCustomRoleAction,
  listPermissionCatalogAction,
  previewRoleEffectiveAccessAction,
  getRoleUsageAction,
  listRoleTemplatesAction,
} from '@/server/actions/permission';
import Link from 'next/link';
import {
  IconArrowRight,
  IconShield,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconUsers,
  IconMapPin,
  IconCircleCheck,
} from '@/components/access/access-icons';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Role Detail | Access Control | WSNexa',
  description: 'Inspect custom role capabilities and effective access.',
};

interface RoleDetailPageProps {
  params: Promise<{ roleId: string }>;
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { roleId } = await params;
  const { allowed } = await requireRoutePermission('/dashboard/access/roles');

  if (!allowed) {
    return (
      <div className="p-8 text-center bg-white border border-zinc-200 rounded-2xl max-w-lg mx-auto my-12 shadow-2xs">
        <h2 className="text-base font-bold text-zinc-900 mb-2">Access Restricted</h2>
        <p className="text-xs text-zinc-500">
          You do not have the <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">roles.view</code> permission required to view role details.
        </p>
      </div>
    );
  }

  const [roleRes, catalogRes, usageRes, previewRes] = await Promise.all([
    getCustomRoleAction(roleId),
    listPermissionCatalogAction(),
    getRoleUsageAction({ customRoleId: roleId }),
    previewRoleEffectiveAccessAction({ customRoleId: roleId }),
  ]);

  if (!roleRes.success || !roleRes.data) {
    notFound();
  }

  const role = roleRes.data;
  const catalog = catalogRes.success && catalogRes.data ? catalogRes.data : [];
  const usage = usageRes.success ? usageRes.data : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/access/roles"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
        >
          <IconArrowRight className="w-4 h-4" /> Back to Custom Roles List
        </Link>
      </div>

      {/* Role Header Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
            <IconShield className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900">{role.name}</h1>
              {role.isArchived && (
                <span className="text-xs font-mono font-semibold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-md">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
              {role.description || 'No description specified.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
            <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Assigned Members</span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              {usage?.activeMembers || 0}
            </span>
          </div>
          <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
            <span className="block text-[10px] font-semibold text-zinc-400 uppercase">Permissions</span>
            <span className="font-mono font-bold text-zinc-900 text-sm">
              {role.permissions.length} keys
            </span>
          </div>
        </div>
      </div>

      {/* Role Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Scope Specs */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Role Scope Boundaries
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Default Scope</span>
              <span className="font-mono font-bold text-zinc-900">{role.defaultScope}</span>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Max Scope Ceiling</span>
              <span className="font-mono font-bold text-zinc-700">{role.maxScope}</span>
            </div>
          </div>
        </div>

        {/* Audit Metadata */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Governance Metadata
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Created Date</span>
              <span className="font-mono text-zinc-800">
                {role.createdAt ? new Date(role.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <span className="block text-[10px] text-zinc-400 font-medium uppercase">Pending Invites</span>
              <span className="font-mono font-bold text-zinc-800">{usage?.pendingInvitations || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Keys Matrix View */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
          Bundled Permission Capabilities ({role.permissions.length})
        </h3>

        {role.permissions.length === 0 ? (
          <p className="text-xs text-zinc-500 italic p-4 text-center bg-zinc-50 rounded-xl border border-zinc-200">
            No permissions bundled with this custom role.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {role.permissions.map((key) => {
              const permInfo = catalog.find((c) => c.key === key);
              return (
                <div key={key} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <IconCircleCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{permInfo?.name || key}</span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 truncate" title={key}>
                    {key}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

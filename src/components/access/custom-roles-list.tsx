'use client';

import React, { useState } from 'react';
import { CustomRoleDetail, BuiltInRoleTemplate, FormattedPermission } from '@/types/authorization.types';
import { RoleEditorModal } from '@/components/access/role-editor-modal';
import { RoleArchiveModal } from '@/components/access/role-archive-modal';
import {
  IconShield,
  IconPlus,
  IconEdit,
  IconArchive,
  IconEye,
  IconBuildingSkyscraper,
  IconBuildingStore,
  IconUsers,
  IconMapPin,
  IconUserCheck,
} from './access-icons';
import { restoreCustomRoleAction } from '@/server/actions/permission';
import { useRouter } from 'next/navigation';

interface CustomRolesListProps {
  roles: CustomRoleDetail[];
  catalog: FormattedPermission[];
  builtInTemplates: BuiltInRoleTemplate[];
}

export const CustomRolesList: React.FC<CustomRolesListProps> = ({
  roles,
  catalog,
  builtInTemplates,
}) => {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleDetail | null>(null);
  const [archivingRole, setArchivingRole] = useState<CustomRoleDetail | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRestore = async (roleId: string) => {
    setIsSubmitting(true);
    await restoreCustomRoleAction({ roleId });
    setIsSubmitting(false);
    router.refresh();
  };

  const filteredRoles = roles.filter((r) => includeArchived || !r.isArchived);

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'ORGANIZATION': return IconBuildingSkyscraper;
      case 'PROPERTY': return IconBuildingStore;
      case 'DEPARTMENT': return IconUsers;
      case 'AREA_TEAM': return IconMapPin;
      case 'SELF': return IconUserCheck;
      default: return IconBuildingStore;
    }
  };

  const availableRoleOptions = [
    ...builtInTemplates.map((t) => ({ id: t.roleKey, name: t.displayName, isBuiltIn: true })),
    ...roles.filter((r) => !r.isArchived).map((r) => ({ id: r.id, name: r.name, isBuiltIn: false })),
  ];

  return (
    <div className="space-y-4">
      {/* List Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">Custom Tenant Roles</h3>
          <p className="text-xs text-zinc-500">Create, edit, and manage custom permission bundles for your team.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="text-xs text-zinc-600 flex items-center gap-1.5 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span>Show Archived ({roles.filter((r) => r.isArchived).length})</span>
          </label>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <IconPlus className="w-4 h-4" /> Create Custom Role
          </button>
        </div>
      </div>

      {/* Roles Cards Grid */}
      {filteredRoles.length === 0 ? (
        <div className="p-12 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
          <IconShield className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-zinc-700">No Custom Roles Found</h4>
          <p className="text-xs text-zinc-500 mt-1 mb-4">
            You have not created any custom roles yet. Built-in roles are active by default.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl inline-flex items-center gap-1.5"
          >
            <IconPlus className="w-4 h-4" /> Create First Custom Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((r) => {
            const ScopeIcon = getScopeIcon(r.defaultScope);

            return (
              <div
                key={r.id}
                className={`bg-white border rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between ${
                  r.isArchived ? 'border-zinc-200 bg-zinc-50/70 opacity-75' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                        r.isArchived
                          ? 'bg-zinc-200 text-zinc-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {r.isArchived ? 'Archived' : 'Active Custom Role'}
                    </span>

                    <span className="text-[10px] font-mono text-zinc-500">
                      ID: {r.id.slice(0, 8)}...
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-zinc-900 mb-1">{r.name}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-4 min-h-[36px]">
                    {r.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2 text-xs border-t border-zinc-100 pt-3 mb-4">
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Permissions:</span>
                      <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                        {r.permissions.length} keys
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Default Scope:</span>
                      <span className="font-semibold text-zinc-900 flex items-center gap-1">
                        <ScopeIcon className="w-3.5 h-3.5 text-emerald-600" />
                        {r.defaultScope}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Assigned Members:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {r.assignedMembersCount || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/access/roles/${r.id}`)}
                    className="p-1.5 text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                    title="View Role Details"
                  >
                    <IconEye className="w-4 h-4" />
                  </button>

                  {!r.isArchived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingRole(r)}
                        className="flex-1 py-1.5 px-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <IconEdit className="w-3.5 h-3.5" /> Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setArchivingRole(r)}
                        className="py-1.5 px-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <IconArchive className="w-3.5 h-3.5" /> Archive
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRestore(r.id)}
                      className="flex-1 py-1.5 px-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <IconEdit className="w-3.5 h-3.5" /> Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <RoleEditorModal
          mode="create"
          catalog={catalog}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(id) => {
            setShowCreateModal(false);
            if (id) router.push(`/dashboard/access/roles/${id}`);
            else router.refresh();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingRole && (
        <RoleEditorModal
          mode="edit"
          role={editingRole}
          catalog={catalog}
          onClose={() => setEditingRole(null)}
          onSuccess={() => {
            setEditingRole(null);
            router.refresh();
          }}
        />
      )}

      {/* Archive Modal */}
      {archivingRole && (
        <RoleArchiveModal
          role={archivingRole}
          availableRoles={availableRoleOptions}
          builtInTemplates={builtInTemplates}
          onClose={() => setArchivingRole(null)}
          onSuccess={() => {
            setArchivingRole(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RoleCreationWizard } from '@/components/team/role-creation-wizard';
import { FormattedCustomRole, FormattedPermission } from '@/server/services/permission.service';
import { createCustomRoleAction, updateCustomRoleAction } from '@/server/actions/permission';
import { PermissionKey } from '@/lib/validation/permission';

interface RolesManagementProps {
  catalog: FormattedPermission[];
  initialCustomRoles: FormattedCustomRole[];
  userRole: string;
}

export function RolesManagement({
  catalog,
  initialCustomRoles,
  userRole,
}: RolesManagementProps) {
  const [roles, setRoles] = useState<FormattedCustomRole[]>(initialCustomRoles);
  const [activeTab, setActiveTab] = useState<'custom' | 'builtin'>('custom');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<FormattedCustomRole | null>(null);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);

  const isOwner = userRole === 'business_owner';

  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: FormattedCustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedPermissions(role.permissions);
    setIsModalOpen(true);
  };

  const handleOpenClone = (role: FormattedCustomRole) => {
    setEditingRole(null);
    setRoleName(`${role.name} (Copy)`);
    setRoleDescription(role.description || '');
    setSelectedPermissions([...role.permissions]);
  };

  // Built-in Role Definitions for Display
  const builtInTemplates = [
    {
      name: 'Business Owner',
      description: 'Full un-deniable owner authority across all business modules, settings, and branches.',
      roleKey: 'business_owner',
      permissionsCount: catalog.length,
    },
    {
      name: 'Branch Manager',
      description: 'Operational manager with branch-scoped management permissions for orders, kitchen, cashier, and staff.',
      roleKey: 'branch_manager',
      permissionsCount: catalog.filter((c) => !['business.settings.manage', 'owner.transfer', 'branches.manage'].includes(c.key)).length,
    },
    {
      name: 'Cashier',
      description: 'Front-of-house billing terminal access, order tracking, payment recording, and receipt printing.',
      roleKey: 'cashier',
      permissionsCount: 9,
    },
    {
      name: 'Kitchen Staff',
      description: 'Back-of-house ticket display queue access and kitchen order preparation status updates.',
      roleKey: 'kitchen_staff',
      permissionsCount: 3,
    },
    {
      name: 'Waiter',
      description: 'Guest table service requests, assistance management, and menu/table visibility.',
      roleKey: 'waiter',
      permissionsCount: 5,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Roles & Granular Permissions</h1>
          <p className="text-xs text-zinc-500">
            Define custom staff roles, configure granular permission matrices, and manage role templates.
          </p>
        </div>

        {isOwner && (
          <Button variant="primary" onClick={handleOpenCreate} className="flex items-center gap-2">
            <span>➕</span> Create Custom Role
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('custom')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'custom'
              ? 'border-zinc-950 text-zinc-950'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Custom Roles ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('builtin')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'builtin'
              ? 'border-zinc-950 text-zinc-950'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Built-in Role Templates ({builtInTemplates.length})
        </button>
      </div>

      {/* CUSTOM ROLES TAB */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {roles.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-500 text-xs space-y-2 shadow-sm">
              <div className="text-3xl mb-2">🛡️</div>
              <div>No custom roles created for your business yet.</div>
              {isOwner && (
                <div className="text-[11px] text-zinc-400">
                  Click <strong>Create Custom Role</strong> to define roles like Supervisor, Bar Staff, or Floor Manager.
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-zinc-950">{role.name}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30">
                        Custom Role
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-zinc-500">{role.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-500 text-[11px]">
                      {role.permissions.length} Permissions Assigned
                    </span>

                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenClone(role)}
                          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
                        >
                          Clone
                        </button>
                        <button
                          onClick={() => handleOpenEdit(role)}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          Edit Permissions
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUILT-IN TEMPLATES TAB */}
      {activeTab === 'builtin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {builtInTemplates.map((tpl) => (
            <div
              key={tpl.roleKey}
              className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-950">{tpl.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                    Built-in Template
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{tpl.description}</p>
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-500 text-[11px]">
                  ~{tpl.permissionsCount} Permissions Included
                </span>

                {isOwner && (
                  <button
                    onClick={() => {
                      setEditingRole(null);
                      setRoleName(`Custom ${tpl.name}`);
                      setRoleDescription(`Customized role based on ${tpl.name} template.`);
                      setSelectedPermissions([]);
                      setIsModalOpen(true);
                    }}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Clone Template
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT CUSTOM ROLE WIZARD */}
      <RoleCreationWizard
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        catalog={catalog}
        editingRoleName={roleName}
        editingRoleDescription={roleDescription}
        initialPermissions={selectedPermissions}
        isEditing={!!editingRole}
        onSave={async (name, description, perms) => {
          if (editingRole) {
            const res = await updateCustomRoleAction({
              roleId: editingRole.id,
              name,
              description,
              permissions: perms,
            });
            if (res.success) {
              setRoles((prev) =>
                prev.map((r) =>
                  r.id === editingRole.id
                    ? { ...r, name, description, permissions: perms }
                    : r
                )
              );
            } else {
              throw new Error(res.message || 'Failed to update custom role');
            }
          } else {
            const res = await createCustomRoleAction({
              name,
              description,
              permissions: perms,
            });
            const newRoleData = res.data;
            if (res.success && newRoleData) {
              setRoles((prev) => [
                ...prev,
                {
                  id: newRoleData.id,
                  businessId: newRoleData.businessId,
                  name,
                  roleKey: newRoleData.roleKey || name.toLowerCase().replace(/\s+/g, '_'),
                  description,
                  is_custom: true,
                  isActive: true,
                  permissions: perms,
                  user_count: 0,
                  createdBy: newRoleData.createdBy || '',
                  createdAt: new Date().toISOString(),
                },
              ]);
            } else {
              throw new Error(res.message || 'Failed to create custom role');
            }
          }
        }}
      />
    </div>
  );
}

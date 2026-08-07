import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import { RolesManagement } from '@/components/team/roles-management';

export const metadata: Metadata = {
  title: 'Roles & Permissions | WSNexa Business',
  description: 'Manage custom roles and granular permission matrices for your business',
};

export default async function TeamRolesPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, membership } = context;

  const [catalog, customRoles] = await Promise.all([
    PermissionService.listPermissionCatalog(),
    PermissionService.listCustomRoles(business.id),
  ]);

  return (
    <RolesManagement
      catalog={catalog}
      initialCustomRoles={customRoles}
      userRole={membership.role}
    />
  );
}

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { StructureManagementClient } from '@/components/organization/structure-management-client';

export const metadata: Metadata = {
  title: 'Organization Structure & Units | WSNexa',
  description: 'Manage corporate departments, property departments, divisions, and operational stations',
};

export default async function OrganizationStructurePage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization/structure');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch, branches } = context;

  const [departments, units, canManage] = await Promise.all([
    OrganizationService.getDepartments(business.id),
    OrganizationService.getOrganizationUnits(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'organization.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <StructureManagementClient
        departments={departments}
        units={units}
        branches={branches}
        canManage={canManage}
      />
    </div>
  );
}

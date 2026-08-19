import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { PositionsClient, PositionRow } from '@/components/organization/positions-client';

export const metadata: Metadata = {
  title: 'Positions & Headcount | WSNexa',
  description: 'Manage position slots, headcount capacities, substantive occupancy, and acting coverage',
};

export default async function PositionsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization/positions');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch, branches } = context;

  const [positionsWithCoverage, jobTitles, departments, units, canManage] = await Promise.all([
    OrganizationService.listAllPositionsWithCoverage(business.id),
    OrganizationService.getJobTitles(business.id),
    OrganizationService.getDepartments(business.id),
    OrganizationService.getOrganizationUnits(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'positions.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PositionsClient
        positions={positionsWithCoverage as unknown as PositionRow[]}
        jobTitles={jobTitles}
        branches={branches}
        departments={departments}
        units={units}
        canManage={canManage}
        activeBranchId={activeBranch?.id ?? null}
      />
    </div>
  );
}

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { PeopleDirectoryClient, StaffRow } from '@/components/organization/people-directory-client';

export const metadata: Metadata = {
  title: 'People Directory | WSNexa',
  description: 'Enterprise staff directory, primary assignments, reporting relationships, and coverage',
};

export default async function PeopleDirectoryPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/people');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch, branches } = context;

  const [staffList, departments, jobTitles, canManage] = await Promise.all([
    OrganizationService.listOrganizationStaff(business.id),
    OrganizationService.getDepartments(business.id),
    OrganizationService.getJobTitles(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'people.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PeopleDirectoryClient
        staff={staffList as unknown as StaffRow[]}
        branches={branches}
        departments={departments}
        jobTitles={jobTitles}
        canManage={canManage}
      />
    </div>
  );
}

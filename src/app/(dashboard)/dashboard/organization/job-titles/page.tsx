import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PermissionService } from '@/server/services/permission.service';
import { JobTitlesClient, JobTitleData } from '@/components/organization/job-titles-client';

export const metadata: Metadata = {
  title: 'Job Titles & Hierarchy | WSNexa',
  description: 'Enterprise job titles, management classification, and seniority hierarchy ranks',
};

export default async function JobTitlesPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/organization/job-titles');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, user, activeBranch } = context;

  const [hierarchyLevels, jobTitles, canManage] = await Promise.all([
    OrganizationService.getHierarchyLevels(business.id),
    OrganizationService.getJobTitles(business.id),
    PermissionService.hasPermission(user.id, business.id, activeBranch?.id || null, 'organization.manage'),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <JobTitlesClient
        hierarchyLevels={hierarchyLevels}
        jobTitles={jobTitles as unknown as JobTitleData[]}
        canManage={canManage}
      />
    </div>
  );
}

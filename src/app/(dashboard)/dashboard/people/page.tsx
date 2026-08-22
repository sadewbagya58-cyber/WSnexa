import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { PeopleDirectoryClient, StaffRow } from '@/components/organization/people-directory-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { can, resolveAuthorizationContext } from '@/server/auth';

import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = {
  title: 'People Directory | WSNexa',
  description: 'Enterprise staff directory, primary assignments, reporting relationships, and coverage',
};

interface PeopleDirectoryPageProps {
  searchParams?: Promise<{
    branch?: string;
    dept?: string;
    job?: string;
    search?: string;
    type?: string;
  }>;
}

export default async function PeopleDirectoryPage({ searchParams }: PeopleDirectoryPageProps) {
  const { allowed, context } = await requireRoutePermission('/dashboard/people');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, activeBranch, branches, membership } = context;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>> | null = null;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    authContext = null;
  }

  const isOwner = authContext ? authContext.isBusinessOwner : membership?.role === 'business_owner';
  let allowedBranchIds: string[] | null = null;
  let canViewAllProperties = isOwner;

  if (!isOwner) {
    const admin = createAdminClient();
    const { data: userBranchAssignments } = await admin
      .from('branch_assignments')
      .select('branch_id')
      .eq('business_membership_id', membership.id);

    const assignedBranchIds = (userBranchAssignments || []).map((ba) => ba.branch_id);
    allowedBranchIds = assignedBranchIds;
    if (branches.length > 0 && assignedBranchIds.length >= branches.length) {
      canViewAllProperties = true;
    }
  }

  // Authoritative default branch resolution:
  const activeBranchId = activeBranch?.id || (branches.length > 0 ? branches[0].id : 'corporate');
  let effectiveBranch = resolvedSearchParams.branch;

  if (!effectiveBranch) {
    effectiveBranch = activeBranchId;
  } else if (effectiveBranch === 'all') {
    if (!canViewAllProperties) {
      effectiveBranch = activeBranchId;
    }
  } else if (effectiveBranch !== 'corporate' && effectiveBranch !== 'unassigned') {
    if (allowedBranchIds && !allowedBranchIds.includes(effectiveBranch)) {
      effectiveBranch = activeBranchId;
    }
  }

  let canManage = false;
  if (authContext) {
    canManage = await can({ context: authContext, permission: 'people.manage' });
  }

  const [staffList, departments, jobTitles] = await Promise.all([
    OrganizationService.listOrganizationStaff(business.id, {
      branchId: effectiveBranch,
      allowedBranchIds,
      departmentId: resolvedSearchParams.dept,
      jobTitleId: resolvedSearchParams.job,
      search: resolvedSearchParams.search,
    }),
    OrganizationService.getDepartments(business.id),
    OrganizationService.getJobTitles(business.id),
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="People Directory"
        description="Employee records, primary department placements, job titles, and position assignments."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'People Directory' },
        ]}
      />

      <PeopleDirectoryClient
        staff={staffList as unknown as StaffRow[]}
        branches={branches}
        departments={departments}
        jobTitles={jobTitles}
        canManage={canManage}
        initialBranch={effectiveBranch}
        activeBranchId={activeBranch?.id || null}
        canViewAllProperties={canViewAllProperties}
      />
    </div>
  );
}

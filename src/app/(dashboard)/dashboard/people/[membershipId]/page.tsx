import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { OrganizationService } from '@/server/services/organization.service';
import { MemberProfileClient } from '@/components/organization/member-profile-client';
import { createAdminClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Member Organization Profile | WSNexa',
  description: 'Comprehensive staff profile, assignment history, reporting chains, and temporary deployments',
};

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;

  const { allowed, context } = await requireRoutePermission(`/dashboard/people/${membershipId}`);
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, branches } = context;
  const admin = createAdminClient();

  // 1. Fetch business membership
  const { data: memberData, error: memErr } = await admin
    .from('business_memberships')
    .select(`
      id,
      user_id,
      role,
      membership_status
    `)
    .eq('id', membershipId)
    .eq('business_id', business.id)
    .single();

  if (memErr || !memberData) {
    notFound();
  }

  const { data: userProfile } = await admin
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', memberData.user_id)
    .maybeSingle();

  const fullName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'Staff Member';

  // 2. Fetch profile details
  const [profile, history] = await Promise.all([
    OrganizationService.getMemberOrganizationProfile(membershipId),
    OrganizationService.getMemberAssignmentHistory(membershipId),
  ]);

  const assignmentIds = (history || []).map((h) => h.id);

  // Fetch absences and event history
  const [absencesRes, eventsRes] = await Promise.all([
    assignmentIds.length > 0
      ? admin.from('organization_assignment_absences').select('*').in('assignment_id', assignmentIds).order('starts_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? admin.from('organization_assignment_history').select('*').in('assignment_id', assignmentIds).order('changed_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const absencesData = absencesRes.data || [];
  const eventsData = eventsRes.data || [];

  const pAssignId = profile.primaryAssignment?.id;

  const [
    effectiveManager,
    directReports,
    effectiveDirectReports,
    reportingChain,
    effectiveReportingChain,
    departments,
    units,
    jobTitles,
    positions,
    allStaff,
    canManage,
  ] = await Promise.all([
    pAssignId ? OrganizationService.resolveEffectiveManager(pAssignId) : Promise.resolve(null),
    pAssignId ? OrganizationService.getDirectReports(pAssignId) : Promise.resolve([]),
    pAssignId ? OrganizationService.getEffectiveDirectReports(pAssignId) : Promise.resolve([]),
    pAssignId ? OrganizationService.getReportingChain(pAssignId) : Promise.resolve([]),
    pAssignId ? OrganizationService.getEffectiveReportingChain(pAssignId) : Promise.resolve([]),
    OrganizationService.getDepartments(business.id),
    OrganizationService.getOrganizationUnits(business.id),
    OrganizationService.getJobTitles(business.id),
    OrganizationService.getPositions(business.id),
    OrganizationService.listOrganizationStaff(business.id),
    (async () => {
      const { can, resolveAuthorizationContext } = await import('@/server/auth');
      const authContext = await resolveAuthorizationContext();
      return authContext ? can({ context: authContext, permission: 'people.manage' }) : false;
    })(),
  ]);

  const potentialManagers = allStaff
    .filter((s) => s.membershipId !== membershipId && s.primaryAssignment)
    .map((s) => {
      const jt = (Array.isArray(s.primaryAssignment?.job_title) ? s.primaryAssignment?.job_title[0] : s.primaryAssignment?.job_title) as { name?: string } | null;
      return {
        id: s.primaryAssignment!.id,
        fullName: s.fullName,
        title: jt?.name || 'Manager',
      };
    });

  const allActiveAssignmentsToCover = allStaff
    .filter((s) => s.primaryAssignment)
    .map((s) => {
      const jt = (Array.isArray(s.primaryAssignment?.job_title) ? s.primaryAssignment?.job_title[0] : s.primaryAssignment?.job_title) as { name?: string } | null;
      const br = (Array.isArray(s.primaryAssignment?.branch) ? s.primaryAssignment?.branch[0] : s.primaryAssignment?.branch) as { name?: string } | null;
      return {
        id: s.primaryAssignment!.id,
        holderName: s.fullName,
        jobTitleName: jt?.name || 'Position',
        branchName: br?.name,
      };
    });

  const profileForClient = {
    assignments: history || [],
    substantivePrimary: profile.primaryAssignment || null,
    actingAssignments: profile.actingAssignments || [],
    secondments: profile.secondmentAssignments || [],
    temporaryAssignments: profile.temporaryAssignments || [],
    absences: absencesData,
    eventHistory: eventsData,
    diagnostics: profile.organizationBranchAccessMismatch
      ? [
          {
            id: 'branch-mismatch',
            type: 'branch_access_mismatch',
            severity: 'warning' as const,
            message: 'Staff member is assigned to a branch without corresponding branch access permissions.',
          },
        ]
      : [],
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <MemberProfileClient
        membershipId={membershipId}
        member={{
          id: memberData.id,
          userId: memberData.user_id,
          fullName,
          role: memberData.role,
          membershipStatus: memberData.membership_status,
        }}
        profile={profileForClient as unknown as Parameters<typeof MemberProfileClient>[0]['profile']}
        effectiveManager={effectiveManager as unknown as Parameters<typeof MemberProfileClient>[0]['effectiveManager']}
        directReports={directReports as unknown as Parameters<typeof MemberProfileClient>[0]['directReports']}
        effectiveDirectReports={effectiveDirectReports as unknown as Parameters<typeof MemberProfileClient>[0]['effectiveDirectReports']}
        reportingChain={reportingChain as unknown as Parameters<typeof MemberProfileClient>[0]['reportingChain']}
        effectiveReportingChain={effectiveReportingChain as unknown as Parameters<typeof MemberProfileClient>[0]['effectiveReportingChain']}
        branches={branches}
        departments={departments}
        units={units}
        jobTitles={jobTitles}
        positions={positions}
        potentialManagers={potentialManagers}
        allActiveAssignmentsToCover={allActiveAssignmentsToCover}
        canManage={canManage}
      />
    </div>
  );
}

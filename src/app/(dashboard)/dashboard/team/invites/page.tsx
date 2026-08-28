import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffInvitationService } from '@/server/services/staff-invitation.service';
import { StaffInvitesManagement } from '@/components/team/staff-invites-management';
import { TeamSubNav } from '@/components/team/team-subnav';

export const metadata: Metadata = {
  title: 'Staff Invitations | WSNexa Business',
  description: 'Manage secure manager and staff invitation codes for your active business',
};

import { ServiceAreaService } from '@/server/services/service-area.service';
import { RoleGovernanceService } from '@/server/services/role-governance.service';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

import { OrganizationService } from '@/server/services/organization.service';

export default async function StaffInvitesPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/team/invites');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, membership, branches, activeBranch } = context;

  const [invitations, rawCustomRoles, rawDepartments, rawPositions] = await Promise.all([
    StaffInvitationService.listInvitations(business.id, activeBranch?.id),
    RoleGovernanceService.listCustomRoles(business.id, { includeArchived: false }),
    OrganizationService.getDepartments(business.id),
    OrganizationService.listAllPositionsWithCoverage(business.id),
  ]);

  const customRoles = rawCustomRoles
    .filter((r) => r.isActive && !r.isArchived)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      defaultScope: r.defaultScope,
      maxScope: r.maxScope,
    }));

  const departments = (rawDepartments || []).map((d) => ({
    id: d.id,
    name: d.name,
    branchId: d.branch_id,
  }));

  const formattedBranches = branches.map((b: { id: string; name: string; isDefault: boolean }) => ({
    id: b.id,
    name: b.name,
    isDefault: b.isDefault,
  }));

  const targetBranchId = activeBranch?.id || branches[0]?.id;
  const rawAreas = targetBranchId
    ? await ServiceAreaService.listBranchAreas(business.id, targetBranchId)
    : [];

  const branchAreas = rawAreas.map((a) => ({
    id: a.id,
    branchId: a.branchId,
    name: a.name,
    code: a.code,
  }));

  const positions = (rawPositions || []).map((p) => {
    const jt = p.job_title as { id?: string; name?: string; code?: string } | null;
    const dept = p.department as { id?: string; name?: string; code?: string } | null;
    const unit = p.unit as { id?: string; name?: string; code?: string } | null;
    const br = p.branch as { id?: string; name?: string; code?: string } | null;

    return {
      id: p.id,
      positionCode: p.position_code || null,
      nameOverride: p.name_override || null,
      jobTitleId: p.job_title_id,
      jobTitleName: jt?.name || 'Position',
      jobTitleCode: jt?.code || null,
      branchId: p.branch_id || null,
      branchName: br?.name || null,
      departmentId: p.department_id || null,
      departmentName: dept?.name || null,
      unitId: p.unit_id || null,
      unitName: unit?.name || null,
      headcountLimit: p.headcount_limit || 1,
      occupiedCount: p.occupiedCount || 0,
      availableSlots: p.availableSlots || 0,
      isFull: p.isFull || false,
      status: p.status,
      isActive: p.is_active,
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <TeamSubNav />
      <StaffInvitesManagement
        branches={formattedBranches}
        branchAreas={branchAreas}
        departments={departments}
        positions={positions}
        customRoles={customRoles}
        initialInvitations={invitations}
        userRole={membership.role}
        activeBranchId={targetBranchId}
      />
    </div>
  );
}

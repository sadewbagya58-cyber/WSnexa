import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffInvitationService } from '@/server/services/staff-invitation.service';
import { StaffInvitesManagement } from '@/components/team/staff-invites-management';

export const metadata: Metadata = {
  title: 'Staff Invitations | WSNexa Business',
  description: 'Manage secure manager and staff invitation codes for your active business',
};

import { ServiceAreaService } from '@/server/services/service-area.service';
import { RoleGovernanceService } from '@/server/services/role-governance.service';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function StaffInvitesPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/team/invites');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, membership, branches, activeBranch } = context;

  const [invitations, rawCustomRoles] = await Promise.all([
    StaffInvitationService.listInvitations(business.id, activeBranch?.id),
    RoleGovernanceService.listCustomRoles(business.id, { includeArchived: false }),
  ]);

  const customRoles = rawCustomRoles
    .filter((r) => r.isActive && !r.isArchived)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
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

  return (
    <StaffInvitesManagement
      branches={formattedBranches}
      branchAreas={branchAreas}
      customRoles={customRoles}
      initialInvitations={invitations}
      userRole={membership.role}
      activeBranchId={activeBranch?.id}
    />
  );
}

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffInvitationService } from '@/server/services/staff-invitation.service';
import { StaffInvitesManagement } from '@/components/team/staff-invites-management';

export const metadata: Metadata = {
  title: 'Staff Invitations | WSNexa Business',
  description: 'Manage secure manager and staff invitation codes for your active business',
};

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

  const { business, membership, branches } = context;

  const invitations = await StaffInvitationService.listInvitations(business.id);

  const formattedBranches = branches.map((b: { id: string; name: string; isDefault: boolean }) => ({
    id: b.id,
    name: b.name,
    isDefault: b.isDefault,
  }));

  return (
    <StaffInvitesManagement
      branches={formattedBranches}
      initialInvitations={invitations}
      userRole={membership.role}
    />
  );
}

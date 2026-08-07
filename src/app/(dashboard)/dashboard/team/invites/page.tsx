import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { StaffInvitationService } from '@/server/services/staff-invitation.service';
import { StaffInvitesManagement } from '@/components/team/staff-invites-management';

export const metadata: Metadata = {
  title: 'Staff Invitations | WSNexa Business',
  description: 'Manage secure manager and staff invitation codes for your active business',
};

export default async function StaffInvitesPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    redirect('/login');
  }

  const { business, membership, branches } = context;

  const invitations = await StaffInvitationService.listInvitations(business.id);

  const formattedBranches = branches.map((b) => ({
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

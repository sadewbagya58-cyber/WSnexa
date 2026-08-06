import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const { user, profile, business, activeBranch, branches, membership } = context;
  const userName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : '';

  return (
    <DashboardShell
      businessName={business.name}
      activeBranch={activeBranch}
      branches={branches}
      userEmail={user.email || ''}
      userName={userName || user.email || ''}
      userRole={membership.role}
    >
      {children}
    </DashboardShell>
  );
}

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
  if (!context || !context.defaultBranch) {
    redirect('/login');
  }

  const { user, profile, business, defaultBranch, membership } = context;
  const userName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : '';

  return (
    <DashboardShell
      businessName={business.name}
      branchName={defaultBranch.name}
      userEmail={user.email || ''}
      userName={userName || user.email || ''}
      userRole={membership.role}
    >
      {children}
    </DashboardShell>
  );
}

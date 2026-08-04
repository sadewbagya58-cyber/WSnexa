import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single();

  const userName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';

  return (
    <DashboardShell
      businessName={context.business.name}
      branchName={context.defaultBranch.name}
      userEmail={user.email || ''}
      userName={userName || user.email || ''}
      userRole={context.membership.role}
    >
      {children}
    </DashboardShell>
  );
}

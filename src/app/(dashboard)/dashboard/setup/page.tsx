import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { SetupJourneyService } from '@/server/setup/setup-journey.service';
import { SetupJourneyView } from '@/components/setup/setup-journey-view';

export const metadata: Metadata = {
  title: 'Guided Business Setup | WSNexa Dashboard',
  description: 'Step-by-step onboarding and setup progress for your hospitality business',
};

export default async function SetupDashboardPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const report = await SetupJourneyService.resolveSetupJourney(
    tenantContext.business.id,
    tenantContext.activeBranch
  );

  return <SetupJourneyView report={report} />;
}
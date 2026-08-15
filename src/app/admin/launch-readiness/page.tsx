import React from 'react';
import { LaunchReadinessService } from '@/server/services/launch-readiness.service';
import { LaunchReadinessClient } from './launch-readiness-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Launch Readiness — Super Admin | WSNexa',
  description: 'Platform health diagnostics, RLS security audit, system metrics, and pilot onboarding portal.',
};

export default async function AdminLaunchReadinessPage() {
  const initialReport = await LaunchReadinessService.getHealthReport();
  return <LaunchReadinessClient initialReport={initialReport} />;
}

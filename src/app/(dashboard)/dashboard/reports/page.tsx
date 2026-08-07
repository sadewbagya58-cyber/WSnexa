import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

export const metadata: Metadata = {
  title: 'Reports & Analytics | WSNexa POS',
  description: 'Real-time sales summary, revenue trend, kitchen efficiency, and multi-dimension reporting',
};

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function ReportsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/reports');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      <ReportsDashboard />
    </div>
  );
}

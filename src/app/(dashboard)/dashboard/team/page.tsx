import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export const metadata = {
  title: 'Staff Directory | WSNexa Business',
  description: 'Manage staff members, roles, permission overrides, and account authorization',
};

export default async function TeamDirectoryPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/team');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  // Canonical redirection to unified authoritative People / Staff Directory
  redirect('/dashboard/people');
}

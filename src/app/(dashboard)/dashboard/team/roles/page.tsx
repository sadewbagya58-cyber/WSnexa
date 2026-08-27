import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export const metadata = {
  title: 'Roles & Permissions | WSNexa Business',
  description: 'Manage custom roles and granular permission matrices for your business',
};

export default async function TeamRolesPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/team/roles');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }
  if (!context || !context.business) {
    redirect('/login');
  }

  // Canonical redirection to unified Phase 30 RBAC v2 governance surface
  redirect('/dashboard/access/roles');
}

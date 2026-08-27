import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AreaManager } from '@/components/table/area-manager';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';

export default async function ServiceAreasPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/tables/areas');
  if (!allowed) {
    return (
      <AccessDenied
        workspaceRoute={resolveDefaultWorkspaceRoute(
          context?.membership?.role,
          context?.membership?.customRoleId
        )}
      />
    );
  }

  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  let canManage = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const branchResource = {
        resourceType: 'branch' as const,
        resourceId: context.activeBranch.id,
        businessId: context.business.id,
        branchId: context.activeBranch.id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      canManage =
        (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
        (await can({ context: authContext, permission: 'tables.manage', resource: branchResource })) ||
        authContext.isBusinessOwner;
    }
  } catch {
    canManage = context.membership?.role === 'business_owner';
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code, description, display_order, is_active')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Areas"
        description={`Organize dining tables by hall, floor, terrace, or service zone in ${context.activeBranch.name}.`}
        breadcrumbs={[{ label: 'Tables', href: '/dashboard/tables' }, { label: 'Service Areas' }]}
        backHref="/dashboard/tables"
      />

      <AreaManager initialAreas={areas || []} canManage={canManage} />
    </div>
  );
}

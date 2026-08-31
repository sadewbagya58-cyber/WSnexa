import { redirect } from 'next/navigation';
import { ServiceAreaService } from '@/server/services/service-area.service';
import { AreaManagement } from '@/components/area/area-management';
import { createClient } from '@/lib/supabase/server';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';

export default async function ServiceAreasPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/areas');
  if (!allowed) {
    return (
      <AccessDenied
        workspaceRoute={resolveDefaultWorkspaceRoute(
          tenantContext?.membership?.role,
          tenantContext?.membership?.customRoleId
        )}
      />
    );
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  let canManage = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const branchResource = {
        resourceType: 'branch' as const,
        resourceId: tenantContext.activeBranch.id,
        businessId: tenantContext.business.id,
        branchId: tenantContext.activeBranch.id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      const canManageAreas =
        (await can({ context: authContext, permission: 'areas.manage', resource: branchResource })) ||
        (await can({ context: authContext, permission: 'tables.manage', resource: branchResource }));
      canManage = canManageAreas || authContext.isBusinessOwner;
    }
  } catch {
    canManage = tenantContext.membership?.role === 'business_owner';
  }

  const areas = await ServiceAreaService.listBranchAreas(
    tenantContext.business.id,
    tenantContext.activeBranch.id
  );

  const supabase = await createClient();
  const { data: branchData } = await supabase
    .from('branches')
    .select('ordering_mode')
    .eq('id', tenantContext.activeBranch.id)
    .single();

  const orderingMode =
    (branchData?.ordering_mode as 'qr_only' | 'waiter_only' | 'qr_and_waiter') || 'qr_and_waiter';

  return (
    <AreaManagement
      initialAreas={areas}
      businessName={tenantContext.business.name}
      activeBranchName={tenantContext.activeBranch.name}
      branchCode={tenantContext.activeBranch.code}
      initialOrderingMode={orderingMode}
      canManage={canManage}
    />
  );
}

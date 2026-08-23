import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ServiceAreaService } from '@/server/services/service-area.service';
import { MenuCatalogService } from '@/server/services/menu-catalog.service';
import { WaiterOrderBuilder } from '@/components/waiter/waiter-order-builder';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function WaiterOrderPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/waiter/order');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) {
    redirect('/login');
  }

  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  let canCreateOrders = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const branchResource = {
        resourceType: 'branch' as const,
        resourceId: branchId,
        businessId,
        branchId,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };

      const [canWaiterCreate, canGeneralCreate] = await Promise.all([
        can({ context: authContext, permission: 'waiter.orders.create', resource: branchResource }),
        can({ context: authContext, permission: 'orders.create', resource: branchResource }),
      ]);

      canCreateOrders = canWaiterCreate || canGeneralCreate || authContext.isBusinessOwner;
    }
  } catch {
    canCreateOrders = tenantContext.membership?.role === 'business_owner';
  }

  const supabase = await createClient();

  // Fetch areas
  let areas = await ServiceAreaService.listBranchAreas(businessId, branchId);

  // If user is waiter role, filter to assigned areas
  if (tenantContext.membership.role === 'waiter') {
    const assignedIds = await ServiceAreaService.getStaffAssignedAreaIds(tenantContext.membership.id);
    if (assignedIds.length > 0) {
      areas = areas.filter((a) => assignedIds.includes(a.id));
    }
  }

  // Fetch dining tables for active branch
  const { data: tablesData } = await supabase
    .from('dining_tables')
    .select('id, name, table_number, service_area_id')
    .eq('business_id', businessId)
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  const tables = (tablesData || []).map((t) => ({
    id: t.id,
    name: t.name,
    tableNumber: t.table_number,
    serviceAreaId: t.service_area_id,
  }));

  // Fetch canonical branch menu catalog from MenuCatalogService
  const catalog = await MenuCatalogService.getBranchMenuCatalog(businessId, branchId);

  if (!catalog) {
    redirect('/dashboard');
  }

  const waiterName = tenantContext.user.email ? tenantContext.user.email.split('@')[0] : 'Staff';

  return (
    <WaiterOrderBuilder
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      tables={tables}
      catalog={catalog}
      businessId={businessId}
      activeBranchId={branchId}
      userId={tenantContext.user.id}
      activeBranchName={tenantContext.activeBranch.name}
      waiterName={waiterName}
      canCreateOrders={canCreateOrders}
    />
  );
}

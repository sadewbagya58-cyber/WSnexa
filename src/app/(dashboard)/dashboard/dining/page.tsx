import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QrService } from '@/server/services/qr.service';
import { DiningSetupWorkspace } from '@/components/dining/dining-setup-workspace';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dining Setup Workspace | WSNexa',
  description: 'Consolidated setup workspace for service areas, dining tables, bulk table generation, and QR cards.',
};

export default async function DiningSetupPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/dining');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext || !tenantContext.activeBranch) redirect('/login');

  const supabase = await createClient();
  const businessId = tenantContext.business.id;
  const branchId = tenantContext.activeBranch.id;

  // 1. Fetch Service Areas for active branch
  const { data: serviceAreas } = await supabase
    .from('service_areas')
    .select('id, name, code, description, display_order, is_active, deleted_at')
    .eq('business_id', businessId)
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // 2. Fetch Dining Tables for active branch
  const { data: diningTables } = await supabase
    .from('dining_tables')
    .select('id, name, code, table_number, capacity, status, shape, service_area_id, is_active, table_pin_hash, deleted_at')
    .eq('business_id', businessId)
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // 3. Fetch Active Branch QR record & PIN summary
  const activeQr = await QrService.getActiveBranchQr();

  const total = diningTables?.length || 0;
  const withPin = diningTables?.filter((t) => t.table_pin_hash !== null).length || 0;
  const missingPin = total - withPin;

  let canManage = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      const canManageTables = await can({
        context: authContext,
        permission: 'tables.manage',
        resource: {
          resourceType: 'branch',
          resourceId: branchId,
          businessId,
          branchId,
          departmentId: null,
          organizationUnitId: null,
          serviceAreaId: null,
          ownerUserId: null,
        },
      });
      canManage = canManageTables || authContext.isBusinessOwner;
    }
  } catch {
    canManage = tenantContext.membership?.role === 'business_owner';
  }

  return (
    <DiningSetupWorkspace
      businessName={tenantContext.business.name}
      branchName={tenantContext.activeBranch.name}
      branchCode={tenantContext.activeBranch.code}
      canManage={canManage}
      serviceAreas={(serviceAreas || []).map((a) => ({
        ...a,
        tables_count: (diningTables || []).filter((t) => t.service_area_id === a.id).length,
      }))}
      tables={diningTables || []}
      branchQr={activeQr}
      requireTableSelection={tenantContext.activeBranch.require_table_selection ?? true}
      requireTablePin={tenantContext.activeBranch.require_table_pin ?? false}
      tablePinLength={tenantContext.activeBranch.table_pin_length ?? 4}
      tablesSummary={{ total, withPin, missingPin }}
    />
  );
}

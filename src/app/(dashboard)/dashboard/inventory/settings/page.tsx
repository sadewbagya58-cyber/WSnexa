import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { InventorySettingsClient } from '@/components/inventory/inventory-settings-client';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { resolveInventorySubNavPermissions } from '@/server/inventory/inventory-nav-permissions';
import { resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Inventory & Recipe Settings | WSNexa POS',
  description: 'Configure automated stock deduction timing, costing methods, discrepancy tolerances, and auto sold-out behaviors',
};

export default async function InventorySettingsPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/settings');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role, context?.membership?.customRoleId)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>> | null = null;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  const navPermissions = await resolveInventorySubNavPermissions(
    authContext,
    context.activeBranch.id,
    context.business.id
  );

  if (!navPermissions.canViewSettings) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context.membership?.role, context.membership?.customRoleId)} />;
  }

  const admin = createAdminClient();

  // Fetch branch locations
  const { data: rawLocations } = await admin
    .from('inventory_storage_locations')
    .select('id, name')
    .eq('branch_id', context.activeBranch.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  const locations = (rawLocations || []).map((l) => ({ id: l.id, name: l.name }));

  // Fetch settings
  const { data: settings } = await admin
    .from('inventory_settings')
    .select('*')
    .eq('business_id', context.business.id)
    .or(`branch_id.eq.${context.activeBranch.id},branch_id.is.null`)
    .order('branch_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const initialSettings = {
    deductionTiming: (settings?.deduction_timing || 'preparing') as 'confirmed' | 'preparing' | 'served' | 'completed',
    costingMethod: (settings?.costing_method || 'weighted_average') as 'weighted_average' | 'latest_cost',
    autoSoldOutMode: (settings?.auto_sold_out_mode || 'warn_only') as 'warn_only' | 'suggest_sold_out' | 'auto_mark_sold_out',
    receivingTolerancePercent: Number(settings?.receiving_tolerance_percent) || 10.0,
    defaultConsumptionLocationId: settings?.default_consumption_location_id || null,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Recipe Settings"
        description={`Customize stock deduction stages, valuation rules, and replenishment thresholds for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Settings' },
        ]}
        helpSlug="automatic-stock-deduction-timing"
      />

      <InventorySubNav {...navPermissions} />

      <InventorySettingsClient
        branchId={context.activeBranch.id}
        locations={locations}
        initialSettings={initialSettings}
      />
    </div>
  );
}

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { PurchaseOrderBuilder } from '@/components/inventory/purchase-order-builder';

export const metadata: Metadata = {
  title: 'Create Purchase Order | WSNexa Inventory',
  description: 'Procure ingredients from suppliers, set expected delivery dates, and configure order lines',
};

export default async function NewPurchaseOrderPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  const admin = createAdminClient();

  // 1. Fetch suppliers
  const { data: rawSuppliers } = await admin
    .from('inventory_suppliers')
    .select('id, name')
    .eq('business_id', context.business.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const suppliers = (rawSuppliers || []).map((s) => ({ id: s.id, name: s.name }));

  // 2. Fetch storage locations
  const { data: rawLocations } = await admin
    .from('inventory_storage_locations')
    .select('id, name')
    .eq('branch_id', context.activeBranch.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  const locations = (rawLocations || []).map((l) => ({ id: l.id, name: l.name }));

  // 3. Fetch stock items
  const { data: rawItems } = await admin
    .from('inventory_items')
    .select('id, name, base_unit, cost_per_unit_cents')
    .eq('business_id', context.business.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const availableItems = (rawItems || []).map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.base_unit,
    costPerUnitCents: i.cost_per_unit_cents || 0,
  }));

  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase Order"
        description="Draft a purchase order for suppliers with line items and designated receiving storage location"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Purchasing', href: '/dashboard/inventory/purchasing' },
          { label: 'New PO' },
        ]}
        helpSlug="creating-purchase-orders"
      />

      <PurchaseOrderBuilder
        branchId={context.activeBranch.id}
        suppliers={suppliers}
        locations={locations}
        availableItems={availableItems}
        currency={currency}
      />
    </div>
  );
}

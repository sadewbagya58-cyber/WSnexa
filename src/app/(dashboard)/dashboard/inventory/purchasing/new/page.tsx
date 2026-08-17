import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { PermissionService } from '@/server/services/permission.service';
import { createAdminClient } from '@/lib/supabase/server';
import { PurchaseOrderBuilder } from '@/components/inventory/purchase-order-builder';

interface NewPurchaseOrderPageProps {
  searchParams: Promise<{ supplierId?: string; itemId?: string }>;
}

export const metadata: Metadata = {
  title: 'Create Purchase Order | WSNexa Inventory',
  description: 'Procure ingredients from suppliers, set expected delivery dates, and configure order lines',
};

export default async function NewPurchaseOrderPage({ searchParams }: NewPurchaseOrderPageProps) {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  const { supplierId: querySupplierId, itemId: queryItemId } = await searchParams;

  const hasCostPermission = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.costs.view'
  );

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

  // 4. Fetch supplier items catalog mappings
  const supplierIds = suppliers.map((s) => s.id);
  let supplierMappings: Array<{
    supplierId: string;
    itemId: string;
    supplierSku: string | null;
    purchasingUnit: string;
    conversionToBase: number;
    lastPriceCents: number;
    currency: string;
    isPreferred: boolean;
  }> = [];

  if (supplierIds.length > 0) {
    const { data: rawMappings } = await admin
      .from('inventory_supplier_items')
      .select('supplier_id, item_id, supplier_sku, purchasing_unit, conversion_to_base, last_price_cents, currency, is_preferred')
      .in('supplier_id', supplierIds);

    if (rawMappings) {
      supplierMappings = rawMappings.map((m) => ({
        supplierId: m.supplier_id,
        itemId: m.item_id,
        supplierSku: m.supplier_sku,
        purchasingUnit: m.purchasing_unit,
        conversionToBase: Number(m.conversion_to_base) || 1.0,
        lastPriceCents: hasCostPermission ? Number(m.last_price_cents) : 0,
        currency: m.currency || 'USD',
        isPreferred: m.is_preferred,
      }));
    }
  }

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
        supplierMappings={supplierMappings}
        currency={currency}
        hasCostPermission={hasCostPermission}
        initialSupplierId={querySupplierId}
        initialItemId={queryItemId}
      />
    </div>
  );
}

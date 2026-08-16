import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { GoodsReceivingClient } from '@/components/inventory/goods-receiving-client';

export const metadata: Metadata = {
  title: 'Receive Goods & Stock Delivery | WSNexa Inventory',
  description: 'Fast mobile & tablet goods receiving, update inventory balances, log batch expiry, and calculate weighted average cost',
};

export default async function GoodsReceivingPage() {
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

  // 3. Fetch inventory items
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

  // 4. Fetch open/approved purchase orders
  const { data: rawPOs } = await admin
    .from('inventory_purchase_orders')
    .select(`
      id,
      po_number,
      supplier_id,
      destination_location_id,
      items:inventory_purchase_order_items(
        id,
        item_id,
        purchasing_unit,
        quantity_ordered,
        quantity_received_base,
        unit_cost_cents,
        inventory_items(name)
      )
    `)
  interface RawPoRow {
    id: string;
    po_number: string;
    supplier_id: string;
    destination_location_id: string;
    items?: Array<{
      id: string;
      item_id: string;
      purchasing_unit: string;
      quantity_ordered: number;
      quantity_received_base: number;
      unit_cost_cents: number;
      inventory_items?: { name: string } | null;
    }> | null;
  }

  const openPurchaseOrders = ((rawPOs as unknown as RawPoRow[]) || []).map((po) => ({
    id: po.id,
    poNumber: po.po_number,
    supplierId: po.supplier_id,
    destinationLocationId: po.destination_location_id,
    items: (po.items || []).map((i) => ({
      id: i.id,
      itemId: i.item_id,
      itemName: i.inventory_items?.name || 'Item',
      purchasingUnit: i.purchasing_unit,
      quantityOrdered: Number(i.quantity_ordered),
      quantityReceivedBase: Number(i.quantity_received_base || 0),
      unitCostCents: i.unit_cost_cents,
    })),
  }));

  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive Goods (GRN)"
        description="Verify and accept vendor deliveries into active storage locations, log batch expiry, and update weighted average cost"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Receive Goods' },
        ]}
        helpSlug="receiving-goods-and-grn"
      />

      <GoodsReceivingClient
        branchId={context.activeBranch.id}
        suppliers={suppliers}
        locations={locations}
        availableItems={availableItems}
        openPurchaseOrders={openPurchaseOrders}
        currency={currency}
      />
    </div>
  );
}

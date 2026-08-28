import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { PurchasingService } from '@/server/services/purchasing.service';
import { GoodsReceivingClient } from '@/components/inventory/goods-receiving-client';
import { SupplierReturnsClient } from '@/components/inventory/supplier-returns-client';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Receive Goods & Supplier Returns | WSNexa Inventory',
  description: 'Fast mobile & tablet goods receiving, supplier returns, batch expiry, and weighted average cost tracking',
};

interface GoodsReceivingPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function GoodsReceivingPage({ searchParams }: GoodsReceivingPageProps) {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  let canReceive = false;
  try {
    const authContext = await resolveAuthorizationContext();
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
    const hasReceive =
      (await can({ context: authContext, permission: 'purchasing.receive', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.receiving.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    canReceive = hasReceive || authContext.isBusinessOwner;
  } catch {
    canReceive = false;
  }

  const { tab } = await searchParams;
  const isReturnsTab = tab === 'returns';

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
    .eq('branch_id', context.activeBranch.id)
    .in('status', ['approved', 'partially_received'])
    .order('created_at', { ascending: false });

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

  // 5. Fetch returnable GRN lines & supplier return history
  const [returnableGrnItems, supplierReturns] = await Promise.all([
    PurchasingService.getReturnableGrnItems(),
    PurchasingService.getSupplierReturns(),
  ]);

  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving & Vendor Returns"
        description="Verify vendor deliveries into active storage locations or return damaged and substandard goods for credit notes."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: isReturnsTab ? 'Supplier Returns' : 'Receive Goods' },
        ]}
        helpSlug="receiving-goods-and-grn"
      />

      <InventorySubNav />

      {/* Navigation Subtabs */}
      <div className="flex border-b border-zinc-200 gap-6 text-xs font-bold overflow-x-auto whitespace-nowrap py-0.5 no-scrollbar">
        <a
          href="/dashboard/inventory/receiving"
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            !isReturnsTab
              ? 'border-zinc-950 text-zinc-950 font-extrabold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          📥 Receive Goods (GRN)
          {openPurchaseOrders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-700 font-mono">
              {openPurchaseOrders.length}
            </span>
          )}
        </a>

        <a
          href="/dashboard/inventory/receiving?tab=returns"
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            isReturnsTab
              ? 'border-zinc-950 text-zinc-950 font-extrabold'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          ↩️ Supplier Returns & Credit Notes
          {supplierReturns.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-700 font-mono">
              {supplierReturns.length}
            </span>
          )}
        </a>
      </div>

      {isReturnsTab ? (
        <SupplierReturnsClient
          branchId={context.activeBranch.id}
          suppliers={suppliers}
          locations={locations}
          availableItems={availableItems}
          returnableGrnItems={returnableGrnItems}
          supplierReturns={supplierReturns}
          currency={currency}
          canManage={canReceive}
        />
      ) : (
        <GoodsReceivingClient
          branchId={context.activeBranch.id}
          suppliers={suppliers}
          locations={locations}
          availableItems={availableItems}
          openPurchaseOrders={openPurchaseOrders}
          currency={currency}
          canManage={canReceive}
        />
      )}
    </div>
  );
}

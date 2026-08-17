import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { UnitConverter } from '@/lib/inventory/unit-converter';
import {
  CreateSupplierInput,
  CreatePurchaseOrderInput,
  RecordGoodsReceiptInput,
  SupplierReturnInput,
} from '@/lib/validation/purchasing';

export interface SupplierReturnRecord {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  grnId: string | null;
  grnNumber: string | null;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  itemBaseUnit: string;
  returnNumber: string;
  quantity: number;
  unit: string;
  quantityBase: number;
  unitCostCents: number;
  totalCostCents: number;
  reason: string;
  returnedBy: string | null;
  createdAt: string;
}

export interface ReturnableGrnItem {
  grnId: string;
  grnNumber: string;
  grnDate: string;
  supplierId: string;
  supplierName: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  baseUnit: string;
  unitReceived: string;
  quantityReceived: number;
  quantityReceivedBase: number;
  quantityReturnedBase: number;
  remainingReturnableBase: number;
  unitCostCents: number;
}

export interface SupplierRecord {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  paymentTerms: string | null;
  taxId: string | null;
  isPreferred: boolean;
  isActive: boolean;
  notes: string | null;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderRecord {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  supplierName?: string;
  destinationLocationId: string;
  destinationLocationName?: string;
  poNumber: string;
  status: string;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  expectedDeliveryDate: string | null;
  notes: string | null;
  items: PurchaseOrderItemDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItemDetail {
  id: string;
  poId: string;
  itemId: string;
  itemName?: string;
  purchasingUnit: string;
  quantityOrdered: number;
  quantityOrderedBase: number;
  quantityReceivedBase: number;
  unitCostCents: number;
  totalCostCents: number;
}

export class PurchasingService {
  /**
   * Retrieves all suppliers for the active business.
   */
  static async getSuppliers(): Promise<SupplierRecord[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) return [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('inventory_suppliers')
      .select('*, items:inventory_supplier_items(id)')
      .eq('business_id', context.business.id)
      .order('name', { ascending: true });

    if (error || !data) return [];

    return data.map((s) => ({
      id: s.id,
      businessId: s.business_id,
      name: s.name,
      contactPerson: s.contact_person,
      email: s.email,
      phone: s.phone,
      addressLine1: s.address_line1,
      city: s.city,
      country: s.country,
      currency: s.currency,
      paymentTerms: s.payment_terms,
      taxId: s.tax_id,
      isPreferred: s.is_preferred,
      isActive: s.is_active,
      notes: s.notes,
      itemCount: s.items?.length || 0,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }

  /**
   * Creates a new supplier.
   */
  static async createSupplier(input: CreateSupplierInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: context.business.id,
        name: input.name.trim(),
        contact_person: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        address_line1: input.addressLine1 || null,
        address_line2: input.addressLine2 || null,
        city: input.city || null,
        country: input.country || null,
        currency: input.currency || 'USD',
        payment_terms: input.paymentTerms || null,
        tax_id: input.taxId || null,
        is_preferred: input.isPreferred || false,
        is_active: true,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to create supplier.' };
    }

    return { success: true, supplierId: data.id, message: 'Supplier created successfully.' };
  }

  /**
   * Retrieves purchase orders for active branch.
   */
  static async getPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return [];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('inventory_purchase_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name),
        location:inventory_storage_locations(id, name),
        items:inventory_purchase_order_items(
          id,
          po_id,
          item_id,
          purchasing_unit,
          quantity_ordered,
          quantity_ordered_base,
          quantity_received_base,
          unit_cost_cents,
          total_cost_cents,
          inventory_items(id, name)
        )
      `)
      .eq('branch_id', context.activeBranch.id)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((po) => ({
      id: po.id,
      businessId: po.business_id,
      branchId: po.branch_id,
      supplierId: po.supplier_id,
      supplierName: po.supplier?.name || 'Unknown Supplier',
      destinationLocationId: po.destination_location_id,
      destinationLocationName: po.location?.name || 'Main Stock',
      poNumber: po.po_number,
      status: po.status,
      currency: po.currency,
      subtotalCents: po.subtotal_cents,
      taxCents: po.tax_cents,
      totalCents: po.total_cents,
      expectedDeliveryDate: po.expected_delivery_date,
      notes: po.notes,
      items: ((po.items as unknown as Array<{
        id: string;
        po_id: string;
        item_id: string;
        inventory_items?: { name: string } | null;
        purchasing_unit: string;
        quantity_ordered: number;
        quantity_ordered_base: number;
        quantity_received_base: number;
        unit_cost_cents: number;
        total_cost_cents: number;
      }>) || []).map((i) => ({
        id: i.id,
        poId: i.po_id,
        itemId: i.item_id,
        itemName: i.inventory_items?.name || 'Item',
        purchasingUnit: i.purchasing_unit,
        quantityOrdered: Number(i.quantity_ordered),
        quantityOrderedBase: Number(i.quantity_ordered_base),
        quantityReceivedBase: Number(i.quantity_received_base),
        unitCostCents: i.unit_cost_cents,
        totalCostCents: i.total_cost_cents,
      })),
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    }));
  }

  /**
   * Retrieves single purchase order by ID.
   */
  static async getPurchaseOrderById(poId: string): Promise<PurchaseOrderRecord | null> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return null;

    const admin = createAdminClient();
    const { data: po, error } = await admin
      .from('inventory_purchase_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name),
        location:inventory_storage_locations(id, name),
        items:inventory_purchase_order_items(
          id,
          po_id,
          item_id,
          purchasing_unit,
          quantity_ordered,
          quantity_ordered_base,
          quantity_received_base,
          unit_cost_cents,
          total_cost_cents,
          inventory_items(id, name)
        )
      `)
      .eq('id', poId)
      .eq('branch_id', context.activeBranch.id)
      .maybeSingle();

    if (error || !po) return null;

    return {
      id: po.id,
      businessId: po.business_id,
      branchId: po.branch_id,
      supplierId: po.supplier_id,
      supplierName: po.supplier?.name || 'Unknown Supplier',
      destinationLocationId: po.destination_location_id,
      destinationLocationName: po.location?.name || 'Main Stock',
      poNumber: po.po_number,
      status: po.status,
      currency: po.currency,
      subtotalCents: po.subtotal_cents,
      taxCents: po.tax_cents,
      totalCents: po.total_cents,
      expectedDeliveryDate: po.expected_delivery_date,
      notes: po.notes,
      items: ((po.items as unknown as Array<{
        id: string;
        po_id: string;
        item_id: string;
        inventory_items?: { name: string } | null;
        purchasing_unit: string;
        quantity_ordered: number;
        quantity_ordered_base: number;
        quantity_received_base: number;
        unit_cost_cents: number;
        total_cost_cents: number;
      }>) || []).map((i) => ({
        id: i.id,
        poId: i.po_id,
        itemId: i.item_id,
        itemName: i.inventory_items?.name || 'Item',
        purchasingUnit: i.purchasing_unit,
        quantityOrdered: Number(i.quantity_ordered),
        quantityOrderedBase: Number(i.quantity_ordered_base),
        quantityReceivedBase: Number(i.quantity_received_base),
        unitCostCents: i.unit_cost_cents,
        totalCostCents: i.total_cost_cents,
      })),
      createdAt: po.created_at,
      updatedAt: po.updated_at,
    };
  }

  /**
   * Creates a purchase order.
   */
  static async createPurchaseOrder(input: CreatePurchaseOrderInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Fetch items to normalize base units
    const itemIds = input.items.map((i) => i.itemId);
    const { data: invItems } = await admin
      .from('inventory_items')
      .select('id, base_unit')
      .in('id', itemIds);

    const itemMap = new Map<string, string>();
    (invItems || []).forEach((i) => itemMap.set(i.id, i.base_unit));

    let subtotalCents = 0;
    const poItemRows = input.items.map((item) => {
      const lineCost = Math.round(item.quantityOrdered * item.unitCostCents);
      subtotalCents += lineCost;

      const baseUnit = itemMap.get(item.itemId) || item.purchasingUnit;
      let qtyBase = item.quantityOrdered;
      try {
        qtyBase = UnitConverter.normalizeToBase(item.quantityOrdered, item.purchasingUnit, baseUnit);
      } catch {
        qtyBase = item.quantityOrdered;
      }

      return {
        item_id: item.itemId,
        purchasing_unit: item.purchasingUnit,
        quantity_ordered: item.quantityOrdered,
        quantity_ordered_base: qtyBase,
        unit_cost_cents: item.unitCostCents,
        total_cost_cents: lineCost,
      };
    });

    const { data: po, error: poErr } = await admin
      .from('inventory_purchase_orders')
      .insert({
        business_id: context.business.id,
        branch_id: input.branchId,
        supplier_id: input.supplierId,
        destination_location_id: input.destinationLocationId,
        po_number: poNumber,
        status: 'draft',
        currency: context.business.defaultCurrency || 'USD',
        subtotal_cents: subtotalCents,
        tax_cents: 0,
        total_cents: subtotalCents,
        expected_delivery_date: input.expectedDeliveryDate || null,
        notes: input.notes || null,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (poErr || !po) {
      return { success: false, message: poErr?.message || 'Failed to create purchase order.' };
    }

    const { error: itemsErr } = await admin
      .from('inventory_purchase_order_items')
      .insert(poItemRows.map((r) => ({ ...r, po_id: po.id })));

    if (itemsErr) {
      await admin.from('inventory_purchase_orders').delete().eq('id', po.id);
      return { success: false, message: `Failed to create PO items: ${itemsErr.message}` };
    }

    return { success: true, poId: po.id, message: 'Purchase Order created.' };
  }

  /**
   * Approves a draft purchase order.
   */
  static async approvePurchaseOrder(poId: string) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('inventory_purchase_orders')
      .update({
        status: 'approved',
        approved_by: context.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('branch_id', context.activeBranch.id)
      .eq('status', 'draft');

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Purchase Order approved.' };
  }

  /**
   * Records a Goods Receipt (GRN) atomically updating inventory balances, movements, and weighted cost.
   */
  static async recordGoodsReceipt(input: RecordGoodsReceiptInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();

    // Fetch items for unit conversion
    const itemIds = input.items.map((i) => i.itemId);
    const { data: invItems } = await admin
      .from('inventory_items')
      .select('id, base_unit')
      .in('id', itemIds);

    const itemMap = new Map<string, string>();
    (invItems || []).forEach((i) => itemMap.set(i.id, i.base_unit));

    const receivedItemsPayload = input.items.map((item) => {
      const baseUnit = itemMap.get(item.itemId) || item.unitReceived;
      let qtyBase = item.quantityReceived;
      try {
        qtyBase = UnitConverter.normalizeToBase(item.quantityReceived, item.unitReceived, baseUnit);
      } catch {
        qtyBase = item.quantityReceived;
      }

      return {
        item_id: item.itemId,
        po_item_id: item.poItemId || null,
        quantity_received: item.quantityReceived,
        unit_received: item.unitReceived,
        quantity_received_base: qtyBase,
        unit_cost_cents: item.unitCostCents,
        batch_code: item.batchCode || null,
        expiry_date: item.expiryDate || null,
        discrepancy_reason: item.discrepancyReason || null,
      };
    });

    const { data, error } = await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: context.business.id,
      p_branch_id: input.branchId,
      p_supplier_id: input.supplierId,
      p_location_id: input.locationId,
      p_po_id: input.poId || null,
      p_grn_number: input.grnNumber.trim(),
      p_received_items: receivedItemsPayload,
      p_actor_id: context.user.id,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const res = data as { success: boolean; grn_id?: string; grn_number?: string; idempotent_replay?: boolean };
    return {
      success: true,
      grnId: res.grn_id,
      message: res.idempotent_replay ? 'Goods receipt already recorded.' : 'Goods received and stock updated.',
    };
  }

  /**
   * Deterministic Price Comparison for an Inventory Item across Suppliers.
   */
  static async getSupplierPriceComparison(itemId: string) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) return [];

    const admin = createAdminClient();
    const { data } = await admin
      .from('inventory_supplier_items')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, is_preferred, currency)
      `)
      .eq('item_id', itemId)
      .order('last_price_cents', { ascending: true });

    if (!data) return [];

    interface SupplierPriceRow {
      supplier?: { id: string; name: string; is_preferred: boolean; currency: string } | null;
      is_preferred?: boolean;
      purchasing_unit: string;
      conversion_to_base: number;
      last_price_cents: number;
      currency?: string;
    }

    return (data as unknown as SupplierPriceRow[]).map((d) => ({
      supplierId: d.supplier?.id,
      supplierName: d.supplier?.name || 'Unknown',
      isPreferred: d.is_preferred || d.supplier?.is_preferred || false,
      purchasingUnit: d.purchasing_unit,
      conversionToBase: Number(d.conversion_to_base),
      lastPriceCents: d.last_price_cents,
      currency: d.currency || 'USD',
    }));
  }

  /**
   * Records an authoritative supplier return atomically via database RPC.
   */
  static async recordSupplierReturn(input: SupplierReturnInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('record_supplier_return', {
      p_business_id: context.business.id,
      p_branch_id: input.branchId,
      p_supplier_id: input.supplierId,
      p_location_id: input.locationId,
      p_item_id: input.itemId,
      p_quantity: input.quantity,
      p_unit: input.unit,
      p_reason: input.reason,
      p_grn_id: input.grnId || null,
      p_actor_id: context.user.id,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const res = data as {
      success: boolean;
      error?: string;
      message?: string;
      return_id?: string;
      return_number?: string;
      idempotent_replay?: boolean;
    };

    if (!res.success) {
      return { success: false, message: res.message || res.error || 'Supplier return failed.' };
    }

    return {
      success: true,
      returnId: res.return_id,
      returnNumber: res.return_number,
      idempotentReplay: res.idempotent_replay,
      message: res.message || 'Supplier return recorded successfully.',
    };
  }

  /**
   * Retrieves immutable supplier returns history for active branch.
   */
  static async getSupplierReturns(filter?: {
    supplierId?: string;
    itemId?: string;
  }): Promise<SupplierReturnRecord[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return [];

    const admin = createAdminClient();
    let query = admin
      .from('inventory_supplier_returns')
      .select(`
        *,
        supplier:inventory_suppliers(id, name),
        location:inventory_storage_locations(id, name),
        item:inventory_items(id, name, base_unit),
        grn:inventory_goods_receipts(id, grn_number)
      `)
      .eq('branch_id', context.activeBranch.id)
      .order('created_at', { ascending: false });

    if (filter?.supplierId) query = query.eq('supplier_id', filter.supplierId);
    if (filter?.itemId) query = query.eq('item_id', filter.itemId);

    const { data, error } = await query;
    if (error || !data) return [];

    interface RawSupplierReturnRow {
      id: string;
      business_id: string;
      branch_id: string;
      supplier_id: string;
      grn_id: string | null;
      location_id: string;
      item_id: string;
      return_number: string;
      quantity: number;
      unit: string;
      quantity_base: number;
      unit_cost_cents: number;
      total_cost_cents: number;
      reason: string;
      returned_by: string | null;
      created_at: string;
      supplier?: { id: string; name: string } | null;
      location?: { id: string; name: string } | null;
      item?: { id: string; name: string; base_unit: string } | null;
      grn?: { id: string; grn_number: string } | null;
    }

    return (data as unknown as RawSupplierReturnRow[]).map((r) => ({
      id: r.id,
      businessId: r.business_id,
      branchId: r.branch_id,
      supplierId: r.supplier_id,
      supplierName: r.supplier?.name || 'Unknown Supplier',
      grnId: r.grn_id,
      grnNumber: r.grn?.grn_number || null,
      locationId: r.location_id,
      locationName: r.location?.name || 'Storage Location',
      itemId: r.item_id,
      itemName: r.item?.name || 'Inventory Item',
      itemBaseUnit: r.item?.base_unit || r.unit,
      returnNumber: r.return_number,
      quantity: Number(r.quantity),
      unit: r.unit,
      quantityBase: Number(r.quantity_base),
      unitCostCents: r.unit_cost_cents,
      totalCostCents: r.total_cost_cents,
      reason: r.reason,
      returnedBy: r.returned_by,
      createdAt: r.created_at,
    }));
  }

  /**
   * Retrieves all GRN items with calculated returnable balances for active branch.
   */
  static async getReturnableGrnItems(): Promise<ReturnableGrnItem[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return [];

    const admin = createAdminClient();

    // 1. Fetch GRNs with items for active branch
    const { data: grnRows, error: grnErr } = await admin
      .from('inventory_goods_receipts')
      .select(`
        id,
        grn_number,
        received_at,
        supplier_id,
        location_id,
        supplier:inventory_suppliers(id, name),
        location:inventory_storage_locations(id, name),
        items:inventory_goods_receipt_items(
          id,
          item_id,
          unit_received,
          quantity_received,
          quantity_received_base,
          unit_cost_cents,
          inventory_items(id, name, base_unit)
        )
      `)
      .eq('branch_id', context.activeBranch.id)
      .order('received_at', { ascending: false });

    if (grnErr || !grnRows || grnRows.length === 0) return [];

    // 2. Fetch all returns for these GRNs
    const grnIds = grnRows.map((g) => g.id);
    const { data: returnsData } = await admin
      .from('inventory_supplier_returns')
      .select('grn_id, item_id, quantity_base')
      .in('grn_id', grnIds);

    const returnedMap = new Map<string, number>(); // key: `${grnId}_${itemId}` -> total returned base
    (returnsData || []).forEach((r) => {
      const key = `${r.grn_id}_${r.item_id}`;
      const curr = returnedMap.get(key) || 0;
      returnedMap.set(key, curr + Number(r.quantity_base));
    });

    interface RawGrnRow {
      id: string;
      grn_number: string;
      received_at: string;
      supplier_id: string;
      location_id: string;
      supplier?: { id: string; name: string } | null;
      location?: { id: string; name: string } | null;
      items?: Array<{
        id: string;
        item_id: string;
        unit_received: string;
        quantity_received: number;
        quantity_received_base: number;
        unit_cost_cents: number;
        inventory_items?: { id: string; name: string; base_unit: string } | null;
      }>;
    }

    const results: ReturnableGrnItem[] = [];

    (grnRows as unknown as RawGrnRow[]).forEach((grn) => {
      (grn.items || []).forEach((item) => {
        const key = `${grn.id}_${item.item_id}`;
        const returnedBase = returnedMap.get(key) || 0;
        const remainingBase = Math.max(0, Number(item.quantity_received_base) - returnedBase);

        results.push({
          grnId: grn.id,
          grnNumber: grn.grn_number,
          grnDate: grn.received_at,
          supplierId: grn.supplier_id,
          supplierName: grn.supplier?.name || 'Unknown Supplier',
          locationId: grn.location_id,
          locationName: grn.location?.name || 'Main Stock',
          itemId: item.item_id,
          itemName: item.inventory_items?.name || 'Item',
          baseUnit: item.inventory_items?.base_unit || item.unit_received,
          unitReceived: item.unit_received,
          quantityReceived: Number(item.quantity_received),
          quantityReceivedBase: Number(item.quantity_received_base),
          quantityReturnedBase: returnedBase,
          remainingReturnableBase: remainingBase,
          unitCostCents: item.unit_cost_cents,
        });
      });
    });

    return results;
  }
}

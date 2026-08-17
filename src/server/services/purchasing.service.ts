import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { UnitConverter } from '@/lib/inventory/unit-converter';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierItemInput,
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

export interface SupplierCatalogItemRecord {
  id: string;
  supplierId: string;
  itemId: string;
  itemName: string;
  itemBaseUnit: string;
  supplierSku: string | null;
  purchasingUnit: string;
  conversionToBase: number;
  lastPriceCents: number | null;
  normalizedPricePerBaseCents: number | null;
  currency: string;
  isPreferred: boolean;
  itemActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierWithCatalogRecord extends SupplierRecord {
  catalog: SupplierCatalogItemRecord[];
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

export interface FormattedSupplierPriceComparisonItem {
  supplierId: string;
  supplierName: string;
  supplierSku: string | null;
  purchasingUnit: string;
  conversionToBase: number;
  baseUnit: string;
  lastPriceCents: number | null; // null if cost redacted
  normalizedPricePerBaseCents: number | null; // null if cost redacted
  currency: string;
  isPreferred: boolean;
  paymentTerms: string | null;
  isActive: boolean;
  updatedAt: string;
  isCheapest?: boolean;
  priceDifferenceCents?: number | null;
  percentagePremium?: number | null;
  priceTrendDirection?: 'up' | 'down' | 'flat' | 'new';
  priceTrendPercentage?: number | null;
}

export interface SupplierPriceComparisonGroup {
  currency: string;
  cheapestNormalizedCents: number | null;
  cheapestSupplierName?: string;
  preferredSupplierName?: string;
  potentialSavingsCents?: number | null;
  suppliers: FormattedSupplierPriceComparisonItem[];
}

export interface ItemSupplierPriceComparisonPayload {
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentCostPerUnitCents: number | null;
  currency: string;
  totalSuppliersCount: number;
  groups: SupplierPriceComparisonGroup[];
  allSuppliers: FormattedSupplierPriceComparisonItem[];
}

export interface PriceHistoryRecord {
  id: string;
  businessId: string;
  branchId: string | null;
  itemId: string;
  itemName: string;
  baseUnit: string;
  supplierId: string | null;
  supplierName: string;
  sourceType: 'catalog' | 'purchase_order' | 'goods_receipt' | 'manual_adjustment';
  sourceId: string | null;
  purchasingUnit: string;
  conversionToBase: number;
  packPriceCents: number | null; // null if cost redacted
  normalizedPricePerBaseCents: number | null; // null if cost redacted
  currency: string;
  referenceNumber: string | null;
  notes: string | null;
  recordedAt: string;
  changeVsPreviousCents?: number | null;
  changeVsPreviousPercentage?: number | null;
}

export interface ItemCostTrendSummary {
  currency: string;
  currentNormalizedPriceCents: number | null;
  previousNormalizedPriceCents: number | null;
  priceChangeCents: number | null;
  priceChangePercentage: number | null;
  lowestNormalizedPriceCents: number | null;
  highestNormalizedPriceCents: number | null;
  averageNormalizedPriceCents: number | null;
  observationCount: number;
  timeRange: '30d' | '90d' | '6m' | '12m' | 'all';
  history: PriceHistoryRecord[];
  trendDirection: 'up' | 'down' | 'flat' | 'insufficient_data';
}

export interface ItemPriceHistoryPayload {
  itemId: string;
  itemName: string;
  baseUnit: string;
  trendsByCurrency: ItemCostTrendSummary[];
  allObservations: PriceHistoryRecord[];
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
   * Retrieves a supplier by ID with full catalog mappings, unit conversions, and normalized prices.
   */
  static async getSupplierById(
    businessId: string,
    supplierId: string,
    options?: { hasCostPermission?: boolean }
  ): Promise<SupplierWithCatalogRecord | null> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const admin = createAdminClient();

    const { data: supplier, error: supError } = await admin
      .from('inventory_suppliers')
      .select('*')
      .eq('id', supplierId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (supError || !supplier) return null;

    const { data: rawItems } = await admin
      .from('inventory_supplier_items')
      .select(`
        id,
        supplier_id,
        item_id,
        supplier_sku,
        purchasing_unit,
        conversion_to_base,
        last_price_cents,
        currency,
        is_preferred,
        created_at,
        updated_at,
        item:inventory_items!inner(
          id,
          business_id,
          name,
          base_unit,
          cost_per_unit_cents,
          is_active
        )
      `)
      .eq('supplier_id', supplierId)
      .eq('item.business_id', businessId)
      .order('updated_at', { ascending: false });

    interface RawCatalogItemRow {
      id: string;
      supplier_id: string;
      item_id: string;
      supplier_sku: string | null;
      purchasing_unit: string;
      conversion_to_base: number;
      last_price_cents: number;
      currency: string;
      is_preferred: boolean;
      created_at: string;
      updated_at: string;
      item: {
        id: string;
        business_id: string;
        name: string;
        base_unit: string;
        cost_per_unit_cents: number;
        is_active: boolean;
      };
    }

    const catalog: SupplierCatalogItemRecord[] = (rawItems || []).map((row) => {
      const r = row as unknown as RawCatalogItemRow;
      const conv = Number(r.conversion_to_base) || 1.0;
      const rawPrice = Number(r.last_price_cents);
      const normalizedCents = conv > 0 && rawPrice >= 0 ? Math.round(rawPrice / conv) : null;

      return {
        id: r.id,
        supplierId: r.supplier_id,
        itemId: r.item_id,
        itemName: r.item.name,
        itemBaseUnit: r.item.base_unit,
        supplierSku: r.supplier_sku,
        purchasingUnit: r.purchasing_unit,
        conversionToBase: conv,
        lastPriceCents: hasCostPermission ? rawPrice : null,
        normalizedPricePerBaseCents: hasCostPermission ? normalizedCents : null,
        currency: r.currency || supplier.currency || 'USD',
        isPreferred: r.is_preferred,
        itemActive: r.item.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return {
      id: supplier.id,
      businessId: supplier.business_id,
      name: supplier.name,
      contactPerson: supplier.contact_person,
      email: supplier.email,
      phone: supplier.phone,
      addressLine1: supplier.address_line1,
      city: supplier.city,
      country: supplier.country,
      currency: supplier.currency,
      paymentTerms: supplier.payment_terms,
      taxId: supplier.tax_id,
      isPreferred: supplier.is_preferred,
      isActive: supplier.is_active,
      notes: supplier.notes,
      itemCount: catalog.length,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at,
      catalog,
    };
  }

  /**
   * Updates an existing supplier.
   */
  static async updateSupplier(
    input: UpdateSupplierInput,
    options?: { businessId?: string }
  ) {
    let bizId = options?.businessId;
    if (!bizId) {
      const context = await resolveActiveBusinessContext();
      if (!context || !context.business) return { success: false, message: 'Unauthorized.' };
      bizId = context.business.id;
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('inventory_suppliers')
      .select('id')
      .eq('id', input.id)
      .eq('business_id', bizId)
      .maybeSingle();

    if (!existing) {
      return { success: false, message: 'Supplier not found or unauthorized.' };
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.contactPerson !== undefined) updatePayload.contact_person = input.contactPerson || null;
    if (input.email !== undefined) updatePayload.email = input.email || null;
    if (input.phone !== undefined) updatePayload.phone = input.phone || null;
    if (input.addressLine1 !== undefined) updatePayload.address_line1 = input.addressLine1 || null;
    if (input.addressLine2 !== undefined) updatePayload.address_line2 = input.addressLine2 || null;
    if (input.city !== undefined) updatePayload.city = input.city || null;
    if (input.country !== undefined) updatePayload.country = input.country || null;
    if (input.currency !== undefined) updatePayload.currency = input.currency;
    if (input.paymentTerms !== undefined) updatePayload.payment_terms = input.paymentTerms || null;
    if (input.taxId !== undefined) updatePayload.tax_id = input.taxId || null;
    if (input.isPreferred !== undefined) updatePayload.is_preferred = input.isPreferred;
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive;
    if (input.notes !== undefined) updatePayload.notes = input.notes || null;

    const { error } = await admin
      .from('inventory_suppliers')
      .update(updatePayload)
      .eq('id', input.id)
      .eq('business_id', bizId);

    if (error) {
      return { success: false, message: error.message || 'Failed to update supplier.' };
    }

    return { success: true, message: 'Supplier updated successfully.' };
  }

  /**
   * Adds or updates a supplier item catalog mapping.
   */
  static async upsertSupplierItem(
    input: SupplierItemInput,
    options?: { businessId?: string }
  ) {
    if (isNaN(input.conversionToBase) || !isFinite(input.conversionToBase) || input.conversionToBase <= 0) {
      return { success: false, message: 'Conversion factor to base unit must be a positive number greater than 0.' };
    }
    if (isNaN(input.lastPriceCents) || !isFinite(input.lastPriceCents) || input.lastPriceCents < 0) {
      return { success: false, message: 'Pack price cents cannot be negative or invalid.' };
    }

    let bizId = options?.businessId;
    if (!bizId) {
      const context = await resolveActiveBusinessContext();
      if (!context || !context.business) return { success: false, message: 'Unauthorized.' };
      bizId = context.business.id;
    }

    const admin = createAdminClient();

    // 1. Verify supplier belongs to business
    const { data: supplier } = await admin
      .from('inventory_suppliers')
      .select('id, currency')
      .eq('id', input.supplierId)
      .eq('business_id', bizId)
      .maybeSingle();

    if (!supplier) {
      return { success: false, message: 'Supplier not found or unauthorized.' };
    }

    // 2. Verify item belongs to business
    const { data: item } = await admin
      .from('inventory_items')
      .select('id, name, base_unit')
      .eq('id', input.itemId)
      .eq('business_id', bizId)
      .maybeSingle();

    if (!item) {
      return { success: false, message: 'Inventory item not found or unauthorized.' };
    }

    // 3. Check existing mapping to detect price/pack changes
    const { data: existingMapping } = await admin
      .from('inventory_supplier_items')
      .select('id, last_price_cents, conversion_to_base, purchasing_unit, currency')
      .eq('supplier_id', input.supplierId)
      .eq('item_id', input.itemId)
      .maybeSingle();

    const priceOrPackChanged =
      !existingMapping ||
      existingMapping.last_price_cents !== input.lastPriceCents ||
      Number(existingMapping.conversion_to_base) !== Number(input.conversionToBase) ||
      existingMapping.purchasing_unit !== input.purchasingUnit.trim() ||
      (input.currency && existingMapping.currency !== input.currency);

    // 4. Upsert into inventory_supplier_items
    const { data: savedItem, error } = await admin
      .from('inventory_supplier_items')
      .upsert(
        {
          supplier_id: input.supplierId,
          item_id: input.itemId,
          supplier_sku: input.supplierSku ? input.supplierSku.trim() : null,
          purchasing_unit: input.purchasingUnit.trim(),
          conversion_to_base: input.conversionToBase,
          last_price_cents: input.lastPriceCents,
          currency: input.currency || supplier.currency || 'USD',
          is_preferred: input.isPreferred,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'supplier_id,item_id' }
      )
      .select('id')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to save supplier catalog item.' };
    }

    // 5. If price or pack changed, log immutable price history
    if (priceOrPackChanged) {
      const normalizedCents =
        input.conversionToBase > 0
          ? Math.round(input.lastPriceCents / input.conversionToBase)
          : input.lastPriceCents;

      await admin.from('inventory_price_history').insert({
        business_id: bizId,
        item_id: input.itemId,
        supplier_id: input.supplierId,
        source_type: 'catalog',
        source_id: savedItem?.id || existingMapping?.id || null,
        purchasing_unit: input.purchasingUnit.trim(),
        conversion_to_base: input.conversionToBase,
        pack_price_cents: input.lastPriceCents,
        normalized_price_per_base_cents: normalizedCents,
        currency: input.currency || supplier.currency || 'USD',
        notes: existingMapping ? 'Catalog price update' : 'Initial catalog mapping',
        recorded_at: new Date().toISOString(),
      });
    }

    return { success: true, message: 'Supplier catalog item saved successfully.' };
  }

  /**
   * Removes an item from a supplier's catalog.
   */
  static async removeSupplierItem(
    supplierId: string,
    itemId: string,
    options?: { businessId?: string }
  ) {
    let bizId = options?.businessId;
    if (!bizId) {
      const context = await resolveActiveBusinessContext();
      if (!context || !context.business) return { success: false, message: 'Unauthorized.' };
      bizId = context.business.id;
    }

    const admin = createAdminClient();

    // Verify supplier belongs to business
    const { data: supplier } = await admin
      .from('inventory_suppliers')
      .select('id')
      .eq('id', supplierId)
      .eq('business_id', bizId)
      .maybeSingle();

    if (!supplier) {
      return { success: false, message: 'Supplier not found or unauthorized.' };
    }

    const { error } = await admin
      .from('inventory_supplier_items')
      .delete()
      .eq('supplier_id', supplierId)
      .eq('item_id', itemId);

    if (error) {
      return { success: false, message: error.message || 'Failed to remove supplier catalog item.' };
    }

    return { success: true, message: 'Item removed from supplier catalog.' };
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

    if (input.branchId !== context.activeBranch.id) {
      return { success: false, message: 'Cross-branch purchase orders are forbidden.' };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, message: 'Purchase order must have at least one line item.' };
    }

    const admin = createAdminClient();

    // Verify supplier belongs to business
    const { data: supplier } = await admin
      .from('inventory_suppliers')
      .select('id, name, is_active')
      .eq('id', input.supplierId)
      .eq('business_id', context.business.id)
      .maybeSingle();

    if (!supplier) {
      return { success: false, message: 'Supplier not found or unauthorized.' };
    }

    // Verify destination location belongs to active branch
    const { data: location } = await admin
      .from('inventory_storage_locations')
      .select('id, name')
      .eq('id', input.destinationLocationId)
      .eq('branch_id', context.activeBranch.id)
      .maybeSingle();

    if (!location) {
      return { success: false, message: 'Destination storage location not found for this branch.' };
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Fetch items to normalize base units and ensure tenant ownership
    const itemIds = input.items.map((i) => i.itemId);
    const { data: invItems } = await admin
      .from('inventory_items')
      .select('id, base_unit, business_id')
      .in('id', itemIds);

    const itemMap = new Map<string, string>();
    (invItems || []).forEach((i) => {
      if (i.business_id === context.business.id) {
        itemMap.set(i.id, i.base_unit);
      }
    });

    for (const item of input.items) {
      if (!itemMap.has(item.itemId)) {
        return { success: false, message: `Inventory item ${item.itemId} not found in this business.` };
      }
      if (isNaN(item.quantityOrdered) || !isFinite(item.quantityOrdered) || item.quantityOrdered <= 0) {
        return { success: false, message: 'Quantity ordered must be a valid positive number.' };
      }
      if (isNaN(item.unitCostCents) || !isFinite(item.unitCostCents) || item.unitCostCents < 0) {
        return { success: false, message: 'Unit cost cents cannot be negative or invalid.' };
      }
    }

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
        branch_id: context.activeBranch.id,
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

    // Log purchase order price history for each ordered line item
    for (const item of input.items) {
      const baseUnit = itemMap.get(item.itemId) || item.purchasingUnit;
      let qtyBase = item.quantityOrdered;
      try {
        qtyBase = UnitConverter.normalizeToBase(item.quantityOrdered, item.purchasingUnit, baseUnit);
      } catch {
        qtyBase = item.quantityOrdered;
      }
      const conv = item.quantityOrdered > 0 ? qtyBase / item.quantityOrdered : 1.0;
      const normalizedCents = conv > 0 ? Math.round(item.unitCostCents / conv) : item.unitCostCents;

      await admin.from('inventory_price_history').insert({
        business_id: context.business.id,
        branch_id: context.activeBranch.id,
        item_id: item.itemId,
        supplier_id: input.supplierId,
        source_type: 'purchase_order',
        source_id: po.id,
        purchasing_unit: item.purchasingUnit,
        conversion_to_base: conv,
        pack_price_cents: item.unitCostCents,
        normalized_price_per_base_cents: normalizedCents,
        currency: context.business.defaultCurrency || 'USD',
        reference_number: poNumber,
        notes: 'Purchase Order line item',
        recorded_by: context.user.id,
        recorded_at: new Date().toISOString(),
      });
    }

    return { success: true, poId: po.id, message: 'Purchase Order created.' };
  }

  /**
   * Approves a draft purchase order.
   */
  static async approvePurchaseOrder(
    poId: string,
    options?: { businessId?: string; branchId?: string; userId?: string }
  ) {
    const context = options?.businessId && options?.branchId ? null : await resolveActiveBusinessContext();
    const branchId = options?.branchId || context?.activeBranch?.id;
    const userId = options?.userId || context?.user?.id;
    if (!branchId && !options?.businessId) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    let query = admin
      .from('inventory_purchase_orders')
      .select('id, status, branch_id')
      .eq('id', poId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: po, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !po) {
      return { success: false, message: 'Purchase Order not found for active branch.' };
    }

    if (po.status !== 'draft') {
      return { success: false, message: `Cannot approve Purchase Order in '${po.status}' status. Only draft orders can be approved.` };
    }

    const { error } = await admin
      .from('inventory_purchase_orders')
      .update({
        status: 'approved',
        approved_by: userId || null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .eq('status', 'draft');

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Purchase Order approved.' };
  }

  /**
   * Cancels a draft or approved purchase order.
   */
  static async cancelPurchaseOrder(
    poId: string,
    reason?: string,
    options?: { businessId?: string; branchId?: string; userId?: string }
  ) {
    const context = options?.businessId && options?.branchId ? null : await resolveActiveBusinessContext();
    const branchId = options?.branchId || context?.activeBranch?.id;
    if (!branchId && !options?.businessId) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    let query = admin
      .from('inventory_purchase_orders')
      .select('id, status, branch_id')
      .eq('id', poId);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: po, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !po) {
      return { success: false, message: 'Purchase Order not found for active branch.' };
    }

    if (po.status === 'cancelled') {
      return { success: false, message: 'Purchase Order is already cancelled.' };
    }

    if (po.status === 'received' || po.status === 'partially_received') {
      return { success: false, message: 'Cannot cancel a purchase order that has already been received.' };
    }

    const { error: updateErr } = await admin
      .from('inventory_purchase_orders')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    return { success: true, message: 'Purchase Order cancelled.' };
  }

  /**
   * Records a Goods Receipt (GRN) atomically updating inventory balances, movements, and weighted cost.
   */
  static async recordGoodsReceipt(
    input: RecordGoodsReceiptInput,
    options?: { businessId?: string; branchId?: string; userId?: string }
  ) {
    const context = options?.businessId && options?.branchId ? null : await resolveActiveBusinessContext();
    const businessId = options?.businessId || context?.business?.id;
    const branchId = options?.branchId || context?.activeBranch?.id || input.branchId;
    const userId = options?.userId || context?.user?.id;
    if (!businessId || !branchId) {
      return { success: false, message: 'Unauthorized.' };
    }

    if (context && context.activeBranch && input.branchId !== context.activeBranch.id) {
      return { success: false, message: 'Cross-branch goods receiving is forbidden.' };
    }

    const admin = createAdminClient();

    // Verify storage location belongs to active branch
    const { data: location } = await admin
      .from('inventory_storage_locations')
      .select('id, name')
      .eq('id', input.locationId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!location) {
      return { success: false, message: 'Receiving storage location not found for this branch.' };
    }

    // Verify supplier belongs to business
    const { data: supplier } = await admin
      .from('inventory_suppliers')
      .select('id, name')
      .eq('id', input.supplierId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!supplier) {
      return { success: false, message: 'Supplier not found or unauthorized.' };
    }

    // Fetch items for unit conversion & business ownership
    const itemIds = input.items.map((i) => i.itemId);
    const { data: invItems } = await admin
      .from('inventory_items')
      .select('id, base_unit, business_id')
      .in('id', itemIds);

    const itemMap = new Map<string, string>();
    (invItems || []).forEach((i) => {
      if (i.business_id === businessId) {
        itemMap.set(i.id, i.base_unit);
      }
    });

    for (const item of input.items) {
      if (!itemMap.has(item.itemId)) {
        return { success: false, message: `Inventory item ${item.itemId} not found in this business.` };
      }
      if (isNaN(item.quantityReceived) || !isFinite(item.quantityReceived) || item.quantityReceived <= 0) {
        return { success: false, message: 'Quantity received must be a valid positive number.' };
      }
      if (isNaN(item.unitCostCents) || !isFinite(item.unitCostCents) || item.unitCostCents < 0) {
        return { success: false, message: 'Unit cost cents cannot be negative or invalid.' };
      }
    }

    // If linked to a PO, validate PO status and prevent over-receipt
    if (input.poId) {
      const { data: po, error: poErr } = await admin
        .from('inventory_purchase_orders')
        .select(`
          id,
          status,
          branch_id,
          supplier_id,
          items:inventory_purchase_order_items(
            id,
            item_id,
            quantity_ordered_base,
            quantity_received_base
          )
        `)
        .eq('id', input.poId)
        .eq('branch_id', branchId)
        .maybeSingle();

      if (poErr || !po) {
        return { success: false, message: 'Linked Purchase Order not found for active branch.' };
      }

      if (po.status === 'cancelled') {
        return { success: false, message: 'Cannot receive goods against a cancelled Purchase Order.' };
      }

      if (po.status === 'draft') {
        return { success: false, message: 'Purchase Order must be approved before receiving goods.' };
      }

      if (po.status === 'received') {
        return { success: false, message: 'Purchase Order is already fully received.' };
      }

      if (po.supplier_id !== input.supplierId) {
        return { success: false, message: 'Goods receipt supplier does not match linked Purchase Order supplier.' };
      }

      // Check remaining unreceived quantity per line item
      interface RawPoItemCheck {
        id: string;
        item_id: string;
        quantity_ordered_base: number;
        quantity_received_base: number;
      }
      const poItemMap = new Map<string, RawPoItemCheck>();
      ((po.items as unknown as RawPoItemCheck[]) || []).forEach((pi) => poItemMap.set(pi.id, pi));

      for (const item of input.items) {
        if (item.poItemId) {
          const poItem = poItemMap.get(item.poItemId);
          if (!poItem) {
            return { success: false, message: `PO line item ${item.poItemId} not found on this Purchase Order.` };
          }
          const baseUnit = itemMap.get(item.itemId) || item.unitReceived;
          let qtyRecBase = item.quantityReceived;
          try {
            qtyRecBase = UnitConverter.normalizeToBase(item.quantityReceived, item.unitReceived, baseUnit);
          } catch {
            qtyRecBase = item.quantityReceived;
          }

          const orderedBase = Number(poItem.quantity_ordered_base) || 0;
          const alreadyReceivedBase = Number(poItem.quantity_received_base) || 0;
          const remainingBase = Math.max(0, orderedBase - alreadyReceivedBase);

          if (qtyRecBase > remainingBase + 0.0001) {
            return {
              success: false,
              message: `Cannot receive ${qtyRecBase.toFixed(2)} ${baseUnit}. Remaining unreceived quantity on PO is only ${remainingBase.toFixed(2)} ${baseUnit}.`,
            };
          }
        }
      }
    }

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
      p_business_id: businessId,
      p_branch_id: branchId,
      p_supplier_id: input.supplierId,
      p_location_id: input.locationId,
      p_po_id: input.poId || null,
      p_grn_number: input.grnNumber.trim(),
      p_received_items: receivedItemsPayload,
      p_actor_id: userId || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const res = data as { success: boolean; grn_id?: string; grn_number?: string; idempotent_replay?: boolean };

    // Log actual received price history for received items if not idempotent replay
    if (res.grn_id && !res.idempotent_replay) {
      for (const item of input.items) {
        const baseUnit = itemMap.get(item.itemId) || item.unitReceived;
        let qtyBase = item.quantityReceived;
        try {
          qtyBase = UnitConverter.normalizeToBase(item.quantityReceived, item.unitReceived, baseUnit);
        } catch {
          qtyBase = item.quantityReceived;
        }
        const conv = item.quantityReceived > 0 ? qtyBase / item.quantityReceived : 1.0;
        const normalizedCents = conv > 0 ? Math.round(item.unitCostCents / conv) : item.unitCostCents;

        await admin.from('inventory_price_history').insert({
          business_id: businessId,
          branch_id: branchId,
          item_id: item.itemId,
          supplier_id: input.supplierId,
          source_type: 'goods_receipt',
          source_id: res.grn_id,
          purchasing_unit: item.unitReceived,
          conversion_to_base: conv,
          pack_price_cents: item.unitCostCents,
          normalized_price_per_base_cents: normalizedCents,
          currency: 'USD',
          reference_number: input.grnNumber.trim(),
          notes: 'Goods Receipt item',
          recorded_by: userId || null,
          recorded_at: new Date().toISOString(),
        });
      }
    }

    return {
      success: true,
      grnId: res.grn_id,
      message: res.idempotent_replay ? 'Goods receipt already recorded.' : 'Goods received and stock updated.',
    };
  }

  /**
   * Deterministic Price Comparison for an Inventory Item across Suppliers.
   * Scoped authoritatively by business_id and item_id with unit normalization and multi-currency grouping.
   */
  static async getSupplierPriceComparison(
    businessId: string,
    itemId: string,
    options?: { hasCostPermission?: boolean }
  ): Promise<ItemSupplierPriceComparisonPayload | null> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const admin = createAdminClient();

    // 1. Verify item belongs to business
    const { data: itemRow } = await admin
      .from('inventory_items')
      .select('id, name, base_unit, cost_per_unit_cents, currency')
      .eq('id', itemId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!itemRow) return null;

    // 2. Query supplier items
    const { data: rows, error } = await admin
      .from('inventory_supplier_items')
      .select(`
        id,
        supplier_id,
        item_id,
        supplier_sku,
        purchasing_unit,
        conversion_to_base,
        last_price_cents,
        currency,
        is_preferred,
        updated_at,
        supplier:inventory_suppliers!inner(
          id,
          business_id,
          name,
          payment_terms,
          is_preferred,
          is_active,
          currency
        )
      `)
      .eq('item_id', itemId)
      .eq('supplier.business_id', businessId)
      .eq('supplier.is_active', true);

    if (error || !rows) {
      return {
        itemId: itemRow.id,
        itemName: itemRow.name,
        baseUnit: itemRow.base_unit,
        currentCostPerUnitCents: hasCostPermission ? itemRow.cost_per_unit_cents : null,
        currency: itemRow.currency || 'USD',
        totalSuppliersCount: 0,
        groups: [],
        allSuppliers: [],
      };
    }

    interface RawSupplierItemRow {
      id: string;
      supplier_id: string;
      item_id: string;
      supplier_sku: string | null;
      purchasing_unit: string;
      conversion_to_base: number;
      last_price_cents: number;
      currency: string;
      is_preferred: boolean;
      updated_at: string;
      supplier: {
        id: string;
        business_id: string;
        name: string;
        payment_terms: string | null;
        is_preferred: boolean;
        is_active: boolean;
        currency: string;
      };
    }

    // Query recent price history to derive trend per supplier
    const { data: priceHistRows } = await admin
      .from('inventory_price_history')
      .select('supplier_id, normalized_price_per_base_cents, recorded_at')
      .eq('business_id', businessId)
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: false });

    const supplierHistMap = new Map<string, number[]>();
    (priceHistRows || []).forEach((h) => {
      if (h.supplier_id) {
        if (!supplierHistMap.has(h.supplier_id)) {
          supplierHistMap.set(h.supplier_id, []);
        }
        supplierHistMap.get(h.supplier_id)!.push(Number(h.normalized_price_per_base_cents));
      }
    });

    const mappedSuppliers = (rows as unknown as RawSupplierItemRow[]).map((r) => {
      const conv = Number(r.conversion_to_base) || 1.0;
      const rawPrice = Number(r.last_price_cents);
      const normalizedCents = conv > 0 && rawPrice >= 0 ? Math.round(rawPrice / conv) : null;
      const isPref = r.is_preferred || r.supplier.is_preferred || false;

      let trendDir: 'up' | 'down' | 'flat' | 'new' | undefined = undefined;
      let trendPct: number | null = null;

      if (hasCostPermission) {
        const hist = supplierHistMap.get(r.supplier.id) || [];
        if (hist.length >= 2) {
          const current = hist[0];
          const prev = hist[1];
          const diff = current - prev;
          if (diff > 0) {
            trendDir = 'up';
            trendPct = prev > 0 ? Number(((diff / prev) * 100).toFixed(2)) : 0;
          } else if (diff < 0) {
            trendDir = 'down';
            trendPct = prev > 0 ? Number(((diff / prev) * 100).toFixed(2)) : 0;
          } else {
            trendDir = 'flat';
            trendPct = 0;
          }
        } else {
          trendDir = 'new';
        }
      }

      return {
        supplierId: r.supplier.id,
        supplierName: r.supplier.name,
        supplierSku: r.supplier_sku,
        purchasingUnit: r.purchasing_unit,
        conversionToBase: conv,
        baseUnit: itemRow.base_unit,
        lastPriceCents: hasCostPermission ? rawPrice : null,
        normalizedPricePerBaseCents: hasCostPermission ? normalizedCents : null,
        currency: r.currency || r.supplier.currency || 'USD',
        isPreferred: isPref,
        paymentTerms: r.supplier.payment_terms,
        isActive: r.supplier.is_active,
        updatedAt: r.updated_at,
        priceTrendDirection: trendDir,
        priceTrendPercentage: trendPct,
      };
    });

    // Group by currency
    const currencyMap = new Map<string, FormattedSupplierPriceComparisonItem[]>();
    mappedSuppliers.forEach((s) => {
      const cur = s.currency;
      if (!currencyMap.has(cur)) currencyMap.set(cur, []);
      currencyMap.get(cur)!.push(s);
    });

    const groups: SupplierPriceComparisonGroup[] = [];
    const enrichedAllSuppliers: FormattedSupplierPriceComparisonItem[] = [];

    currencyMap.forEach((suppliersInCurrency, cur) => {
      const validNormalized = suppliersInCurrency
        .filter((s) => s.normalizedPricePerBaseCents !== null)
        .map((s) => s.normalizedPricePerBaseCents as number);

      const cheapestNorm = validNormalized.length > 0 ? Math.min(...validNormalized) : null;
      let cheapestName: string | undefined;
      let preferredName: string | undefined;
      let potentialSavings: number | null = null;

      const enrichedInCurrency = suppliersInCurrency.map((s) => {
        const isCheapest = cheapestNorm !== null && s.normalizedPricePerBaseCents === cheapestNorm;
        if (isCheapest && !cheapestName) cheapestName = s.supplierName;
        if (s.isPreferred) preferredName = s.supplierName;

        let diffCents: number | null = null;
        let pctPremium: number | null = null;

        if (hasCostPermission && cheapestNorm !== null && s.normalizedPricePerBaseCents !== null) {
          diffCents = s.normalizedPricePerBaseCents - cheapestNorm;
          pctPremium = cheapestNorm > 0
            ? Number((((s.normalizedPricePerBaseCents - cheapestNorm) / cheapestNorm) * 100).toFixed(2))
            : 0;
        }

        return {
          ...s,
          isCheapest,
          priceDifferenceCents: diffCents,
          percentagePremium: pctPremium,
        };
      });

      // Sort: cheapest normalized price first, then preferred, then name
      enrichedInCurrency.sort((a, b) => {
        if (a.normalizedPricePerBaseCents !== null && b.normalizedPricePerBaseCents !== null) {
          if (a.normalizedPricePerBaseCents !== b.normalizedPricePerBaseCents) {
            return a.normalizedPricePerBaseCents - b.normalizedPricePerBaseCents;
          }
        }
        if (a.isPreferred !== b.isPreferred) {
          return a.isPreferred ? -1 : 1;
        }
        return a.supplierName.localeCompare(b.supplierName);
      });

      if (hasCostPermission && cheapestNorm !== null) {
        const prefItem = enrichedInCurrency.find((s) => s.isPreferred);
        if (prefItem && prefItem.normalizedPricePerBaseCents !== null && prefItem.normalizedPricePerBaseCents > cheapestNorm) {
          potentialSavings = prefItem.normalizedPricePerBaseCents - cheapestNorm;
        }
      }

      groups.push({
        currency: cur,
        cheapestNormalizedCents: cheapestNorm,
        cheapestSupplierName: cheapestName,
        preferredSupplierName: preferredName,
        potentialSavingsCents: potentialSavings,
        suppliers: enrichedInCurrency,
      });

      enrichedAllSuppliers.push(...enrichedInCurrency);
    });

    return {
      itemId: itemRow.id,
      itemName: itemRow.name,
      baseUnit: itemRow.base_unit,
      currentCostPerUnitCents: hasCostPermission ? itemRow.cost_per_unit_cents : null,
      currency: itemRow.currency || 'USD',
      totalSuppliersCount: mappedSuppliers.length,
      groups,
      allSuppliers: enrichedAllSuppliers,
    };
  }

  /**
   * Retrieves comprehensive purchase price history and cost trend analysis for an item.
   */
  static async getItemPriceHistory(
    businessId: string,
    itemId: string,
    options?: {
      timeRange?: '30d' | '90d' | '6m' | '12m' | 'all';
      supplierId?: string;
      branchId?: string;
      hasCostPermission?: boolean;
    }
  ): Promise<ItemPriceHistoryPayload | null> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const timeRange = options?.timeRange ?? 'all';
    const admin = createAdminClient();

    // 1. Verify item belongs to business
    const { data: item, error: itemError } = await admin
      .from('inventory_items')
      .select('id, name, base_unit, currency')
      .eq('id', itemId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (itemError || !item) return null;

    // 2. Build date threshold for time filter
    let dateFilter: string | null = null;
    const now = new Date();
    if (timeRange === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      dateFilter = d.toISOString();
    } else if (timeRange === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      dateFilter = d.toISOString();
    } else if (timeRange === '6m') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      dateFilter = d.toISOString();
    } else if (timeRange === '12m') {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      dateFilter = d.toISOString();
    }

    // 3. Query price history
    let query = admin
      .from('inventory_price_history')
      .select(`
        id,
        business_id,
        branch_id,
        item_id,
        supplier_id,
        source_type,
        source_id,
        purchasing_unit,
        conversion_to_base,
        pack_price_cents,
        normalized_price_per_base_cents,
        currency,
        reference_number,
        notes,
        recorded_at,
        supplier:inventory_suppliers(id, name)
      `)
      .eq('business_id', businessId)
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: true });

    if (dateFilter) {
      query = query.gte('recorded_at', dateFilter);
    }
    if (options?.supplierId) {
      query = query.eq('supplier_id', options.supplierId);
    }
    if (options?.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    const { data: rows } = await query;

    interface RawPriceHistoryRow {
      id: string;
      business_id: string;
      branch_id: string | null;
      item_id: string;
      supplier_id: string | null;
      source_type: 'catalog' | 'purchase_order' | 'goods_receipt' | 'manual_adjustment';
      source_id: string | null;
      purchasing_unit: string;
      conversion_to_base: number;
      pack_price_cents: number;
      normalized_price_per_base_cents: number;
      currency: string;
      reference_number: string | null;
      notes: string | null;
      recorded_at: string;
        supplier?: { id: string; name: string } | null;
    }

    const rawHistory = (rows as unknown as RawPriceHistoryRow[]) || [];

    // Group observations by currency, maintaining supplier-specific previous price tracking
    const byCurrency = new Map<string, PriceHistoryRecord[]>();
    const supplierPreviousInCurrency = new Map<string, number>();

    rawHistory.forEach((r) => {
      const curr = r.currency || 'USD';
      const supplierKey = `${curr}:${r.supplier_id || '__direct__'}`;

      if (!byCurrency.has(curr)) {
        byCurrency.set(curr, []);
      }
      const arr = byCurrency.get(curr)!;

      const normCents = Number(r.normalized_price_per_base_cents);
      const rawPackCents = Number(r.pack_price_cents);

      let changeVsPrevCents: number | null = null;
      let changeVsPrevPct: number | null = null;

      if (supplierPreviousInCurrency.has(supplierKey)) {
        const prevNorm = supplierPreviousInCurrency.get(supplierKey)!;
        changeVsPrevCents = normCents - prevNorm;
        changeVsPrevPct =
          prevNorm > 0 ? Number((((normCents - prevNorm) / prevNorm) * 100).toFixed(2)) : 0;
      }
      supplierPreviousInCurrency.set(supplierKey, normCents);

      arr.push({
        id: r.id,
        businessId: r.business_id,
        branchId: r.branch_id,
        itemId: r.item_id,
        itemName: item.name,
        baseUnit: item.base_unit,
        supplierId: r.supplier_id,
        supplierName: r.supplier?.name || (r.supplier_id ? 'Supplier' : 'Direct / Internal'),
        sourceType: r.source_type,
        sourceId: r.source_id,
        purchasingUnit: r.purchasing_unit,
        conversionToBase: Number(r.conversion_to_base) || 1.0,
        packPriceCents: hasCostPermission ? rawPackCents : null,
        normalizedPricePerBaseCents: hasCostPermission ? normCents : null,
        currency: curr,
        referenceNumber: r.reference_number,
        notes: r.notes,
        recordedAt: r.recorded_at,
        changeVsPreviousCents: hasCostPermission ? changeVsPrevCents : null,
        changeVsPreviousPercentage: hasCostPermission ? changeVsPrevPct : null,
      });
    });

    const trendsByCurrency: ItemCostTrendSummary[] = [];
    const allEnrichedObservations: PriceHistoryRecord[] = [];

    for (const [curr, records] of byCurrency.entries()) {
      const count = records.length;
      allEnrichedObservations.push(...records);

      if (count === 0) continue;

      const latestRecord = records[records.length - 1];

      const normPrices = records
        .map((r) => r.normalizedPricePerBaseCents)
        .filter((n): n is number => n !== null);

      let lowest: number | null = null;
      let highest: number | null = null;
      let average: number | null = null;

      if (hasCostPermission && normPrices.length > 0) {
        lowest = Math.min(...normPrices);
        highest = Math.max(...normPrices);
        average = Math.round(normPrices.reduce((a, b) => a + b, 0) / normPrices.length);
      }

      let priceChangeCents: number | null = null;
      let priceChangePct: number | null = null;
      let previousNormalizedPriceCents: number | null = null;
      let trendDirection: 'up' | 'down' | 'flat' | 'insufficient_data' = 'insufficient_data';

      if (
        hasCostPermission &&
        latestRecord.normalizedPricePerBaseCents !== null &&
        latestRecord.changeVsPreviousCents !== null &&
        latestRecord.changeVsPreviousCents !== undefined
      ) {
        priceChangeCents = latestRecord.changeVsPreviousCents;
        priceChangePct = latestRecord.changeVsPreviousPercentage ?? null;
        previousNormalizedPriceCents = latestRecord.normalizedPricePerBaseCents - priceChangeCents;

        if (priceChangeCents > 0) trendDirection = 'up';
        else if (priceChangeCents < 0) trendDirection = 'down';
        else trendDirection = 'flat';
      }

      trendsByCurrency.push({
        currency: curr,
        currentNormalizedPriceCents: hasCostPermission ? latestRecord.normalizedPricePerBaseCents : null,
        previousNormalizedPriceCents: hasCostPermission ? previousNormalizedPriceCents : null,
        priceChangeCents: hasCostPermission ? priceChangeCents : null,
        priceChangePercentage: hasCostPermission ? priceChangePct : null,
        lowestNormalizedPriceCents: lowest,
        highestNormalizedPriceCents: highest,
        averageNormalizedPriceCents: average,
        observationCount: count,
        timeRange,
        history: records,
        trendDirection,
      });
    }

    // Sort all observations reverse-chronologically for table ledger display
    const sortedAll = [...allEnrichedObservations].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    return {
      itemId: item.id,
      itemName: item.name,
      baseUnit: item.base_unit,
      trendsByCurrency,
      allObservations: sortedAll,
    };
  }

  /**
   * Retrieves historical prices specifically for a given (supplier, item) relationship.
   */
  static async getSupplierItemPriceHistory(
    businessId: string,
    supplierId: string,
    itemId: string,
    options?: { hasCostPermission?: boolean }
  ): Promise<PriceHistoryRecord[]> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const admin = createAdminClient();

    // Verify supplier and item belong to business
    const { data: sup } = await admin
      .from('inventory_suppliers')
      .select('id, name')
      .eq('id', supplierId)
      .eq('business_id', businessId)
      .maybeSingle();

    const { data: item } = await admin
      .from('inventory_items')
      .select('id, name, base_unit')
      .eq('id', itemId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!sup || !item) return [];

    const { data: rows } = await admin
      .from('inventory_price_history')
      .select('*')
      .eq('business_id', businessId)
      .eq('supplier_id', supplierId)
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: true });

    let previousNorm: number | null = null;
    const history: PriceHistoryRecord[] = [];

    (rows || []).forEach((r) => {
      const normCents = Number(r.normalized_price_per_base_cents);
      const packCents = Number(r.pack_price_cents);

      let changeCents: number | null = null;
      let changePct: number | null = null;

      if (previousNorm !== null) {
        changeCents = normCents - previousNorm;
        changePct =
          previousNorm > 0
            ? Number((((normCents - previousNorm) / previousNorm) * 100).toFixed(2))
            : 0;
      }
      previousNorm = normCents;

      history.push({
        id: r.id,
        businessId: r.business_id,
        branchId: r.branch_id,
        itemId: r.item_id,
        itemName: item.name,
        baseUnit: item.base_unit,
        supplierId: r.supplier_id,
        supplierName: sup.name,
        sourceType: r.source_type,
        sourceId: r.source_id,
        purchasingUnit: r.purchasing_unit,
        conversionToBase: Number(r.conversion_to_base) || 1.0,
        packPriceCents: hasCostPermission ? packCents : null,
        normalizedPricePerBaseCents: hasCostPermission ? normCents : null,
        currency: r.currency || 'USD',
        referenceNumber: r.reference_number,
        notes: r.notes,
        recordedAt: r.recorded_at,
        changeVsPreviousCents: hasCostPermission ? changeCents : null,
        changeVsPreviousPercentage: hasCostPermission ? changePct : null,
      });
    });

    // Return reverse-chronological
    return history.reverse();
  }

  /**
   * Records an authoritative supplier return atomically via database RPC.
   */
  static async recordSupplierReturn(input: SupplierReturnInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    if (input.branchId !== context.activeBranch.id) {
      return { success: false, message: 'Cross-branch supplier returns are forbidden.' };
    }

    if (isNaN(input.quantity) || !isFinite(input.quantity) || input.quantity <= 0) {
      return { success: false, message: 'Return quantity must be a valid positive number.' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('record_supplier_return', {
      p_business_id: context.business.id,
      p_branch_id: context.activeBranch.id,
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

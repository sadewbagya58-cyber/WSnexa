import { createAdminClient } from '@/lib/supabase/server';
import { UnitConverter } from '@/lib/inventory/unit-converter';
import { PurchasingService } from '@/server/services/purchasing.service';
import {
  CreateInventoryCategoryInput,
  CreateStorageLocationInput,
  CreateInventoryItemInput,
  StockAdjustmentInput,
  RecordWasteInput,
  CreateStockCountInput,
  SubmitStockCountInput,
  CreateStockTransferInput,
  ReceiveStockTransferInput,
  WasteReason,
  StockCountStatus,
  StockTransferStatus,
} from '@/lib/validation/inventory';

export type DemandConfidence = 'high' | 'medium' | 'low' | 'insufficient';
export type ReorderRiskStatus = 'critical' | 'reorder_soon' | 'healthy' | 'no_demand';

export interface SuggestedSupplierPurchase {
  supplierId: string;
  supplierName: string;
  supplierSku: string | null;
  purchasingUnit: string;
  conversionToBase: number;
  packsToOrder: number;
  orderQuantityBase: number;
  packPriceCents: number | null; // null if redacted
  totalEstimatedCents: number | null; // null if redacted
  currency: string;
  isPreferred: boolean;
}

export interface ItemForecastMetric {
  itemId: string;
  itemName: string;
  categoryName?: string | null;
  baseUnit: string;
  currentStock: number;
  openIncomingStock: number;
  projectedAvailableStock: number;

  // Demand metrics
  daysAnalyzed: number;
  totalDemandBase: number;
  averageDailyDemandBase: number;
  weightedDailyDemandBase: number;
  demandHistoryQuality: DemandConfidence;
  demandObservationsCount: number;

  // Days of Stock & Coverage
  daysOfStockRemaining: number | null;
  daysOfCoverageWithIncoming: number | null;

  // Reorder point & lead time
  leadTimeDays: number | null;
  hasLeadTimeIntelligence: boolean;
  safetyStockBase: number;
  reorderPointBase: number;
  targetCoverageDays: number;
  targetStockLevelBase: number;

  // Replenishment & Risk
  recommendedBaseQty: number;
  riskStatus: ReorderRiskStatus;
  explanation: string;

  // Near-expiry alert context (if any)
  nearExpiryStockBase?: number;
  nearExpiryDaysThreshold?: number;
  nearExpiryBatchCount?: number;

  // Supplier purchasing options
  suggestedSupplier?: SuggestedSupplierPurchase | null;
  preferredSupplierAlternative?: SuggestedSupplierPurchase | null;
  potentialSavingsCents?: number | null;
}

export interface ReorderSuggestionsOverview {
  branchId: string;
  currency: string;
  totalItemsTracked: number;
  criticalCount: number;
  reorderSoonCount: number;
  healthyCount: number;
  noDemandCount: number;
  totalEstimatedReorderCostCents: number | null;
  suggestions: ItemForecastMetric[];
}

export interface FormattedInventoryCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  icon: string;
  displayOrder: number;
}

export interface FormattedStorageLocation {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface FormattedInventoryItem {
  id: string;
  businessId: string;
  categoryId: string | null;
  categoryName?: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  itemType: string;
  baseUnit: string;
  costPerUnitCents: number | null; // null if cost redacted
  currency: string;
  minStockLevel: number;
  targetStockLevel: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  archivedAt: string | null;
  // Dynamic branch-level balance
  currentStockQuantity?: number;
  stockStatus?: 'healthy' | 'low_stock' | 'out_of_stock';
  totalStockValueCents?: number | null;
  locationBalances?: Array<{
    locationId: string;
    locationName: string;
    quantity: number;
  }>;
}

export interface FormattedStockMovement {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string;
  locationName?: string;
  itemId: string;
  itemName?: string;
  movementType: string;
  direction: 'in' | 'out' | 'set';
  quantity: number;
  unit: string;
  quantityBase: number;
  previousBalanceBase: number;
  newBalanceBase: number;
  unitCostCents: number | null;
  totalCostCents: number | null;
  currency: string;
  reason: string | null;
  notes: string | null;
  actorId: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface FormattedWasteRecord {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string;
  locationName?: string;
  itemId: string;
  itemName?: string;
  baseUnit?: string;
  quantity: number;
  unit: string;
  quantityBase: number;
  totalCostCents: number | null;
  currency: string;
  reason: WasteReason;
  notes: string | null;
  actorId: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface FormattedStockCount {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string;
  locationName?: string;
  countNumber: string;
  title: string;
  status: StockCountStatus;
  isBlindCount: boolean;
  categoryId: string | null;
  categoryName?: string | null;
  totalItemsCounted: number;
  totalVarianceCostCents: number | null;
  currency: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    itemId: string;
    itemName: string;
    baseUnit: string;
    expectedQuantityBase: number | null; // hidden if blind count in progress
    countedQuantityBase: number | null;
    countedUnit: string | null;
    countedRawQuantity: number | null;
    varianceQuantityBase: number | null;
    varianceCostCents: number | null;
    isCounted: boolean;
    notes: string | null;
  }>;
}

export interface FormattedStockTransfer {
  id: string;
  businessId: string;
  sourceBranchId: string;
  sourceBranchName?: string;
  sourceLocationId: string;
  sourceLocationName?: string;
  destinationBranchId: string;
  destinationBranchName?: string;
  destinationLocationId: string;
  destinationLocationName?: string;
  transferNumber: string;
  status: StockTransferStatus;
  sentAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  discrepancyReason: string | null;
  notes: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    itemId: string;
    itemName: string;
    baseUnit: string;
    quantitySent: number;
    unitSent: string;
    quantitySentBase: number;
    quantityReceivedBase: number | null;
    discrepancyQuantityBase: number;
    unitCostCents: number | null;
    currency: string;
  }>;
}

export interface InventoryOverviewPayload {
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'critical' | 'insufficient_data';
  healthExplanation: string[];
  totalItemsCount: number;
  healthyItemsCount: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  totalStockValueCents: number | null;
  wasteTodayValueCents: number | null;
  expiringSoonCount: number;
  currency: string;
  needsAttention: Array<{
    type: 'low_stock' | 'out_of_stock' | 'expiring' | 'pending_transfer' | 'pending_count';
    itemId?: string;
    itemName?: string;
    currentQuantity?: number;
    baseUnit?: string;
    message: string;
    actionLabel: string;
    actionHref: string;
  }>;
}

export type BatchExpiryStatus = 'expired' | 'expiring_soon' | 'healthy' | 'no_expiry';

export interface FormattedItemBatch {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName?: string;
  batchCode: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCostCents: number | null; // null if cost redacted
  totalStockValueCents: number | null; // null if cost redacted
  currency: string;
  receivedDate: string;
  expiryDate: string | null;
  expiryStatus: BatchExpiryStatus;
  daysUntilExpiry: number | null;
  status: 'active' | 'consumed' | 'expired' | 'discarded';
  createdAt: string;
}

export type ExpiryAlertSeverity = 'expired' | 'critical' | 'expiring_soon' | 'upcoming';

export interface FormattedExpiringBatch {
  id: string;
  businessId: string;
  branchId: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemName: string;
  baseUnit: string;
  batchCode: string;
  remainingQuantity: number;
  unitCostCents: number | null; // null if cost redacted
  totalStockValueCents: number | null; // null if cost redacted
  currency: string;
  receivedDate: string;
  expiryDate: string;
  daysUntilExpiry: number;
  severity: ExpiryAlertSeverity;
  createdAt: string;
}

export interface ExpiryAlertSummary {
  expiredCount: number;
  expiredQuantity: number;
  criticalCount: number; // 0-3 days
  soonCount: number; // 4-7 days
  upcomingCount: number; // 8-14 days
  totalExpiringCount: number;
  batches: FormattedExpiringBatch[];
}

export class InventoryService {
  /**
   * Fetch all tenant categories, seeding default hospitality categories if empty.
   */
  static async getCategories(businessId: string): Promise<FormattedInventoryCategory[]> {
    const admin = createAdminClient();

    const { data: categories, error } = await admin
      .from('inventory_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error || !categories) return [];

    if (categories.length === 0) {
      // Seed default categories for convenient first-time UX
      const defaults = [
        { business_id: businessId, name: 'Meat & Poultry', icon: '🥩', display_order: 1 },
        { business_id: businessId, name: 'Seafood', icon: '🐟', display_order: 2 },
        { business_id: businessId, name: 'Vegetables & Greens', icon: '🥦', display_order: 3 },
        { business_id: businessId, name: 'Fruits', icon: '🍎', display_order: 4 },
        { business_id: businessId, name: 'Dairy & Eggs', icon: '🥛', display_order: 5 },
        { business_id: businessId, name: 'Dry Goods & Grains', icon: '🌾', display_order: 6 },
        { business_id: businessId, name: 'Beverages & Bar', icon: '🍷', display_order: 7 },
        { business_id: businessId, name: 'Bakery & Pastry', icon: '🍞', display_order: 8 },
        { business_id: businessId, name: 'Sauces & Spices', icon: '🥫', display_order: 9 },
        { business_id: businessId, name: 'Packaging & Disposables', icon: '📦', display_order: 10 },
        { business_id: businessId, name: 'Cleaning & Supplies', icon: '🧼', display_order: 11 },
      ];

      const { data: seeded } = await admin
        .from('inventory_categories')
        .insert(defaults)
        .select('*');

      if (seeded && seeded.length > 0) {
        return seeded.map((c) => ({
          id: c.id,
          businessId: c.business_id,
          name: c.name,
          description: c.description,
          icon: c.icon || '📦',
          displayOrder: c.display_order,
        }));
      }
    }

    return categories.map((c) => ({
      id: c.id,
      businessId: c.business_id,
      name: c.name,
      description: c.description,
      icon: c.icon || '📦',
      displayOrder: c.display_order,
    }));
  }

  /**
   * Create an inventory category.
   */
  static async createCategory(businessId: string, input: CreateInventoryCategoryInput) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('inventory_categories')
      .insert({
        business_id: businessId,
        name: input.name,
        description: input.description || null,
        icon: input.icon || '📦',
        display_order: input.displayOrder || 0,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to create inventory category.' };
    }

    return {
      success: true,
      category: {
        id: data.id,
        businessId: data.business_id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        displayOrder: data.display_order,
      },
    };
  }

  /**
   * Fetch all storage locations for a branch, guaranteeing default 'Main Stock' exists.
   */
  static async getBranchLocations(businessId: string, branchId: string): Promise<FormattedStorageLocation[]> {
    const admin = createAdminClient();

    let { data: locations } = await admin
      .from('inventory_storage_locations')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!locations || locations.length === 0) {
      // Auto-create default 'Main Stock' location
      await admin.rpc('get_or_create_default_storage_location', {
        p_business_id: businessId,
        p_branch_id: branchId,
      });

      const { data: refetched } = await admin
        .from('inventory_storage_locations')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .is('deleted_at', null);

      locations = refetched || [];
    }

    return (locations || []).map((l) => ({
      id: l.id,
      businessId: l.business_id,
      branchId: l.branch_id,
      name: l.name,
      code: l.code,
      description: l.description,
      isDefault: l.is_default,
      isActive: l.is_active,
      displayOrder: l.display_order,
    }));
  }

  /**
   * Create a new storage location in a branch.
   */
  static async createLocation(businessId: string, input: CreateStorageLocationInput) {
    const admin = createAdminClient();

    // If marked default, unset other defaults in same branch
    if (input.isDefault) {
      await admin
        .from('inventory_storage_locations')
        .update({ is_default: false })
        .eq('branch_id', input.branchId);
    }

    const { data, error } = await admin
      .from('inventory_storage_locations')
      .insert({
        business_id: businessId,
        branch_id: input.branchId,
        name: input.name,
        code: input.code.toUpperCase(),
        description: input.description || null,
        is_default: input.isDefault,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to create storage location.' };
    }

    return {
      success: true,
      location: {
        id: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        name: data.name,
        code: data.code,
        description: data.description,
        isDefault: data.is_default,
        isActive: data.is_active,
        displayOrder: data.display_order,
      },
    };
  }

  /**
   * Fetch inventory items with branch-scoped balances and stock status.
   */
  static async getInventoryItems(
    businessId: string,
    branchId: string,
    options: {
      categoryId?: string;
      query?: string;
      stockStatus?: 'all' | 'healthy' | 'low_stock' | 'out_of_stock' | 'archived';
      hasCostPermission?: boolean;
    } = {}
  ): Promise<FormattedInventoryItem[]> {
    const admin = createAdminClient();
    const { categoryId, query, stockStatus = 'all', hasCostPermission = false } = options;

    let itemsQuery = admin
      .from('inventory_items')
      .select(`
        *,
        category:inventory_categories(id, name)
      `)
      .eq('business_id', businessId);

    if (stockStatus === 'archived') {
      itemsQuery = itemsQuery.not('archived_at', 'is', null);
    } else {
      itemsQuery = itemsQuery.is('archived_at', null);
    }

    if (categoryId) {
      itemsQuery = itemsQuery.eq('category_id', categoryId);
    }

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      itemsQuery = itemsQuery.or(`name.ilike.${q},sku.ilike.${q},barcode.ilike.${q}`);
    }

    itemsQuery = itemsQuery.order('name', { ascending: true });

    // Fetch items, branch balances, and business default currency in parallel
    const [{ data: items, error: itemsErr }, { data: balances }, { data: biz }] = await Promise.all([
      itemsQuery,
      admin
        .from('inventory_balances')
        .select(`
          *,
          location:inventory_storage_locations(id, name)
        `)
        .eq('branch_id', branchId),
      admin
        .from('businesses')
        .select('default_currency')
        .eq('id', businessId)
        .maybeSingle(),
    ]);

    if (itemsErr || !items) return [];
    const businessCurrency = biz?.default_currency || 'USD';

    const balanceMap = new Map<string, { total: number; locations: Array<{ locationId: string; locationName: string; quantity: number }> }>();
    (balances || []).forEach((b) => {
      const existing = balanceMap.get(b.item_id) || { total: 0, locations: [] };
      existing.total += Number(b.current_quantity);
      existing.locations.push({
        locationId: b.location_id,
        locationName: b.location?.name || 'Storage',
        quantity: Number(b.current_quantity),
      });
      balanceMap.set(b.item_id, existing);
    });

    const formatted: FormattedInventoryItem[] = items.map((item) => {
      const bal = balanceMap.get(item.id) || { total: 0, locations: [] };
      const currentStock = bal.total;

      let status: 'healthy' | 'low_stock' | 'out_of_stock' = 'healthy';
      if (currentStock <= 0) {
        status = 'out_of_stock';
      } else if (item.min_stock_level > 0 && currentStock <= item.min_stock_level) {
        status = 'low_stock';
      }

      const totalVal = hasCostPermission ? Math.round(currentStock * item.cost_per_unit_cents) : null;

      return {
        id: item.id,
        businessId: item.business_id,
        categoryId: item.category_id,
        categoryName: item.category?.name || null,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        description: item.description,
        itemType: item.item_type,
        baseUnit: item.base_unit,
        costPerUnitCents: hasCostPermission ? item.cost_per_unit_cents : null,
        currency: businessCurrency,
        minStockLevel: Number(item.min_stock_level),
        targetStockLevel: Number(item.target_stock_level),
        trackBatches: item.track_batches,
        trackExpiry: item.track_expiry,
        isActive: item.is_active,
        archivedAt: item.archived_at,
        currentStockQuantity: currentStock,
        stockStatus: status,
        totalStockValueCents: totalVal,
        locationBalances: bal.locations,
      };
    });

    if (stockStatus && stockStatus !== 'all' && stockStatus !== 'archived') {
      return formatted.filter((f) => f.stockStatus === stockStatus);
    }

    return formatted;
  }

  /**
   * Fetch single item detail with location balances and movement history.
   */
  static async getInventoryItemById(
    businessId: string,
    branchId: string,
    itemId: string,
    hasCostPermission = false
  ): Promise<FormattedInventoryItem | null> {
    const admin = createAdminClient();

    const [{ data: item }, { data: balances }, { data: biz }] = await Promise.all([
      admin
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories(id, name)
        `)
        .eq('id', itemId)
        .eq('business_id', businessId)
        .single(),
      admin
        .from('inventory_balances')
        .select(`
          *,
          location:inventory_storage_locations(id, name)
        `)
        .eq('branch_id', branchId)
        .eq('item_id', itemId),
      admin
        .from('businesses')
        .select('default_currency')
        .eq('id', businessId)
        .maybeSingle(),
    ]);

    if (!item) return null;
    const businessCurrency = biz?.default_currency || 'USD';

    let totalQty = 0;
    const locBals = (balances || []).map((b) => {
      const q = Number(b.current_quantity);
      totalQty += q;
      return {
        locationId: b.location_id,
        locationName: b.location?.name || 'Storage',
        quantity: q,
      };
    });

    let status: 'healthy' | 'low_stock' | 'out_of_stock' = 'healthy';
    if (totalQty <= 0) {
      status = 'out_of_stock';
    } else if (item.min_stock_level > 0 && totalQty <= item.min_stock_level) {
      status = 'low_stock';
    }

    return {
      id: item.id,
      businessId: item.business_id,
      categoryId: item.category_id,
      categoryName: item.category?.name || null,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      description: item.description,
      itemType: item.item_type,
      baseUnit: item.base_unit,
      costPerUnitCents: hasCostPermission ? item.cost_per_unit_cents : null,
      currency: businessCurrency,
      minStockLevel: Number(item.min_stock_level),
      targetStockLevel: Number(item.target_stock_level),
      trackBatches: item.track_batches,
      trackExpiry: item.track_expiry,
      isActive: item.is_active,
      archivedAt: item.archived_at,
      currentStockQuantity: totalQty,
      stockStatus: status,
      totalStockValueCents: hasCostPermission ? Math.round(totalQty * item.cost_per_unit_cents) : null,
      locationBalances: locBals,
    };
  }

  /**
   * Create an inventory item with optional opening stock.
   */
  static async createInventoryItem(
    businessId: string,
    branchId: string,
    actorId: string,
    currency: string,
    input: CreateInventoryItemInput
  ) {
    const admin = createAdminClient();

    // 1. Insert Item
    const { data: item, error: itemErr } = await admin
      .from('inventory_items')
      .insert({
        business_id: businessId,
        category_id: input.categoryId || null,
        name: input.name,
        sku: input.sku || null,
        barcode: input.barcode || null,
        description: input.description || null,
        item_type: input.itemType,
        base_unit: input.baseUnit.toLowerCase(),
        cost_per_unit_cents: input.costPerUnitCents || 0,
        currency: currency,
        min_stock_level: input.minStockLevel || 0,
        target_stock_level: input.targetStockLevel || 0,
        track_batches: input.trackBatches || false,
        track_expiry: input.trackExpiry || false,
        is_active: true,
      })
      .select('*')
      .single();

    if (itemErr || !item) {
      return { success: false, message: itemErr?.message || 'Failed to create inventory item.' };
    }

    // 2. If opening stock provided, record opening balance adjustment
    if (input.initialQuantity && input.initialQuantity > 0) {
      let locId = input.initialLocationId;
      if (!locId) {
        // Resolve default location
        locId = await this.getOrCreateDefaultLocation(businessId, branchId);
      }

      await admin.rpc('record_inventory_adjustment', {
        p_business_id: businessId,
        p_branch_id: branchId,
        p_location_id: locId,
        p_item_id: item.id,
        p_direction: 'in',
        p_quantity: input.initialQuantity,
        p_unit: input.baseUnit,
        p_quantity_base: input.initialQuantity,
        p_reason: 'Opening stock count upon item creation',
        p_notes: 'Initial balance setup',
        p_actor_id: actorId,
        p_idempotency_key: `init_${item.id}_${Date.now()}`,
        p_movement_type: 'opening_balance',
      });
    }

    return { success: true, item };
  }

  /**
   * Helper to ensure default storage location exists for branch.
   */
  static async getOrCreateDefaultLocation(businessId: string, branchId: string): Promise<string> {
    const admin = createAdminClient();
    const { data: locId } = await admin.rpc('get_or_create_default_storage_location', {
      p_business_id: businessId,
      p_branch_id: branchId,
    });
    return locId;
  }

  /**
   * Record authoritative stock adjustment.
   */
  static async recordStockAdjustment(
    businessId: string,
    branchId: string,
    actorId: string,
    input: StockAdjustmentInput
  ) {
    const admin = createAdminClient();

    // Verify item base unit
    const { data: item } = await admin
      .from('inventory_items')
      .select('id, base_unit, name')
      .eq('id', input.itemId)
      .eq('business_id', businessId)
      .single();

    if (!item) {
      return { success: false, message: 'Inventory item not found.' };
    }

    // Normalize unit
    let normalizedBaseQty: number;
    try {
      normalizedBaseQty = UnitConverter.normalizeToBase(input.quantity, input.unit, item.base_unit);
    } catch (convErr: unknown) {
      return { success: false, message: (convErr as Error).message || 'Unit conversion failed.' };
    }

    // Execute atomic RPC
    const { data, error } = await admin.rpc('record_inventory_adjustment', {
      p_business_id: businessId,
      p_branch_id: input.branchId,
      p_location_id: input.locationId,
      p_item_id: input.itemId,
      p_direction: input.direction,
      p_quantity: input.quantity,
      p_unit: input.unit,
      p_quantity_base: normalizedBaseQty,
      p_reason: input.reason,
      p_notes: input.notes || null,
      p_actor_id: actorId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to record stock adjustment.' };
    }

    const payload = data as { success: boolean; error?: string; message?: string; new_quantity?: number };
    if (!payload.success) {
      return { success: false, message: payload.message || payload.error || 'Adjustment failed.' };
    }

    return { success: true, data: payload };
  }

  /**
   * Record food & beverage waste.
   */
  static async recordWaste(
    businessId: string,
    branchId: string,
    actorId: string,
    input: RecordWasteInput
  ) {
    const admin = createAdminClient();

    const { data: item } = await admin
      .from('inventory_items')
      .select('id, base_unit, name')
      .eq('id', input.itemId)
      .eq('business_id', businessId)
      .single();

    if (!item) {
      return { success: false, message: 'Inventory item not found.' };
    }

    let normalizedBaseQty: number;
    try {
      normalizedBaseQty = UnitConverter.normalizeToBase(input.quantity, input.unit, item.base_unit);
    } catch (convErr: unknown) {
      return { success: false, message: (convErr as Error).message || 'Unit conversion failed.' };
    }

    const { data, error } = await admin.rpc('record_inventory_waste', {
      p_business_id: businessId,
      p_branch_id: input.branchId,
      p_location_id: input.locationId,
      p_item_id: input.itemId,
      p_batch_id: input.batchId || null,
      p_quantity: input.quantity,
      p_unit: input.unit,
      p_quantity_base: normalizedBaseQty,
      p_reason: input.reason,
      p_notes: input.notes || null,
      p_actor_id: actorId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to record waste.' };
    }

    const payload = data as { success: boolean; error?: string; message?: string; waste_id?: string };
    if (!payload.success) {
      return { success: false, message: payload.message || payload.error || 'Waste recording failed.' };
    }

    return { success: true, data: payload };
  }

  /**
   * Physical Stock Counts: List
   */
  static async getStockCounts(
    businessId: string,
    branchId: string,
    hasCostPermission = false
  ): Promise<FormattedStockCount[]> {
    const admin = createAdminClient();

    const { data: counts } = await admin
      .from('inventory_stock_counts')
      .select(`
        *,
        location:inventory_storage_locations(id, name),
        category:inventory_categories(id, name)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    return (counts || []).map((c) => ({
      id: c.id,
      businessId: c.business_id,
      branchId: c.branch_id,
      locationId: c.location_id,
      locationName: c.location?.name || 'Storage Location',
      countNumber: c.count_number,
      title: c.title,
      status: c.status,
      isBlindCount: c.is_blind_count,
      categoryId: c.category_id,
      categoryName: c.category?.name || 'All Categories',
      totalItemsCounted: c.total_items_counted,
      totalVarianceCostCents: hasCostPermission ? c.total_variance_cost_cents : null,
      currency: c.currency,
      startedAt: c.started_at,
      submittedAt: c.submitted_at,
      approvedAt: c.approved_at,
      createdAt: c.created_at,
    }));
  }

  /**
   * Physical Stock Counts: Detail with Sheet Items
   */
  static async getStockCountById(
    businessId: string,
    branchId: string,
    countId: string,
    hasCostPermission = false
  ): Promise<FormattedStockCount | null> {
    const admin = createAdminClient();

    const { data: count } = await admin
      .from('inventory_stock_counts')
      .select(`
        *,
        location:inventory_storage_locations(id, name),
        category:inventory_categories(id, name)
      `)
      .eq('id', countId)
      .eq('business_id', businessId)
      .single();

    if (!count) return null;

    const { data: items } = await admin
      .from('inventory_stock_count_items')
      .select(`
        *,
        item:inventory_items(id, name, base_unit)
      `)
      .eq('count_id', countId)
      .order('created_at', { ascending: true });

    const isCountingBlind = count.is_blind_count && count.status !== 'approved';

    return {
      id: count.id,
      businessId: count.business_id,
      branchId: count.branch_id,
      locationId: count.location_id,
      locationName: count.location?.name || 'Storage',
      countNumber: count.count_number,
      title: count.title,
      status: count.status,
      isBlindCount: count.is_blind_count,
      categoryId: count.category_id,
      categoryName: count.category?.name || 'All Categories',
      totalItemsCounted: count.total_items_counted,
      totalVarianceCostCents: hasCostPermission ? count.total_variance_cost_cents : null,
      currency: count.currency,
      startedAt: count.started_at,
      submittedAt: count.submitted_at,
      approvedAt: count.approved_at,
      createdAt: count.created_at,
      items: (items || []).map((ci) => ({
        id: ci.id,
        itemId: ci.item_id,
        itemName: ci.item?.name || 'Item',
        baseUnit: ci.item?.base_unit || 'pcs',
        expectedQuantityBase: isCountingBlind ? null : Number(ci.expected_quantity_base),
        countedQuantityBase: ci.counted_quantity_base !== null ? Number(ci.counted_quantity_base) : null,
        countedUnit: ci.counted_unit,
        countedRawQuantity: ci.counted_raw_quantity !== null ? Number(ci.counted_raw_quantity) : null,
        varianceQuantityBase: isCountingBlind ? null : (ci.variance_quantity_base !== null ? Number(ci.variance_quantity_base) : null),
        varianceCostCents: hasCostPermission && !isCountingBlind ? ci.variance_cost_cents : null,
        isCounted: ci.is_counted,
        notes: ci.notes,
      })),
    };
  }

  /**
   * Create Stock Count audit sheet.
   */
  static async createStockCount(
    businessId: string,
    branchId: string,
    actorId: string,
    currency: string,
    input: CreateStockCountInput
  ) {
    const admin = createAdminClient();

    // 1. Normalize category scope: 'all' / empty / null / undefined means Full Audit (All Categories)
    const normalizedCategoryId =
      input.categoryId &&
      typeof input.categoryId === 'string' &&
      input.categoryId.trim() !== '' &&
      input.categoryId.trim().toLowerCase() !== 'all' &&
      input.categoryId.trim().toLowerCase() !== 'null' &&
      input.categoryId.trim().toLowerCase() !== 'undefined'
        ? input.categoryId.trim()
        : null;

    // 2. Generate count number
    const countNumber = `CNT-${Date.now().toString(36).toUpperCase()}`;

    const effectiveBranchId = input.branchId || branchId;
    const { data: count, error } = await admin
      .from('inventory_stock_counts')
      .insert({
        business_id: businessId,
        branch_id: effectiveBranchId,
        location_id: input.locationId,
        count_number: countNumber,
        title: input.title,
        status: 'counting',
        is_blind_count: input.isBlindCount,
        category_id: normalizedCategoryId,
        started_at: new Date().toISOString(),
        created_by: actorId,
        counted_by: actorId,
        currency: currency || 'USD',
        notes: input.notes || null,
      })
      .select('*')
      .single();

    if (error || !count) {
      return { success: false, message: error?.message || 'Failed to create stock count.' };
    }

    // 3. Populate count items from active inventory items
    let itemsQuery = admin
      .from('inventory_items')
      .select('id, name, base_unit, cost_per_unit_cents, category_id, is_active')
      .eq('business_id', businessId)
      .is('archived_at', null);

    // If a specific category is selected, filter strictly to that category
    if (normalizedCategoryId) {
      itemsQuery = itemsQuery.eq('category_id', normalizedCategoryId);
    }

    itemsQuery = itemsQuery.order('name', { ascending: true });

    const { data: eligibleItems, error: itemsErr } = await itemsQuery;
    if (itemsErr) {
      await admin.from('inventory_stock_counts').delete().eq('id', count.id);
      return { success: false, message: `Failed to query inventory items: ${itemsErr.message}` };
    }

    // 4. Fetch current stock balances for the selected storage location
    const { data: balances } = await admin
      .from('inventory_balances')
      .select('item_id, current_quantity')
      .eq('branch_id', effectiveBranchId)
      .eq('location_id', input.locationId);

    const balMap = new Map<string, number>();
    (balances || []).forEach((b) => balMap.set(b.item_id, Number(b.current_quantity)));

    const countItemsToInsert = (eligibleItems || []).map((it) => {
      const expQty = balMap.get(it.id) || 0;
      return {
        count_id: count.id,
        item_id: it.id,
        expected_quantity_base: expQty,
        unit_cost_cents: it.cost_per_unit_cents || 0,
        currency: currency || 'USD',
        is_counted: false,
      };
    });

    if (countItemsToInsert.length > 0) {
      const { error: insErr } = await admin.from('inventory_stock_count_items').insert(countItemsToInsert);
      if (insErr) {
        await admin.from('inventory_stock_counts').delete().eq('id', count.id);
        return { success: false, message: `Failed to populate count sheet items: ${insErr.message}` };
      }
    }

    return { success: true, countId: count.id, countNumber };
  }

  /**
   * Submit Stock Count entries.
   */
  static async submitStockCount(
    businessId: string,
    branchId: string,
    actorId: string,
    input: SubmitStockCountInput
  ) {
    const admin = createAdminClient();

    // Verify count
    const { data: count } = await admin
      .from('inventory_stock_counts')
      .select('id, status, location_id')
      .eq('id', input.countId)
      .eq('business_id', businessId)
      .single();

    if (!count || count.status !== 'counting') {
      return { success: false, message: 'Stock count not found or not in counting state.' };
    }

    // Update each item
    for (const entry of input.items) {
      const { data: item } = await admin
        .from('inventory_items')
        .select('base_unit')
        .eq('id', entry.itemId)
        .single();

      if (item) {
        let baseCounted: number;
        try {
          baseCounted = UnitConverter.normalizeToBase(entry.countedRawQuantity, entry.countedUnit, item.base_unit);
        } catch {
          baseCounted = entry.countedRawQuantity;
        }

        await admin
          .from('inventory_stock_count_items')
          .update({
            counted_raw_quantity: entry.countedRawQuantity,
            counted_unit: entry.countedUnit,
            counted_quantity_base: baseCounted,
            is_counted: true,
            notes: entry.notes || null,
          })
          .eq('count_id', input.countId)
          .eq('item_id', entry.itemId);
      }
    }

    // Mark submitted
    await admin
      .from('inventory_stock_counts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        total_items_counted: input.items.length,
        notes: input.notes || null,
      })
      .eq('id', input.countId);

    return { success: true };
  }

  /**
   * Approve Stock Count and reconcile balances atomically.
   */
  static async approveStockCount(
    businessId: string,
    branchId: string,
    actorId: string,
    countId: string
  ) {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc('approve_stock_count_and_reconcile', {
      p_count_id: countId,
      p_actor_id: actorId,
    });

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to approve stock count.' };
    }

    const payload = data as { success: boolean; error?: string; message?: string };
    if (!payload.success) {
      return { success: false, message: payload.message || payload.error || 'Approval failed.' };
    }

    return { success: true };
  }

  /**
   * Stock Transfers: List
   */
  static async getStockTransfers(
    businessId: string,
    branchId: string
  ): Promise<FormattedStockTransfer[]> {
    const admin = createAdminClient();

    const { data: transfers } = await admin
      .from('inventory_stock_transfers')
      .select(`
        *,
        source_branch:branches!inventory_stock_transfers_source_branch_id_fkey(id, name),
        destination_branch:branches!inventory_stock_transfers_destination_branch_id_fkey(id, name),
        source_location:inventory_storage_locations!inventory_stock_transfers_source_location_id_fkey(id, name),
        destination_location:inventory_storage_locations!inventory_stock_transfers_destination_location_id_fkey(id, name)
      `)
      .eq('business_id', businessId)
      .or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`)
      .order('created_at', { ascending: false });

    return (transfers || []).map((t) => ({
      id: t.id,
      businessId: t.business_id,
      sourceBranchId: t.source_branch_id,
      sourceBranchName: t.source_branch?.name || 'Branch',
      sourceLocationId: t.source_location_id,
      sourceLocationName: t.source_location?.name || 'Source',
      destinationBranchId: t.destination_branch_id,
      destinationBranchName: t.destination_branch?.name || 'Branch',
      destinationLocationId: t.destination_location_id,
      destinationLocationName: t.destination_location?.name || 'Destination',
      transferNumber: t.transfer_number,
      status: t.status,
      sentAt: t.sent_at,
      receivedAt: t.received_at,
      cancelledAt: t.cancelled_at,
      cancellationReason: t.cancellation_reason,
      discrepancyReason: t.discrepancy_reason,
      notes: t.notes,
      createdAt: t.created_at,
    }));
  }

  /**
   * Stock Transfers: Create Draft
   */
  static async createStockTransfer(
    businessId: string,
    actorId: string,
    currency: string,
    input: CreateStockTransferInput
  ) {
    const admin = createAdminClient();

    // 1. Verify source and dest belong to same business
    const { data: srcBranch } = await admin
      .from('branches')
      .select('id, business_id')
      .eq('id', input.sourceBranchId)
      .eq('business_id', businessId)
      .single();

    const { data: dstBranch } = await admin
      .from('branches')
      .select('id, business_id')
      .eq('id', input.destinationBranchId)
      .eq('business_id', businessId)
      .single();

    if (!srcBranch || !dstBranch) {
      return { success: false, message: 'Invalid source or destination branch. Must belong to the same business.' };
    }

    const transferNumber = `TR-${Date.now().toString(36).toUpperCase()}`;

    // 2. Insert transfer header
    const { data: transfer, error: trErr } = await admin
      .from('inventory_stock_transfers')
      .insert({
        business_id: businessId,
        source_branch_id: input.sourceBranchId,
        source_location_id: input.sourceLocationId,
        destination_branch_id: input.destinationBranchId,
        destination_location_id: input.destinationLocationId,
        transfer_number: transferNumber,
        status: 'draft',
        notes: input.notes || null,
      })
      .select('*')
      .single();

    if (trErr || !transfer) {
      return { success: false, message: trErr?.message || 'Failed to create stock transfer.' };
    }

    // 3. Insert items with base conversion
    const itemsToInsert = [];
    for (const itemInput of input.items) {
      const { data: item } = await admin
        .from('inventory_items')
        .select('id, base_unit, cost_per_unit_cents')
        .eq('id', itemInput.itemId)
        .eq('business_id', businessId)
        .single();

      if (item) {
        let baseQty: number;
        try {
          baseQty = UnitConverter.normalizeToBase(itemInput.quantitySent, itemInput.unitSent, item.base_unit);
        } catch (convErr: unknown) {
          return { success: false, message: (convErr as Error).message };
        }

        itemsToInsert.push({
          transfer_id: transfer.id,
          item_id: item.id,
          batch_id: itemInput.batchId || null,
          quantity_sent: itemInput.quantitySent,
          unit_sent: itemInput.unitSent,
          quantity_sent_base: baseQty,
          unit_cost_cents: item.cost_per_unit_cents,
          currency: currency,
        });
      }
    }

    if (itemsToInsert.length > 0) {
      await admin.from('inventory_stock_transfer_items').insert(itemsToInsert);
    }

    return { success: true, transferId: transfer.id, transferNumber };
  }

  /**
   * Dispatch Stock Transfer (reduces source balance, marks in_transit)
   */
  static async sendStockTransfer(businessId: string, actorId: string, transferId: string) {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc('execute_stock_transfer_send', {
      p_transfer_id: transferId,
      p_actor_id: actorId,
    });

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to dispatch stock transfer.' };
    }

    const payload = data as { success: boolean; error?: string; message?: string };
    if (!payload.success) {
      return { success: false, message: payload.message || payload.error || 'Dispatch failed.' };
    }

    return { success: true };
  }

  /**
   * Receive Inbound Stock Transfer (adds to dest balance, handles discrepancy)
   */
  static async receiveStockTransfer(
    businessId: string,
    actorId: string,
    input: ReceiveStockTransferInput
  ) {
    const admin = createAdminClient();

    const { data, error } = await admin.rpc('execute_stock_transfer_receive', {
      p_transfer_id: input.transferId,
      p_actor_id: actorId,
      p_received_items: input.receivedItems || null,
      p_discrepancy_reason: input.discrepancyReason || null,
    });

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to receive stock transfer.' };
    }

    const payload = data as { success: boolean; error?: string; message?: string };
    if (!payload.success) {
      return { success: false, message: payload.message || payload.error || 'Receipt failed.' };
    }

    return { success: true };
  }

  /**
   * Movement History with Pagination
   */
  static async getMovements(
    businessId: string,
    branchId: string,
    options: {
      itemId?: string;
      locationId?: string;
      limit?: number;
      offset?: number;
      hasCostPermission?: boolean;
    } = {}
  ): Promise<FormattedStockMovement[]> {
    const admin = createAdminClient();
    const { itemId, locationId, limit = 50, offset = 0, hasCostPermission = false } = options;

    let q = admin
      .from('inventory_stock_movements')
      .select(`
        *,
        item:inventory_items(name),
        location:inventory_storage_locations(name)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId);

    if (itemId) q = q.eq('item_id', itemId);
    if (locationId) q = q.eq('location_id', locationId);

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: movements } = await q;

    const actorIds = Array.from(new Set((movements || []).map((m) => m.actor_id).filter(Boolean))) as string[];
    const actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .in('id', actorIds);

      (profiles || []).forEach((p) => {
        const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Staff';
        actorMap.set(p.id, fullName);
      });
    }

    return (movements || []).map((m) => ({
      id: m.id,
      businessId: m.business_id,
      branchId: m.branch_id,
      locationId: m.location_id,
      locationName: m.location?.name || 'Storage',
      itemId: m.item_id,
      itemName: m.item?.name || 'Item',
      movementType: m.movement_type,
      direction: m.direction,
      quantity: Number(m.quantity),
      unit: m.unit,
      quantityBase: Number(m.quantity_base),
      previousBalanceBase: Number(m.previous_balance_base),
      newBalanceBase: Number(m.new_balance_base),
      unitCostCents: hasCostPermission ? m.unit_cost_cents : null,
      totalCostCents: hasCostPermission ? m.total_cost_cents : null,
      currency: m.currency,
      reason: m.reason,
      notes: m.notes,
      actorId: m.actor_id,
      actorName: m.actor_id ? actorMap.get(m.actor_id) || 'Staff' : 'System',
      createdAt: m.created_at,
    }));
  }

  /**
   * Waste Log with Date/Reason Filtering
   */
  static async getWasteRecords(
    businessId: string,
    branchId: string,
    options: {
      reason?: string;
      hasCostPermission?: boolean;
      limit?: number;
    } = {}
  ): Promise<FormattedWasteRecord[]> {
    const admin = createAdminClient();
    const { reason, hasCostPermission = false, limit = 50 } = options;

    let q = admin
      .from('inventory_waste_records')
      .select(`
        *,
        item:inventory_items(name, base_unit),
        location:inventory_storage_locations(name)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId);

    if (reason) q = q.eq('reason', reason);

    q = q.order('created_at', { ascending: false }).limit(limit);

    const { data: records } = await q;

    return (records || []).map((w) => ({
      id: w.id,
      businessId: w.business_id,
      branchId: w.branch_id,
      locationId: w.location_id,
      locationName: w.location?.name || 'Storage',
      itemId: w.item_id,
      itemName: w.item?.name || 'Item',
      baseUnit: w.item?.base_unit || 'pcs',
      quantity: Number(w.quantity),
      unit: w.unit,
      quantityBase: Number(w.quantity_base),
      totalCostCents: hasCostPermission ? w.total_cost_cents : null,
      currency: w.currency,
      reason: w.reason as WasteReason,
      notes: w.notes,
      actorId: w.actor_id,
      createdAt: w.created_at,
    }));
  }

  /**
   * Inventory Overview & Explainable Health Score Engine
   */
  static async getInventoryOverview(
    businessId: string,
    branchId: string,
    currency: string,
    hasCostPermission = false
  ): Promise<InventoryOverviewPayload> {
    const admin = createAdminClient();

    const [items, { data: pendingTransfers }] = await Promise.all([
      this.getInventoryItems(businessId, branchId, { hasCostPermission }),
      admin
        .from('inventory_stock_transfers')
        .select('id, transfer_number, source_branch_id')
        .eq('destination_branch_id', branchId)
        .eq('status', 'in_transit')
        .limit(3),
    ]);

    const totalCount = items.length;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyCount = 0;
    let totalStockVal = 0;

    const needsAttention: InventoryOverviewPayload['needsAttention'] = [];

    items.forEach((it) => {
      if (it.stockStatus === 'out_of_stock') {
        outOfStockCount++;
        needsAttention.push({
          type: 'out_of_stock',
          itemId: it.id,
          itemName: it.name,
          currentQuantity: 0,
          baseUnit: it.baseUnit,
          message: `${it.name} is completely out of stock`,
          actionLabel: 'Add Stock',
          actionHref: `/dashboard/inventory/items/${it.id}?action=adjust`,
        });
      } else if (it.stockStatus === 'low_stock') {
        lowStockCount++;
        needsAttention.push({
          type: 'low_stock',
          itemId: it.id,
          itemName: it.name,
          currentQuantity: it.currentStockQuantity,
          baseUnit: it.baseUnit,
          message: `${it.name} has only ${it.currentStockQuantity} ${it.baseUnit} left (Min: ${it.minStockLevel})`,
          actionLabel: 'Replenish',
          actionHref: `/dashboard/inventory/items/${it.id}?action=adjust`,
        });
      } else {
        healthyCount++;
      }

      if (hasCostPermission && it.totalStockValueCents) {
        totalStockVal += it.totalStockValueCents;
      }
    });

    (pendingTransfers || []).forEach((pt) => {
      needsAttention.push({
        type: 'pending_transfer',
        message: `Transfer #${pt.transfer_number} is in transit and awaiting receipt`,
        actionLabel: 'Receive Stock',
        actionHref: `/dashboard/inventory/transfers`,
      });
    });

    // Compute Health Score (0-100)
    let score = 100;
    const explanations: string[] = [];

    if (totalCount === 0) {
      return {
        healthScore: 100,
        healthStatus: 'insufficient_data',
        healthExplanation: ['No inventory items tracked yet. Add your first ingredient to see health insights.'],
        totalItemsCount: 0,
        healthyItemsCount: 0,
        lowStockItemsCount: 0,
        outOfStockItemsCount: 0,
        totalStockValueCents: hasCostPermission ? 0 : null,
        wasteTodayValueCents: hasCostPermission ? 0 : null,
        expiringSoonCount: 0,
        currency,
        needsAttention: [],
      };
    }

    if (outOfStockCount > 0) {
      const penalty = Math.min(40, Math.round((outOfStockCount / totalCount) * 50));
      score -= penalty;
      explanations.push(`-${penalty} pts: ${outOfStockCount} item(s) are completely out of stock.`);
    }

    if (lowStockCount > 0) {
      const penalty = Math.min(25, Math.round((lowStockCount / totalCount) * 30));
      score -= penalty;
      explanations.push(`-${penalty} pts: ${lowStockCount} item(s) are below their minimum threshold.`);
    }

    score = Math.max(0, Math.min(100, score));

    let healthStatus: InventoryOverviewPayload['healthStatus'] = 'excellent';
    if (score >= 90) healthStatus = 'excellent';
    else if (score >= 75) healthStatus = 'good';
    else if (score >= 50) healthStatus = 'fair';
    else healthStatus = 'critical';

    if (explanations.length === 0) {
      explanations.push('All inventory items are currently at healthy stock levels.');
    }

    return {
      healthScore: score,
      healthStatus,
      healthExplanation: explanations,
      totalItemsCount: totalCount,
      healthyItemsCount: healthyCount,
      lowStockItemsCount: lowStockCount,
      outOfStockItemsCount: outOfStockCount,
      totalStockValueCents: hasCostPermission ? totalStockVal : null,
      wasteTodayValueCents: hasCostPermission ? 0 : null,
      expiringSoonCount: 0,
      currency,
      needsAttention: needsAttention.slice(0, 8),
    };
  }

  /**
   * Retrieves all batches for a specific item within a branch, strictly scoped by business, branch, and item.
   */
  static async getBatchesByItem(
    businessId: string,
    branchId: string,
    itemId: string,
    options?: {
      hasCostPermission?: boolean;
      includeDepleted?: boolean;
    }
  ): Promise<FormattedItemBatch[]> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const includeDepleted = options?.includeDepleted ?? false;
    const admin = createAdminClient();

    let query = admin
      .from('inventory_item_batches')
      .select(`
        id,
        business_id,
        branch_id,
        location_id,
        item_id,
        batch_code,
        initial_quantity,
        remaining_quantity,
        unit_cost_cents,
        currency,
        received_date,
        expiry_date,
        status,
        created_at,
        location:inventory_storage_locations(id, name),
        item:inventory_items(id, name)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('item_id', itemId);

    if (!includeDepleted) {
      query = query.gt('remaining_quantity', 0);
    }

    const { data: rows, error } = await query
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_date', { ascending: false });

    if (error || !rows) return [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();

    interface RawBatchRow {
      id: string;
      business_id: string;
      branch_id: string;
      location_id: string;
      item_id: string;
      batch_code: string;
      initial_quantity: number;
      remaining_quantity: number;
      unit_cost_cents: number;
      currency: string;
      received_date: string;
      expiry_date: string | null;
      status: 'active' | 'consumed' | 'expired' | 'discarded';
      created_at: string;
      location?: { id: string; name: string } | null;
      item?: { id: string; name: string } | null;
    }

    return (rows as unknown as RawBatchRow[]).map((row) => {
      let expiryStatus: BatchExpiryStatus = 'no_expiry';
      let daysUntilExpiry: number | null = null;

      if (row.expiry_date) {
        const expDateStr = row.expiry_date.includes('T') ? row.expiry_date.split('T')[0] : row.expiry_date;
        const expMs = new Date(`${expDateStr}T00:00:00Z`).getTime();
        daysUntilExpiry = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          expiryStatus = 'expired';
        } else if (daysUntilExpiry <= 7) {
          expiryStatus = 'expiring_soon';
        } else {
          expiryStatus = 'healthy';
        }
      }

      const remainingQty = Number(row.remaining_quantity);
      const unitCost = hasCostPermission ? Number(row.unit_cost_cents) : null;
      const totalValue = hasCostPermission && unitCost !== null
        ? Math.round(remainingQty * unitCost)
        : null;

      return {
        id: row.id,
        businessId: row.business_id,
        branchId: row.branch_id,
        locationId: row.location_id,
        locationName: row.location?.name || 'Main Stock',
        itemId: row.item_id,
        itemName: row.item?.name,
        batchCode: row.batch_code,
        initialQuantity: Number(row.initial_quantity),
        remainingQuantity: remainingQty,
        unitCostCents: unitCost,
        totalStockValueCents: totalValue,
        currency: row.currency || 'USD',
        receivedDate: row.received_date,
        expiryDate: row.expiry_date,
        expiryStatus,
        daysUntilExpiry,
        status: row.status,
        createdAt: row.created_at,
      };
    });
  }

  /**
   * Retrieves all expiring and expired inventory batches within a branch.
   * Filtered by remaining_quantity > 0 and expiry_date <= today + maxDaysAhead.
   */
  static async getExpiringBatches(
    businessId: string,
    branchId: string,
    options?: {
      hasCostPermission?: boolean;
      maxDaysAhead?: number;
    }
  ): Promise<ExpiryAlertSummary> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const maxDaysAhead = options?.maxDaysAhead ?? 14;
    const admin = createAdminClient();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();

    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + maxDaysAhead);
    const maxDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

    const { data: rows, error } = await admin
      .from('inventory_item_batches')
      .select(`
        id,
        business_id,
        branch_id,
        location_id,
        item_id,
        batch_code,
        initial_quantity,
        remaining_quantity,
        unit_cost_cents,
        currency,
        received_date,
        expiry_date,
        status,
        created_at,
        location:inventory_storage_locations(id, name),
        item:inventory_items(id, name, base_unit)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .gt('remaining_quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', maxDateStr)
      .order('expiry_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error || !rows) {
      return {
        expiredCount: 0,
        expiredQuantity: 0,
        criticalCount: 0,
        soonCount: 0,
        upcomingCount: 0,
        totalExpiringCount: 0,
        batches: [],
      };
    }

    interface RawExpiringRow {
      id: string;
      business_id: string;
      branch_id: string;
      location_id: string;
      item_id: string;
      batch_code: string;
      remaining_quantity: number;
      unit_cost_cents: number;
      currency: string;
      received_date: string;
      expiry_date: string;
      created_at: string;
      location?: { id: string; name: string } | null;
      item?: { id: string; name: string; base_unit: string } | null;
    }

    let expiredCount = 0;
    let expiredQuantity = 0;
    let criticalCount = 0;
    let soonCount = 0;
    let upcomingCount = 0;

    const batches: FormattedExpiringBatch[] = (rows as unknown as RawExpiringRow[]).map((row) => {
      const expDateStr = row.expiry_date.includes('T') ? row.expiry_date.split('T')[0] : row.expiry_date;
      const expMs = new Date(`${expDateStr}T00:00:00Z`).getTime();
      const daysUntilExpiry = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));

      let severity: ExpiryAlertSeverity = 'upcoming';
      if (daysUntilExpiry < 0) {
        severity = 'expired';
        expiredCount++;
        expiredQuantity += Number(row.remaining_quantity);
      } else if (daysUntilExpiry <= 3) {
        severity = 'critical';
        criticalCount++;
      } else if (daysUntilExpiry <= 7) {
        severity = 'expiring_soon';
        soonCount++;
      } else {
        severity = 'upcoming';
        upcomingCount++;
      }

      const remainingQty = Number(row.remaining_quantity);
      const unitCost = hasCostPermission ? Number(row.unit_cost_cents) : null;
      const totalValue = hasCostPermission && unitCost !== null
        ? Math.round(remainingQty * unitCost)
        : null;

      return {
        id: row.id,
        businessId: row.business_id,
        branchId: row.branch_id,
        locationId: row.location_id,
        locationName: row.location?.name || 'Main Stock',
        itemId: row.item_id,
        itemName: row.item?.name || 'Unknown Item',
        baseUnit: row.item?.base_unit || 'units',
        batchCode: row.batch_code || 'Unnamed Lot',
        remainingQuantity: remainingQty,
        unitCostCents: unitCost,
        totalStockValueCents: totalValue,
        currency: row.currency || 'USD',
        receivedDate: row.received_date,
        expiryDate: row.expiry_date,
        daysUntilExpiry,
        severity,
        createdAt: row.created_at,
      };
    });

    return {
      expiredCount,
      expiredQuantity,
      criticalCount,
      soonCount,
      upcomingCount,
      totalExpiringCount: batches.length,
      batches,
    };
  }

  /**
   * Derives authoritative demand metrics for an item over a given historical window (default 14 days).
   * Distinguishes true operational demand (order consumption, prep production) from non-demand reductions (waste, returns, transfers).
   */
  static async getDemandForecast(
    businessId: string,
    branchId: string,
    itemId: string,
    options?: { windowDays?: number }
  ): Promise<{
    daysAnalyzed: number;
    totalDemandBase: number;
    averageDailyDemandBase: number;
    weightedDailyDemandBase: number;
    observationsCount: number;
    historyQuality: DemandConfidence;
    recentDemandBase: number;
    priorDemandBase: number;
  }> {
    const windowDays = Math.max(1, options?.windowDays || 14);
    const admin = createAdminClient();

    const now = new Date();
    const windowStartDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const halfWindowDays = Math.max(1, Math.floor(windowDays / 2));
    const recentSplitDate = new Date(now.getTime() - halfWindowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: movements, error } = await admin
      .from('inventory_stock_movements')
      .select('movement_type, quantity_base, created_at')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('item_id', itemId)
      .gte('created_at', windowStartDate)
      .in('movement_type', ['recipe_consumption', 'production_out', 'consumption_reversal']);

    if (error || !movements || movements.length === 0) {
      return {
        daysAnalyzed: windowDays,
        totalDemandBase: 0,
        averageDailyDemandBase: 0,
        weightedDailyDemandBase: 0,
        observationsCount: 0,
        historyQuality: 'insufficient',
        recentDemandBase: 0,
        priorDemandBase: 0,
      };
    }

    let recentDemand = 0;
    let priorDemand = 0;
    let validObservations = 0;

    movements.forEach((m) => {
      const qty = Number(m.quantity_base) || 0;
      const isRecent = m.created_at >= recentSplitDate;

      if (m.movement_type === 'recipe_consumption' || m.movement_type === 'production_out') {
        if (isRecent) {
          recentDemand += qty;
        } else {
          priorDemand += qty;
        }
        validObservations++;
      } else if (m.movement_type === 'consumption_reversal') {
        // Offset reversed consumption
        if (isRecent) {
          recentDemand = Math.max(0, recentDemand - qty);
        } else {
          priorDemand = Math.max(0, priorDemand - qty);
        }
      }
    });

    const totalDemand = Math.max(0, recentDemand + priorDemand);
    const avgDailyDemand = Math.round((totalDemand / windowDays) * 10000) / 10000;

    // Weighted daily demand: recent half weighted 60%, older half weighted 40%
    const recentDaily = recentDemand / halfWindowDays;
    const priorDays = Math.max(1, windowDays - halfWindowDays);
    const priorDaily = priorDemand / priorDays;
    const weightedDaily = Math.round((0.6 * recentDaily + 0.4 * priorDaily) * 10000) / 10000;

    let quality: DemandConfidence = 'insufficient';
    if (totalDemand === 0 || validObservations === 0) {
      quality = 'insufficient';
    } else if (validObservations >= 8) {
      quality = 'high';
    } else if (validObservations >= 3) {
      quality = 'medium';
    } else {
      quality = 'low';
    }

    return {
      daysAnalyzed: windowDays,
      totalDemandBase: Math.round(totalDemand * 10000) / 10000,
      averageDailyDemandBase: avgDailyDemand,
      weightedDailyDemandBase: weightedDaily,
      observationsCount: validObservations,
      historyQuality: quality,
      recentDemandBase: Math.round(recentDemand * 10000) / 10000,
      priorDemandBase: Math.round(priorDemand * 10000) / 10000,
    };
  }

  /**
   * Computes comprehensive inventory forecasting, days of stock remaining, and smart reorder suggestions for a branch.
   */
  static async getReorderSuggestions(
    businessId: string,
    branchId: string,
    options?: {
      hasCostPermission?: boolean;
      windowDays?: number;
      targetCoverageDays?: number;
      itemId?: string;
    }
  ): Promise<ReorderSuggestionsOverview> {
    const hasCostPermission = options?.hasCostPermission ?? false;
    const windowDays = Math.max(1, options?.windowDays || 14);
    const targetCoverageDays = Math.max(1, options?.targetCoverageDays || 7);
    const admin = createAdminClient();

    // 1. Fetch business currency
    const { data: biz } = await admin
      .from('businesses')
      .select('default_currency')
      .eq('id', businessId)
      .maybeSingle();
    const currency = biz?.default_currency || 'USD';

    // 2. Fetch inventory items
    let itemsQuery = admin
      .from('inventory_items')
      .select(`
        id,
        business_id,
        name,
        category_id,
        base_unit,
        cost_per_unit_cents,
        currency,
        min_stock_level,
        target_stock_level,
        is_active,
        category:inventory_categories(name)
      `)
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (options?.itemId) {
      itemsQuery = itemsQuery.eq('id', options.itemId);
    }

    const { data: rawItems, error: itemsError } = await itemsQuery;
    if (itemsError || !rawItems || rawItems.length === 0) {
      return {
        branchId,
        currency,
        totalItemsTracked: 0,
        criticalCount: 0,
        reorderSoonCount: 0,
        healthyCount: 0,
        noDemandCount: 0,
        totalEstimatedReorderCostCents: hasCostPermission ? 0 : null,
        suggestions: [],
      };
    }

    const itemIds = rawItems.map((i) => i.id);

    // 3. Fetch branch balances per item
    const { data: rawBalances } = await admin
      .from('inventory_balances')
      .select('item_id, current_quantity')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .in('item_id', itemIds);

    const balancesMap = new Map<string, number>();
    (rawBalances || []).forEach((b) => {
      const prev = balancesMap.get(b.item_id) || 0;
      balancesMap.set(b.item_id, prev + (Number(b.current_quantity) || 0));
    });

    // 4. Fetch open incoming PO quantities for this branch (statuses: approved, sent, partially_received)
    const { data: rawPoItems } = await admin
      .from('inventory_purchase_order_items')
      .select(`
        item_id,
        quantity_ordered_base,
        quantity_received_base,
        po:inventory_purchase_orders!inner(
          id,
          business_id,
          branch_id,
          status
        )
      `)
      .eq('po.business_id', businessId)
      .eq('po.branch_id', branchId)
      .in('po.status', ['approved', 'sent', 'partially_received'])
      .in('item_id', itemIds);

    interface RawPoItemRow {
      item_id: string;
      quantity_ordered_base: number;
      quantity_received_base: number;
    }

    const openIncomingMap = new Map<string, number>();
    (rawPoItems as unknown as RawPoItemRow[] || []).forEach((p) => {
      const ordered = Number(p.quantity_ordered_base) || 0;
      const received = Number(p.quantity_received_base) || 0;
      const remaining = Math.max(0, ordered - received);
      if (remaining > 0) {
        const prev = openIncomingMap.get(p.item_id) || 0;
        openIncomingMap.set(p.item_id, prev + remaining);
      }
    });

    // 5. Fetch demand movements in window
    const now = new Date();
    const windowStartDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const halfWindowDays = Math.max(1, Math.floor(windowDays / 2));
    const recentSplitDate = new Date(now.getTime() - halfWindowDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: movements } = await admin
      .from('inventory_stock_movements')
      .select('item_id, movement_type, quantity_base, created_at')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .in('item_id', itemIds)
      .gte('created_at', windowStartDate)
      .in('movement_type', ['recipe_consumption', 'production_out', 'consumption_reversal']);

    const demandAggMap = new Map<string, { recent: number; prior: number; count: number }>();
    (movements || []).forEach((m) => {
      const qty = Number(m.quantity_base) || 0;
      const isRecent = m.created_at >= recentSplitDate;
      const agg = demandAggMap.get(m.item_id) || { recent: 0, prior: 0, count: 0 };

      if (m.movement_type === 'recipe_consumption' || m.movement_type === 'production_out') {
        if (isRecent) agg.recent += qty;
        else agg.prior += qty;
        agg.count++;
      } else if (m.movement_type === 'consumption_reversal') {
        if (isRecent) agg.recent = Math.max(0, agg.recent - qty);
        else agg.prior = Math.max(0, agg.prior - qty);
      }
      demandAggMap.set(m.item_id, agg);
    });

    // 6. Fetch near-expiry batch context (expiring within 7 days)
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: nearExpiryBatches } = await admin
      .from('inventory_item_batches')
      .select('item_id, remaining_quantity, expiry_date')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .gt('remaining_quantity', 0)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', sevenDaysAhead);

    const nearExpiryMap = new Map<string, { totalQty: number; count: number; minDays: number }>();
    (nearExpiryBatches || []).forEach((b) => {
      const qty = Number(b.remaining_quantity) || 0;
      if (qty > 0 && b.expiry_date) {
        const expTime = new Date(b.expiry_date).getTime();
        const diffDays = Math.ceil((expTime - now.getTime()) / (1000 * 60 * 60 * 24));
        const prev = nearExpiryMap.get(b.item_id) || { totalQty: 0, count: 0, minDays: diffDays };
        nearExpiryMap.set(b.item_id, {
          totalQty: prev.totalQty + qty,
          count: prev.count + 1,
          minDays: Math.min(prev.minDays, diffDays),
        });
      }
    });

    // 7. Parallel fetch supplier price comparisons for items
    const comparisonsList = await Promise.all(
      itemIds.map((id) =>
        PurchasingService.getSupplierPriceComparison(businessId, id, { hasCostPermission })
      )
    );
    const comparisonMap = new Map<string, Awaited<ReturnType<typeof PurchasingService.getSupplierPriceComparison>>>();
    comparisonsList.forEach((comp) => {
      if (comp) comparisonMap.set(comp.itemId, comp);
    });

    // 8. Build item forecast metrics
    const suggestions: ItemForecastMetric[] = [];
    let criticalCount = 0;
    let reorderSoonCount = 0;
    let healthyCount = 0;
    let noDemandCount = 0;
    let totalEstimatedReorderCostCents = 0;

    for (const item of rawItems) {
      const currentStock = balancesMap.get(item.id) || 0;
      const openIncoming = openIncomingMap.get(item.id) || 0;
      const projectedAvailable = Math.round((currentStock + openIncoming) * 10000) / 10000;

      const demandAgg = demandAggMap.get(item.id) || { recent: 0, prior: 0, count: 0 };
      const totalDemand = Math.max(0, demandAgg.recent + demandAgg.prior);
      const avgDailyDemand = Math.round((totalDemand / windowDays) * 10000) / 10000;

      const recentDaily = demandAgg.recent / halfWindowDays;
      const priorDays = Math.max(1, windowDays - halfWindowDays);
      const priorDaily = demandAgg.prior / priorDays;
      const weightedDaily = Math.round((0.6 * recentDaily + 0.4 * priorDaily) * 10000) / 10000;

      const effectiveDaily = weightedDaily > 0 ? weightedDaily : avgDailyDemand;

      let historyQuality: DemandConfidence = 'insufficient';
      if (totalDemand === 0 || demandAgg.count === 0) {
        historyQuality = 'insufficient';
      } else if (demandAgg.count >= 8) {
        historyQuality = 'high';
      } else if (demandAgg.count >= 3) {
        historyQuality = 'medium';
      } else {
        historyQuality = 'low';
      }

      const daysOfStockRemaining =
        avgDailyDemand > 0 ? Math.round((currentStock / avgDailyDemand) * 10) / 10 : null;
      const daysOfCoverageWithIncoming =
        avgDailyDemand > 0 ? Math.round((projectedAvailable / avgDailyDemand) * 10) / 10 : null;

      // Reorder Point & Safety Stock
      const minStockLevel = Number(item.min_stock_level) || 0;
      const safetyStockBase = minStockLevel > 0 ? minStockLevel : 0;

      const comp = comparisonMap.get(item.id);
      const allSuppliers = comp?.allSuppliers || [];
      const leadTimeDays: number | null = null; // No arbitrary assumption if unconfigured

      const hasLeadTimeIntelligence = leadTimeDays !== null;
      const reorderPointBase =
        leadTimeDays !== null
          ? Math.round(((avgDailyDemand * leadTimeDays) + safetyStockBase) * 10000) / 10000
          : safetyStockBase;

      const targetStockLevelBase =
        Math.round(((effectiveDaily * targetCoverageDays) + safetyStockBase) * 10000) / 10000;
      const configuredTarget = Number(item.target_stock_level) || 0;
      const finalTargetStock =
        configuredTarget > targetStockLevelBase ? configuredTarget : targetStockLevelBase;

      const recommendedBaseQty = Math.max(
        0,
        Math.round((finalTargetStock - projectedAvailable) * 10000) / 10000
      );

      // Risk status determination
      let riskStatus: ReorderRiskStatus = 'healthy';
      if (currentStock <= 0) {
        riskStatus = recommendedBaseQty > 0 || minStockLevel > 0 || totalDemand > 0 ? 'critical' : 'no_demand';
      } else if (daysOfStockRemaining !== null && daysOfStockRemaining <= 3) {
        riskStatus = 'critical';
      } else if (leadTimeDays !== null && daysOfStockRemaining !== null && daysOfStockRemaining <= leadTimeDays) {
        riskStatus = 'critical';
      } else if (
        currentStock <= reorderPointBase ||
        projectedAvailable <= reorderPointBase ||
        (daysOfStockRemaining !== null && daysOfStockRemaining <= 7)
      ) {
        riskStatus = 'reorder_soon';
      } else if (avgDailyDemand > 0) {
        riskStatus = 'healthy';
      } else {
        riskStatus = 'no_demand';
      }

      if (riskStatus === 'critical') criticalCount++;
      else if (riskStatus === 'reorder_soon') reorderSoonCount++;
      else if (riskStatus === 'healthy') healthyCount++;
      else noDemandCount++;

      // Near-expiry alert context
      const nearExpInfo = nearExpiryMap.get(item.id);

      // Explanation sentence
      let explanation = '';
      if (avgDailyDemand > 0) {
        explanation = `Based on ${windowDays} days of ${avgDailyDemand.toFixed(2)} ${item.base_unit}/day consumption.`;
        if (daysOfStockRemaining !== null) {
          explanation += ` Stock coverage: ${daysOfStockRemaining.toFixed(1)} days.`;
        }
        if (currentStock <= 0) {
          explanation += ` Item is currently out of stock.`;
        } else if (daysOfStockRemaining !== null && daysOfStockRemaining <= 3) {
          explanation += ` ⚠️ Critical runout risk (≤ 3 days coverage remaining).`;
        } else if (currentStock <= reorderPointBase && minStockLevel > 0) {
          explanation += ` On-hand stock (${currentStock.toFixed(2)} ${item.base_unit}) is below minimum threshold (${minStockLevel.toFixed(2)} ${item.base_unit}) — reorder recommended to restore safety buffer.`;
        } else if (currentStock <= reorderPointBase) {
          explanation += ` On-hand stock has reached the reorder threshold (${reorderPointBase.toFixed(2)} ${item.base_unit}).`;
        }
        if (openIncoming > 0) {
          explanation += ` Includes ${openIncoming.toFixed(2)} ${item.base_unit} incoming from open PO.`;
        }
      } else {
        explanation = `No recent consumption recorded in the last ${windowDays} days.`;
        if (currentStock <= 0) {
          explanation += ` Item is currently out of stock.`;
        } else if (minStockLevel > 0 && currentStock <= minStockLevel) {
          explanation += ` On-hand stock (${currentStock.toFixed(2)} ${item.base_unit}) is below minimum threshold (${minStockLevel.toFixed(2)} ${item.base_unit}).`;
        }
      }
      if (nearExpInfo) {
        explanation += ` ⚠️ ${nearExpInfo.totalQty.toFixed(1)} ${item.base_unit} expires in ${nearExpInfo.minDays} day(s).`;
      }

      // Supplier purchasing intelligence
      let suggestedSupplier: SuggestedSupplierPurchase | null = null;
      let preferredSupplierAlternative: SuggestedSupplierPurchase | null = null;
      let potentialSavingsCents: number | null = null;

      if (recommendedBaseQty > 0 && allSuppliers.length > 0) {
        // Cheapest supplier in primary currency group (or first group)
        const primaryGroup = comp?.groups[0];
        const cheapest = primaryGroup?.suppliers.find((s) => s.isCheapest) || allSuppliers[0];

        if (cheapest) {
          const conv = Number(cheapest.conversionToBase) || 1.0;
          const packsToOrder = Math.max(1, Math.ceil(recommendedBaseQty / conv));
          const orderQtyBase = Math.round(packsToOrder * conv * 10000) / 10000;
          const packPrice = hasCostPermission ? cheapest.lastPriceCents : null;
          const estTotal = hasCostPermission && packPrice !== null ? packsToOrder * packPrice : null;

          suggestedSupplier = {
            supplierId: cheapest.supplierId,
            supplierName: cheapest.supplierName,
            supplierSku: cheapest.supplierSku,
            purchasingUnit: cheapest.purchasingUnit,
            conversionToBase: conv,
            packsToOrder,
            orderQuantityBase: orderQtyBase,
            packPriceCents: packPrice,
            totalEstimatedCents: estTotal,
            currency: cheapest.currency,
            isPreferred: cheapest.isPreferred,
          };

          if (estTotal !== null) {
            totalEstimatedReorderCostCents += estTotal;
          }
        }

        // Preferred supplier if different
        const preferred = allSuppliers.find((s) => s.isPreferred && s.supplierId !== cheapest?.supplierId);
        if (preferred) {
          const prefConv = Number(preferred.conversionToBase) || 1.0;
          const prefPacks = Math.max(1, Math.ceil(recommendedBaseQty / prefConv));
          const prefOrderQty = Math.round(prefPacks * prefConv * 10000) / 10000;
          const prefPackPrice = hasCostPermission ? preferred.lastPriceCents : null;
          const prefEstTotal = hasCostPermission && prefPackPrice !== null ? prefPacks * prefPackPrice : null;

          preferredSupplierAlternative = {
            supplierId: preferred.supplierId,
            supplierName: preferred.supplierName,
            supplierSku: preferred.supplierSku,
            purchasingUnit: preferred.purchasingUnit,
            conversionToBase: prefConv,
            packsToOrder: prefPacks,
            orderQuantityBase: prefOrderQty,
            packPriceCents: prefPackPrice,
            totalEstimatedCents: prefEstTotal,
            currency: preferred.currency,
            isPreferred: true,
          };

          if (
            hasCostPermission &&
            suggestedSupplier?.totalEstimatedCents !== null &&
            suggestedSupplier?.totalEstimatedCents !== undefined &&
            prefEstTotal !== null &&
            suggestedSupplier.currency === preferred.currency
          ) {
            if (prefEstTotal > suggestedSupplier.totalEstimatedCents) {
              potentialSavingsCents = prefEstTotal - suggestedSupplier.totalEstimatedCents;
            }
          }
        }
      }

      suggestions.push({
        itemId: item.id,
        itemName: item.name,
        categoryName: (item.category as { name?: string } | null)?.name || null,
        baseUnit: item.base_unit,
        currentStock,
        openIncomingStock: openIncoming,
        projectedAvailableStock: projectedAvailable,
        daysAnalyzed: windowDays,
        totalDemandBase: totalDemand,
        averageDailyDemandBase: avgDailyDemand,
        weightedDailyDemandBase: weightedDaily,
        demandHistoryQuality: historyQuality,
        demandObservationsCount: demandAgg.count,
        daysOfStockRemaining,
        daysOfCoverageWithIncoming,
        leadTimeDays,
        hasLeadTimeIntelligence,
        safetyStockBase,
        reorderPointBase,
        targetCoverageDays,
        targetStockLevelBase: finalTargetStock,
        recommendedBaseQty,
        riskStatus,
        explanation,
        nearExpiryStockBase: nearExpInfo?.totalQty,
        nearExpiryDaysThreshold: nearExpInfo?.minDays,
        nearExpiryBatchCount: nearExpInfo?.count,
        suggestedSupplier,
        preferredSupplierAlternative,
        potentialSavingsCents,
      });
    }

    // Deterministic sort: Critical (0) -> Reorder Soon (1) -> Healthy (2) -> No Demand (3)
    const riskRank: Record<ReorderRiskStatus, number> = {
      critical: 0,
      reorder_soon: 1,
      healthy: 2,
      no_demand: 3,
    };

    suggestions.sort((a, b) => {
      if (riskRank[a.riskStatus] !== riskRank[b.riskStatus]) {
        return riskRank[a.riskStatus] - riskRank[b.riskStatus];
      }
      if (a.daysOfStockRemaining !== null && b.daysOfStockRemaining !== null) {
        if (a.daysOfStockRemaining !== b.daysOfStockRemaining) {
          return a.daysOfStockRemaining - b.daysOfStockRemaining;
        }
      } else if (a.daysOfStockRemaining !== null && b.daysOfStockRemaining === null) {
        return -1;
      } else if (a.daysOfStockRemaining === null && b.daysOfStockRemaining !== null) {
        return 1;
      }
      return a.itemName.localeCompare(b.itemName);
    });

    return {
      branchId,
      currency,
      totalItemsTracked: suggestions.length,
      criticalCount,
      reorderSoonCount,
      healthyCount,
      noDemandCount,
      totalEstimatedReorderCostCents: hasCostPermission ? totalEstimatedReorderCostCents : null,
      suggestions,
    };
  }

  /**
   * Retrieves single-item reorder forecast and intelligence metrics.
   */
  static async getItemReorderForecast(
    businessId: string,
    branchId: string,
    itemId: string,
    options?: {
      hasCostPermission?: boolean;
      windowDays?: number;
      targetCoverageDays?: number;
    }
  ): Promise<ItemForecastMetric | null> {
    const res = await this.getReorderSuggestions(businessId, branchId, {
      ...options,
      itemId,
    });
    return res.suggestions[0] || null;
  }
}


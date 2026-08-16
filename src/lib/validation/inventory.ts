import { z } from 'zod';

export const inventoryItemTypeEnum = z.enum([
  'raw_ingredient',
  'semi_finished',
  'finished_item',
  'packaging',
  'operational_supply',
]);

export type InventoryItemType = z.infer<typeof inventoryItemTypeEnum>;

export const inventoryUnitTypeEnum = z.enum([
  'weight',
  'volume',
  'count',
  'custom',
]);

export type InventoryUnitType = z.infer<typeof inventoryUnitTypeEnum>;

export const wasteReasonEnum = z.enum([
  'expired',
  'spoiled',
  'prep_waste',
  'overcooked',
  'dropped',
  'customer_return',
  'staff_meal',
  'damaged',
  'other',
]);

export type WasteReason = z.infer<typeof wasteReasonEnum>;

export const stockCountStatusEnum = z.enum([
  'draft',
  'counting',
  'submitted',
  'approved',
  'cancelled',
]);

export type StockCountStatus = z.infer<typeof stockCountStatusEnum>;

export const stockTransferStatusEnum = z.enum([
  'draft',
  'sent',
  'in_transit',
  'received',
  'cancelled',
]);

export type StockTransferStatus = z.infer<typeof stockTransferStatusEnum>;

export const movementTypeEnum = z.enum([
  'opening_balance',
  'adjustment_add',
  'adjustment_remove',
  'stock_count_adjustment',
  'waste',
  'transfer_out',
  'transfer_in',
  'transfer_discrepancy',
  'return',
  'purchase_receive_reserved',
  'recipe_consumption_reserved',
]);

export type MovementType = z.infer<typeof movementTypeEnum>;

// Category Schemas
export const createInventoryCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(50, 'Category name too long'),
  description: z.string().trim().max(200, 'Description too long').optional().nullable(),
  icon: z.string().trim().max(10).optional().default('📦'),
  displayOrder: z.number().int().default(0),
});

export type CreateInventoryCategoryInput = z.infer<typeof createInventoryCategorySchema>;

// Location Schemas
export const createStorageLocationSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  name: z.string().trim().min(2, 'Location name must be at least 2 characters').max(60, 'Location name too long'),
  code: z.string().trim().min(2, 'Location code must be at least 2 characters').max(30, 'Code too long').toUpperCase(),
  description: z.string().trim().max(200, 'Description too long').optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type CreateStorageLocationInput = z.infer<typeof createStorageLocationSchema>;

export const updateStorageLocationSchema = createStorageLocationSchema.extend({
  locationId: z.string().uuid('Invalid location ID'),
  isActive: z.boolean().optional(),
});

export type UpdateStorageLocationInput = z.infer<typeof updateStorageLocationSchema>;

// Item Schemas
export const createInventoryItemSchema = z.object({
  name: z.string().trim().min(2, 'Item name must be at least 2 characters').max(100, 'Item name too long'),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  sku: z.string().trim().max(50, 'SKU too long').optional().nullable(),
  barcode: z.string().trim().max(50, 'Barcode too long').optional().nullable(),
  description: z.string().trim().max(300, 'Description too long').optional().nullable(),
  itemType: inventoryItemTypeEnum.default('raw_ingredient'),
  baseUnit: z.string().trim().min(1, 'Base unit is required').max(20, 'Unit too long').toLowerCase(),
  costPerUnitCents: z.number().int().min(0, 'Cost cannot be negative').default(0),
  minStockLevel: z.number().min(0, 'Min stock level cannot be negative').default(0),
  targetStockLevel: z.number().min(0, 'Target stock level cannot be negative').default(0),
  trackBatches: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  // Optional initial opening stock
  initialLocationId: z.string().uuid('Invalid initial location ID').optional().nullable(),
  initialQuantity: z.number().min(0, 'Initial quantity cannot be negative').optional().default(0),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = createInventoryItemSchema.omit({
  initialLocationId: true,
  initialQuantity: true,
}).extend({
  itemId: z.string().uuid('Invalid item ID'),
  isActive: z.boolean().optional(),
});

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

// Stock Adjustment Schema
export const stockAdjustmentSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  locationId: z.string().uuid('Invalid location ID'),
  itemId: z.string().uuid('Invalid item ID'),
  direction: z.enum(['in', 'out', 'set']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().trim().min(1, 'Unit is required').max(20).toLowerCase(),
  reason: z.string().trim().min(2, 'Reason must be at least 2 characters').max(200, 'Reason too long'),
  notes: z.string().trim().max(500, 'Notes too long').optional().nullable(),
  idempotencyKey: z.string().trim().min(8, 'Idempotency key required'),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

// Waste Schema
export const recordWasteSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  locationId: z.string().uuid('Invalid location ID'),
  itemId: z.string().uuid('Invalid item ID'),
  batchId: z.string().uuid('Invalid batch ID').optional().nullable(),
  quantity: z.number().positive('Waste quantity must be greater than 0'),
  unit: z.string().trim().min(1, 'Unit is required').max(20).toLowerCase(),
  reason: wasteReasonEnum,
  notes: z.string().trim().max(500, 'Notes too long').optional().nullable(),
  idempotencyKey: z.string().trim().min(8, 'Idempotency key required'),
});

export type RecordWasteInput = z.infer<typeof recordWasteSchema>;

// Stock Count Schemas
export const createStockCountSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  locationId: z.string().uuid('Invalid location ID'),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(100, 'Title too long'),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  isBlindCount: z.boolean().default(false),
  notes: z.string().trim().max(500, 'Notes too long').optional().nullable(),
});

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

export const stockCountItemEntrySchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  countedRawQuantity: z.number().min(0, 'Counted quantity cannot be negative'),
  countedUnit: z.string().trim().min(1, 'Counted unit required').max(20).toLowerCase(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const submitStockCountSchema = z.object({
  countId: z.string().uuid('Invalid count ID'),
  items: z.array(stockCountItemEntrySchema).min(1, 'At least one item count required'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type SubmitStockCountInput = z.infer<typeof submitStockCountSchema>;

// Stock Transfer Schemas
export const stockTransferItemInputSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  batchId: z.string().uuid('Invalid batch ID').optional().nullable(),
  quantitySent: z.number().positive('Quantity sent must be greater than 0'),
  unitSent: z.string().trim().min(1, 'Unit required').max(20).toLowerCase(),
});

export const createStockTransferSchema = z.object({
  sourceBranchId: z.string().uuid('Invalid source branch ID'),
  sourceLocationId: z.string().uuid('Invalid source location ID'),
  destinationBranchId: z.string().uuid('Invalid destination branch ID'),
  destinationLocationId: z.string().uuid('Invalid destination location ID'),
  items: z.array(stockTransferItemInputSchema).min(1, 'At least one item required for transfer'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;

export const receiveStockTransferItemSchema = z.object({
  itemId: z.string().uuid('Invalid item ID'),
  quantityReceivedBase: z.number().min(0, 'Quantity received cannot be negative'),
});

export const receiveStockTransferSchema = z.object({
  transferId: z.string().uuid('Invalid transfer ID'),
  receivedItems: z.array(receiveStockTransferItemSchema).optional(),
  discrepancyReason: z.string().trim().max(300).optional().nullable(),
});

export type ReceiveStockTransferInput = z.infer<typeof receiveStockTransferSchema>;

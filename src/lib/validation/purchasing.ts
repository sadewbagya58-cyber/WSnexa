import { z } from 'zod';

export const poStatusEnum = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'partially_received',
  'received',
  'cancelled',
]);
export type POStatus = z.infer<typeof poStatusEnum>;

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(100),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(30).optional().nullable(),
  addressLine1: z.string().max(200).optional().nullable(),
  addressLine2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  paymentTerms: z.string().max(100).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  isPreferred: z.boolean().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  id: z.string().uuid('Invalid supplier ID'),
  isActive: z.boolean().optional(),
});

export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const supplierItemSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  itemId: z.string().uuid('Invalid inventory item ID'),
  supplierSku: z.string().max(50).optional().nullable(),
  purchasingUnit: z.string().min(1, 'Purchasing unit is required'),
  conversionToBase: z.number().positive('Conversion factor must be positive').default(1.0),
  lastPriceCents: z.number().int().min(0, 'Price cannot be negative').default(0),
  currency: z.string().length(3).default('USD'),
  isPreferred: z.boolean().default(true),
});

export type SupplierItemInput = z.infer<typeof supplierItemSchema>;

export const purchaseOrderItemSchema = z.object({
  itemId: z.string().uuid('Invalid inventory item ID'),
  purchasingUnit: z.string().min(1, 'Unit is required'),
  quantityOrdered: z.number().positive('Quantity must be greater than 0'),
  unitCostCents: z.number().int().min(0, 'Unit cost cannot be negative'),
});

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  destinationLocationId: z.string().uuid('Invalid destination storage location ID'),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(purchaseOrderItemSchema).min(1, 'Purchase order must have at least one line item'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const goodsReceiptItemSchema = z.object({
  itemId: z.string().uuid('Invalid inventory item ID'),
  poItemId: z.string().uuid('Invalid PO item ID').optional().nullable(),
  quantityReceived: z.number().positive('Quantity received must be positive'),
  unitReceived: z.string().min(1, 'Unit is required'),
  unitCostCents: z.number().int().min(0, 'Unit cost cannot be negative'),
  batchCode: z.string().max(50).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  discrepancyReason: z.string().max(250).optional().nullable(),
});

export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemSchema>;

export const recordGoodsReceiptSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  locationId: z.string().uuid('Invalid storage location ID'),
  poId: z.string().uuid('Invalid purchase order ID').optional().nullable(),
  grnNumber: z.string().min(1, 'GRN number is required'),
  items: z.array(goodsReceiptItemSchema).min(1, 'Must receive at least one item'),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8, 'Valid idempotency key required'),
});

export type RecordGoodsReceiptInput = z.infer<typeof recordGoodsReceiptSchema>;

export const supplierReturnSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  locationId: z.string().uuid('Invalid storage location ID'),
  itemId: z.string().uuid('Invalid inventory item ID'),
  grnId: z.string().uuid('Invalid GRN ID').optional().nullable(),
  quantity: z.number().positive('Return quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  reason: z.string().min(3, 'Return reason is required').max(250),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8, 'Valid idempotency key is required'),
});

export type SupplierReturnInput = z.infer<typeof supplierReturnSchema>;

export const updateInventorySettingsSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
  deductionTiming: z.enum(['confirmed', 'preparing', 'served', 'completed']).default('preparing'),
  costingMethod: z.enum(['weighted_average', 'latest_cost']).default('weighted_average'),
  autoSoldOutMode: z.enum(['warn_only', 'suggest_sold_out', 'auto_mark_sold_out']).default('warn_only'),
  receivingTolerancePercent: z.number().min(0).max(100).default(10.0),
  defaultConsumptionLocationId: z.string().uuid('Invalid storage location ID').optional().nullable(),
});

export type UpdateInventorySettingsInput = z.infer<typeof updateInventorySettingsSchema>;

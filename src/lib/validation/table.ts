import { z } from 'zod';

export const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'] as const;
export const TABLE_SHAPES = ['square', 'rectangle', 'round', 'other'] as const;

export const createServiceAreaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Service area name is required')
    .max(100, 'Area name cannot exceed 100 characters'),
  code: z
    .string()
    .trim()
    .min(1, 'Area code is required')
    .max(50, 'Area code cannot exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateServiceAreaSchema = createServiceAreaSchema.partial().extend({
  id: z.string().uuid('Invalid service area ID'),
});

export const createDiningTableSchema = z.object({
  serviceAreaId: z.string().uuid('Please select a valid service area'),
  name: z
    .string()
    .trim()
    .min(1, 'Table name is required')
    .max(100, 'Table name cannot exceed 100 characters'),
  code: z
    .string()
    .trim()
    .min(1, 'Table code is required')
    .max(50, 'Table code cannot exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  tableNumber: z.number().int().min(1, 'Table number must be positive').optional().nullable(),
  capacity: z
    .number()
    .int()
    .min(1, 'Capacity must be at least 1')
    .max(50, 'Capacity cannot exceed 50 for MVP')
    .default(2),
  status: z.enum(TABLE_STATUSES).default('available'),
  shape: z.enum(TABLE_SHAPES).default('square'),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateDiningTableSchema = createDiningTableSchema.partial().extend({
  id: z.string().uuid('Invalid dining table ID'),
});

export const bulkCreateDiningTablesSchema = z.object({
  serviceAreaId: z.string().uuid('Please select a valid service area'),
  prefix: z
    .string()
    .trim()
    .min(1, 'Table prefix is required (e.g. T or TABLE-)')
    .max(20, 'Prefix cannot exceed 20 characters')
    .transform((val) => val.toUpperCase()),
  startNumber: z.number().int().min(1, 'Start number must be at least 1').default(1),
  count: z
    .number()
    .int()
    .min(1, 'Count must be at least 1')
    .max(500, 'Bulk generation limit is 500 tables per request'),
  capacity: z
    .number()
    .int()
    .min(1, 'Capacity must be at least 1')
    .max(50, 'Capacity cannot exceed 50')
    .default(2),
  shape: z.enum(TABLE_SHAPES).default('square'),
});

export type CreateServiceAreaInput = z.infer<typeof createServiceAreaSchema>;
export type UpdateServiceAreaInput = z.infer<typeof updateServiceAreaSchema>;
export type CreateDiningTableInput = z.infer<typeof createDiningTableSchema>;
export type UpdateDiningTableInput = z.infer<typeof updateDiningTableSchema>;
export type BulkCreateDiningTablesInput = z.infer<typeof bulkCreateDiningTablesSchema>;

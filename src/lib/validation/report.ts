import { z } from 'zod';

export const reportPresetSchema = z.enum([
  'today',
  'yesterday',
  '7d',
  '30d',
  'last_7_days',
  'last_30_days',
  'this_month',
  'last_month',
  'custom',
]);

export const reportTypeSchema = z.enum([
  'sales_summary',
  'revenue_trend',
  'orders_by_hour',
  'payment_breakdown',
  'menu_performance',
  'modifier_performance',
  'kitchen_performance',
  'table_performance',
  'staff_performance',
  'branch_comparison',
]);

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'pdf']);

export const reportFilterSchema = z.object({
  preset: reportPresetSchema.default('today'),
  startDate: z.string().datetime({ offset: true }).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  interval: z.enum(['hour', 'day', 'week', 'month']).default('day').optional(),
  limit: z.number().int().min(1).max(100).default(10).optional(),
});

export const reportExportInputSchema = z.object({
  reportType: reportTypeSchema,
  format: exportFormatSchema,
  preset: reportPresetSchema.default('today'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

export type ReportPreset = z.infer<typeof reportPresetSchema>;
export type ReportType = z.infer<typeof reportTypeSchema>;
export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type ReportExportInput = z.infer<typeof reportExportInputSchema>;

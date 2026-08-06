import { z } from 'zod';

export const waiterRequestTypeEnum = z.enum([
  'call_waiter',
  'need_water',
  'need_bill',
  'need_assistance',
]);

export const waiterRequestStatusEnum = z.enum([
  'pending',
  'accepted',
  'completed',
  'dismissed',
]);

export const submitCustomerAssistanceSchema = z.object({
  rawQrToken: z.string().min(1, 'Branch QR token is required'),
  tableId: z.string().uuid('Table selection is required'),
  requestType: waiterRequestTypeEnum,
  orderId: z.string().uuid().optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

export const updateWaiterRequestStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: waiterRequestStatusEnum,
});

export type WaiterRequestType = z.infer<typeof waiterRequestTypeEnum>;
export type WaiterRequestStatus = z.infer<typeof waiterRequestStatusEnum>;
export type SubmitCustomerAssistanceInput = z.infer<typeof submitCustomerAssistanceSchema>;
export type UpdateWaiterRequestStatusInput = z.infer<typeof updateWaiterRequestStatusSchema>;

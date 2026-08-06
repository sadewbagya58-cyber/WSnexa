import { z } from 'zod';

export const paymentMethodSchema = z.enum([
  'cash',
  'card',
  'qr_pay',
  'pay_at_counter',
  'online',
]);

export const paymentStatusSchema = z.enum([
  'unpaid',
  'partially_paid',
  'paid',
  'refunded',
  'partially_refunded',
  'voided',
]);

export const recordPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  amountCents: z
    .number()
    .int('Payment amount must be an integer (minor units)')
    .positive('Payment amount must be greater than 0')
    .max(100000000, 'Payment amount exceeds maximum limit'),
  paymentMethod: paymentMethodSchema,
  externalReference: z
    .string()
    .max(100, 'External reference cannot exceed 100 characters')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable(),
  idempotencyKey: z
    .string()
    .min(1, 'Idempotency key is required')
    .max(100, 'Idempotency key cannot exceed 100 characters'),
});

export const voidPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  orderId: z.string().uuid('Invalid order ID format'),
  reason: z
    .string()
    .min(5, 'Void reason must be at least 5 characters')
    .max(300, 'Void reason cannot exceed 300 characters'),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

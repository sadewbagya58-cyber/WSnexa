import { z } from 'zod';

export const orderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
]);

export const paymentStatusEnum = z.enum([
  'unpaid',
  'paid',
  'refunded',
  'partially_refunded',
]);

export const paymentMethodEnum = z.enum([
  'cash',
  'card',
  'qr_pay',
  'pay_at_counter',
  'online',
]);

export const cartItemModifierInputSchema = z.object({
  groupId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export const cartItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  specialInstructions: z.string().max(300).optional().nullable(),
  selectedModifiers: z.array(cartItemModifierInputSchema).default([]),
});

export const createGuestOrderSchema = z.object({
  rawQrToken: z.string().min(1, 'Branch QR token is required'),
  tableId: z.string().uuid().optional().nullable(),
  inputPin: z.string().optional().nullable(),
  guestName: z.string().max(100).optional().nullable(),
  guestPhone: z.string().max(30).optional().nullable(),
  guestNotes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(8).max(100),
  cartItems: z.array(cartItemInputSchema).min(1, 'Cart cannot be empty'),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: orderStatusEnum,
  notes: z.string().max(300).optional().nullable(),
});

export type OrderStatus = z.infer<typeof orderStatusEnum>;
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
export type CartItemModifierInput = z.infer<typeof cartItemModifierInputSchema>;
export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CreateGuestOrderInput = z.infer<typeof createGuestOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

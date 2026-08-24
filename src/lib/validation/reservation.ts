import { z } from 'zod';

export const reservationStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'DECLINED',
]);

export const reservationSourceEnum = z.enum([
  'PUBLIC_WEB',
  'CUSTOMER_PORTAL',
  'STAFF',
  'PHONE',
  'WALK_IN',
  'IMPORT',
  'API',
]);

export const createReservationInputSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters').max(100, 'Guest name too long'),
  guestEmail: z.string().trim().email('Invalid email address').optional().nullable(),
  guestPhone: z.string().trim().min(7, 'Invalid phone number').max(30, 'Phone number too long').optional().nullable(),
  reservationStartAt: z.string().datetime('Invalid ISO start timestamp'),
  durationMinutes: z.number().int().min(15, 'Min duration 15 min').max(480, 'Max duration 8 hours').optional(),
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(100, 'Party size exceeds limit'),
  specialRequests: z.string().trim().max(1000, 'Special requests text too long').optional().nullable(),
  internalNotes: z.string().trim().max(2000, 'Internal notes text too long').optional().nullable(),
  occasion: z.string().trim().max(100, 'Occasion text too long').optional().nullable(),
  source: reservationSourceEnum.default('STAFF'),
  crmCustomerId: z.string().uuid('Invalid CRM customer ID').optional().nullable(),
});

export const createPublicReservationInputSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters').max(100, 'Guest name too long'),
  guestEmail: z.string().trim().email('Invalid email address').optional().nullable(),
  guestPhone: z.string().trim().min(7, 'Invalid phone number').max(30, 'Phone number too long').optional().nullable(),
  reservationStartAt: z.string().datetime('Invalid ISO start timestamp'),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(50, 'Party size too large'),
  specialRequests: z.string().trim().max(1000, 'Special requests text too long').optional().nullable(),
  occasion: z.string().trim().max(100, 'Occasion text too long').optional().nullable(),
});

export const updateReservationInputSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  guestName: z.string().trim().min(2).max(100).optional(),
  guestEmail: z.string().trim().email().optional().nullable(),
  guestPhone: z.string().trim().min(7).max(30).optional().nullable(),
  reservationStartAt: z.string().datetime().optional(),
  reservationEndAt: z.string().datetime().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  specialRequests: z.string().trim().max(1000).optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  occasion: z.string().trim().max(100).optional().nullable(),
});

export const cancelReservationInputSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  reason: z.string().trim().max(500, 'Reason too long').optional().nullable(),
});

export const reservationSettingsInputSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  reservationsEnabled: z.boolean().optional(),
  defaultDurationMinutes: z.number().int().min(15).max(480).optional(),
  minimumPartySize: z.number().int().min(1).max(50).optional(),
  maximumPartySize: z.number().int().min(1).max(100).optional(),
  minimumAdvanceMinutes: z.number().int().min(0).max(10080).optional(),
  maximumAdvanceDays: z.number().int().min(1).max(365).optional(),
  allowSameDay: z.boolean().optional(),
  requireGuestPhone: z.boolean().optional(),
  requireGuestEmail: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
});

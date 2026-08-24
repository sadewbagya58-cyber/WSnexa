import { z } from 'zod';

export const manualAssignTablesInputSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  tableIds: z.array(z.string().uuid()).min(1, 'At least one table must be selected'),
});

export const createWaitlistEntryInputSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters'),
  guestEmail: z.string().trim().email('Invalid email address').nullable().optional(),
  guestPhone: z.string().trim().min(5, 'Phone number must be at least 5 digits').nullable().optional(),
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(50, 'Party size cannot exceed 50'),
  requestedStartAt: z.string().datetime('Invalid requested start time'),
  requestedEndAt: z.string().datetime('Invalid requested end time').nullable().optional(),
  priority: z.number().int().min(0).max(100).optional().default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createWalkInSeatingInputSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters').default('Walk-In Guest'),
  guestEmail: z.string().trim().email('Invalid email address').nullable().optional(),
  guestPhone: z.string().trim().min(5, 'Phone number must be at least 5 digits').nullable().optional(),
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(50, 'Party size cannot exceed 50'),
  tableIds: z.array(z.string().uuid()).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  specialRequests: z.string().trim().max(500).nullable().optional(),
});

export const promoteWaitlistInputSchema = z.object({
  waitlistEntryId: z.string().uuid('Invalid waitlist entry ID'),
  tableIds: z.array(z.string().uuid()).optional(),
  autoConfirm: z.boolean().optional().default(true),
});

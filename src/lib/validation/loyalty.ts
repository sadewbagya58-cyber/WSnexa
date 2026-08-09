import { z } from 'zod';

export const earningModelEnum = z.enum(['spend_based', 'visit_based', 'combined']);
export type EarningModel = z.infer<typeof earningModelEnum>;

export const rewardTypeEnum = z.enum(['fixed_discount', 'percentage_discount', 'free_item', 'custom']);
export type RewardType = z.infer<typeof rewardTypeEnum>;

export const transactionTypeEnum = z.enum(['earn', 'redeem', 'expire', 'refund_adjustment', 'manual_adjustment']);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

export const loyaltyProgramSettingsSchema = z.object({
  isEnabled: z.boolean(),
  earningModel: earningModelEnum,
  spendLkrPerPoint: z.number().min(0.01, 'Spend per point must be greater than 0'),
  pointsPerVisit: z.number().int().min(0, 'Points per visit must be non-negative'),
  minimumOrderSpendCents: z.number().int().min(0, 'Minimum order spend must be non-negative'),
  minRedemptionBalance: z.number().int().min(0, 'Minimum redemption balance must be non-negative'),
  maxPointsPerOrder: z.number().int().min(1).nullable().optional(),
  pointsExpiryDays: z.number().int().min(1).nullable().optional(),
});

export type LoyaltyProgramSettingsInput = z.infer<typeof loyaltyProgramSettingsSchema>;

export const createRewardSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(100, 'Title too long'),
  description: z.string().max(300, 'Description too long').nullable().optional(),
  pointsRequired: z.number().int().min(1, 'Points required must be at least 1'),
  rewardType: rewardTypeEnum,
  discountAmountCents: z.number().int().min(0).nullable().optional(),
  discountPercentage: z.number().min(0).max(100).nullable().optional(),
  freeMenuItemId: z.string().uuid().nullable().optional(),
  minOrderValueCents: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const adjustPointsSchema = z.object({
  customerUserId: z.string().uuid('Invalid customer user ID'),
  pointsDelta: z.number().int().refine((val) => val !== 0, 'Points adjustment cannot be zero'),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(200, 'Reason too long'),
});

export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

export const upsertTierSchema = z.object({
  id: z.string().uuid().optional(),
  tierName: z.string().min(2, 'Tier name must be at least 2 characters').max(50, 'Tier name too long'),
  minLifetimeSpendCents: z.number().int().min(0).default(0),
  minLifetimePoints: z.number().int().min(0).default(0),
  minCompletedVisits: z.number().int().min(0).default(0),
  multiplier: z.number().min(1.0, 'Multiplier must be at least 1.0').default(1.0),
  badgeColor: z.string().max(20).default('#6B7280'),
});

export type UpsertTierInput = z.infer<typeof upsertTierSchema>;

export interface CustomerLoyaltyAccountRecord {
  id: string;
  customerUserId: string;
  businessId: string;
  businessName?: string;
  businessLogoUrl?: string | null;
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  lifetimeVisitCount: number;
  lifetimeSpendCents: number;
  currentTierId: string | null;
  tierName?: string | null;
  badgeColor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerRecord {
  id: string;
  customerUserId: string;
  businessId: string;
  orderId: string | null;
  rewardId: string | null;
  transactionType: TransactionType;
  points: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface LoyaltyRewardRecord {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  pointsRequired: number;
  rewardType: RewardType;
  discountAmountCents: number | null;
  discountPercentage: number | null;
  freeMenuItemId: string | null;
  freeMenuItemName?: string | null;
  minOrderValueCents: number;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

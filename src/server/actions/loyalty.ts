'use server';

import { createClient } from '@/lib/supabase/server';
import { LoyaltyService } from '@/server/services/loyalty.service';
import {
  loyaltyProgramSettingsSchema,
  createRewardSchema,
  adjustPointsSchema,
  LoyaltyProgramSettingsInput,
  CreateRewardInput,
  AdjustPointsInput,
} from '@/lib/validation/loyalty';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

export async function getProgramSettingsAction() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const settings = await LoyaltyService.getProgramSettings(context.business.id);
  return { success: true, settings };
}

export async function updateProgramSettingsAction(input: LoyaltyProgramSettingsInput) {
  if (!IS_LOYALTY_ENABLED) {
    return { success: false, message: 'Loyalty & Rewards configuration is planned for a future update.' };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = loyaltyProgramSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  return await LoyaltyService.updateProgramSettings(context.business.id, parsed.data);
}

export async function getAvailableRewardsAction(businessId: string) {
  if (!IS_LOYALTY_ENABLED) {
    return { success: true, rewards: [] };
  }

  let targetBizId = businessId;
  if (targetBizId === 'current') {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) return { success: false, rewards: [] };
    targetBizId = context.business.id;
  }
  const rewards = await LoyaltyService.getAvailableRewards(targetBizId);
  return { success: true, rewards };
}

export async function createRewardAction(input: CreateRewardInput) {
  if (!IS_LOYALTY_ENABLED) {
    return { success: false, message: 'Reward creation is planned for a future update.' };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = createRewardSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  return await LoyaltyService.createReward(context.business.id, parsed.data);
}

export async function redeemRewardAction(businessId: string, rewardId: string, orderId?: string) {
  if (!IS_LOYALTY_ENABLED) {
    return { success: false, message: 'Loyalty reward redemption is planned for a future update.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required to redeem rewards.' };
  }

  return await LoyaltyService.redeemReward(user.id, businessId, rewardId, orderId);
}

export async function adjustCustomerPointsAction(input: AdjustPointsInput) {
  if (!IS_LOYALTY_ENABLED) {
    return { success: false, message: 'Points adjustments are disabled in this version.' };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = adjustPointsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  return await LoyaltyService.adjustCustomerPoints(context.business.id, parsed.data, context.user.id);
}

export async function getBusinessLoyaltyCustomersAction() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const customers = await LoyaltyService.getBusinessLoyaltyCustomers(context.business.id);
  return { success: true, customers };
}

export async function getCustomerLoyaltyAccountsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, accounts: [] };
  }

  const accounts = await LoyaltyService.getCustomerLoyaltyAccounts(user.id);
  return { success: true, accounts };
}

export async function getCustomerLedgerAction(businessId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, ledger: [] };
  }

  const ledger = await LoyaltyService.getCustomerLedger(user.id, businessId);
  return { success: true, ledger };
}

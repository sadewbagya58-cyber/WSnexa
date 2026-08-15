import { createAdminClient } from '@/lib/supabase/server';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';
import type {
  LoyaltyProgramSettingsInput,
  CreateRewardInput,
  AdjustPointsInput,
  CustomerLoyaltyAccountRecord,
  LoyaltyRewardRecord,
  LoyaltyLedgerRecord,
} from '@/lib/validation/loyalty';

export type {
  LoyaltyProgramSettingsInput,
  CreateRewardInput,
  AdjustPointsInput,
  CustomerLoyaltyAccountRecord,
  LoyaltyRewardRecord,
  LoyaltyLedgerRecord,
};
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export class LoyaltyService {
  /**
   * Retrieves loyalty program settings for a business or returns default disabled state.
   */
  static async getProgramSettings(businessId: string) {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('loyalty_program_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!settings) {
      return {
        id: null,
        businessId,
        isEnabled: false,
        earningModel: 'spend_based' as const,
        spendLkrPerPoint: 100.0,
        pointsPerVisit: 10,
        minimumOrderSpendCents: 0,
        minRedemptionBalance: 0,
        maxPointsPerOrder: null,
        pointsExpiryDays: null,
      };
    }

    return {
      id: settings.id,
      businessId: settings.business_id,
      isEnabled: settings.is_enabled,
      earningModel: settings.earning_model,
      spendLkrPerPoint: Number(settings.spend_lkr_per_point || 100),
      pointsPerVisit: settings.points_per_visit || 10,
      minimumOrderSpendCents: settings.minimum_order_spend_cents || 0,
      minRedemptionBalance: settings.min_redemption_balance || 0,
      maxPointsPerOrder: settings.max_points_per_order,
      pointsExpiryDays: settings.points_expiry_days,
    };
  }

  /**
   * Updates loyalty program settings for a business.
   */
  static async updateProgramSettings(businessId: string, input: LoyaltyProgramSettingsInput) {
    const admin = createAdminClient();

    const payload = {
      business_id: businessId,
      is_enabled: input.isEnabled,
      earning_model: input.earningModel,
      spend_lkr_per_point: input.spendLkrPerPoint,
      points_per_visit: input.pointsPerVisit,
      minimum_order_spend_cents: input.minimumOrderSpendCents,
      min_redemption_balance: input.minRedemptionBalance,
      max_points_per_order: input.maxPointsPerOrder || null,
      points_expiry_days: input.pointsExpiryDays || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('loyalty_program_settings')
      .upsert(payload, { onConflict: 'business_id' })
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      action: 'loyalty.program.updated',
      target_type: 'loyalty_program_settings',
      target_id: data.id,
      payload: { is_enabled: input.isEnabled, earning_model: input.earningModel },
    });

    return { success: true, settings: data };
  }

  /**
   * Gets or initializes a customer's loyalty account for a specific business.
   */
  static async getCustomerAccount(userId: string, businessId: string): Promise<CustomerLoyaltyAccountRecord> {
    const admin = createAdminClient();

    const { data: account } = await admin
      .from('customer_loyalty_accounts')
      .select('*, loyalty_tiers(tier_name, badge_color), businesses(name, logo_url)')
      .eq('customer_user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (account) {
      return {
        id: account.id,
        customerUserId: account.customer_user_id,
        businessId: account.business_id,
        businessName: (account.businesses as unknown as { name?: string })?.name || 'Venue',
        businessLogoUrl: (account.businesses as unknown as { logo_url?: string | null })?.logo_url || null,
        pointsBalance: account.points_balance,
        lifetimePointsEarned: account.lifetime_points_earned,
        lifetimePointsRedeemed: account.lifetime_points_redeemed,
        lifetimeVisitCount: account.lifetime_visit_count,
        lifetimeSpendCents: account.lifetime_spend_cents,
        currentTierId: account.current_tier_id,
        tierName: (account.loyalty_tiers as unknown as { tier_name?: string })?.tier_name || 'Member',
        badgeColor: (account.loyalty_tiers as unknown as { badge_color?: string })?.badge_color || '#6B7280',
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      };
    }

    // Return virtual initialized account if none exists yet
    return {
      id: '',
      customerUserId: userId,
      businessId,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      lifetimePointsRedeemed: 0,
      lifetimeVisitCount: 0,
      lifetimeSpendCents: 0,
      currentTierId: null,
      tierName: 'Member',
      badgeColor: '#6B7280',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves multi-venue loyalty accounts for an authenticated customer (`/customer/loyalty`).
   */
  static async getCustomerLoyaltyAccounts(userId: string): Promise<CustomerLoyaltyAccountRecord[]> {
    const admin = createAdminClient();

    const { data: accounts } = await admin
      .from('customer_loyalty_accounts')
      .select('*, loyalty_tiers(tier_name, badge_color), businesses(name, logo_url)')
      .eq('customer_user_id', userId)
      .order('updated_at', { ascending: false });

    if (!accounts || accounts.length === 0) {
      return [];
    }

    return accounts.map((account) => ({
      id: account.id,
      customerUserId: account.customer_user_id,
      businessId: account.business_id,
      businessName: (account.businesses as unknown as { name?: string })?.name || 'Venue',
      businessLogoUrl: (account.businesses as unknown as { logo_url?: string | null })?.logo_url || null,
      pointsBalance: account.points_balance,
      lifetimePointsEarned: account.lifetime_points_earned,
      lifetimePointsRedeemed: account.lifetime_points_redeemed,
      lifetimeVisitCount: account.lifetime_visit_count,
      lifetimeSpendCents: account.lifetime_spend_cents,
      currentTierId: account.current_tier_id,
      tierName: (account.loyalty_tiers as unknown as { tier_name?: string })?.tier_name || 'Member',
      badgeColor: (account.loyalty_tiers as unknown as { badge_color?: string })?.badge_color || '#6B7280',
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    }));
  }

  /**
   * Idempotently processes point earning for a completed order.
   * Only awards points if:
   * 1. Loyalty program is enabled for the business.
   * 2. Order is completed + paid.
   * 3. Order is linked to a customer user (claimed).
   * 4. Order has not already earned points.
   */
  static async processOrderPointsEarning(orderId: string) {
    if (!IS_LOYALTY_ENABLED) {
      return { success: false, code: 'FEATURE_DISABLED', message: 'Loyalty points earning is temporarily disabled for V1.' };
    }

    const admin = createAdminClient();

    // 1. Fetch order details
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, customer_user_id, status, payment_status, subtotal_cents, total_cents')
      .eq('id', orderId)
      .single();

    if (!order || !order.customer_user_id) {
      return { success: false, code: 'NO_CUSTOMER', message: 'Order is not claimed by an authenticated customer user.' };
    }

    if (order.status !== 'completed' || order.payment_status !== 'paid') {
      return { success: false, code: 'NOT_ELIGIBLE', message: 'Order is not completed and paid.' };
    }

    // 2. Fetch program settings
    const settings = await this.getProgramSettings(order.business_id);
    if (!settings.isEnabled) {
      return { success: false, code: 'PROGRAM_DISABLED', message: 'Loyalty program is not active.' };
    }

    const orderSpendCents = order.total_cents || order.subtotal_cents || 0;
    if (orderSpendCents < settings.minimumOrderSpendCents) {
      return { success: false, code: 'MIN_SPEND_NOT_MET', message: 'Order spend below minimum spend threshold.' };
    }

    // 3. Check duplicate earning
    const { data: existingEarn } = await admin
      .from('loyalty_points_ledger')
      .select('id')
      .eq('order_id', orderId)
      .eq('transaction_type', 'earn')
      .maybeSingle();

    if (existingEarn) {
      return { success: true, alreadyEarned: true, message: 'Points already awarded for this order.' };
    }

    // 4. Calculate points
    let pointsEarned = 0;
    const spendLkr = orderSpendCents / 100;

    if (settings.earningModel === 'spend_based') {
      pointsEarned = Math.floor(spendLkr / settings.spendLkrPerPoint);
    } else if (settings.earningModel === 'visit_based') {
      pointsEarned = settings.pointsPerVisit;
    } else if (settings.earningModel === 'combined') {
      pointsEarned = Math.floor(spendLkr / settings.spendLkrPerPoint) + settings.pointsPerVisit;
    }

    if (settings.maxPointsPerOrder && pointsEarned > settings.maxPointsPerOrder) {
      pointsEarned = settings.maxPointsPerOrder;
    }

    if (pointsEarned <= 0) {
      return { success: true, pointsEarned: 0, message: 'Order calculated 0 points.' };
    }

    // 5. Ensure customer loyalty account exists
    const { data: account } = await admin
      .from('customer_loyalty_accounts')
      .select('id, points_balance, lifetime_points_earned, lifetime_visit_count, lifetime_spend_cents')
      .eq('customer_user_id', order.customer_user_id)
      .eq('business_id', order.business_id)
      .maybeSingle();

    const currentBalance = account?.points_balance || 0;
    const currentEarned = account?.lifetime_points_earned || 0;
    const currentVisits = account?.lifetime_visit_count || 0;
    const currentSpend = account?.lifetime_spend_cents || 0;

    const newBalance = currentBalance + pointsEarned;
    const newEarned = currentEarned + pointsEarned;
    const newVisits = currentVisits + 1;
    const newSpend = currentSpend + orderSpendCents;

    // 6. Update or insert customer loyalty account
    const { error: upsertErr } = await admin.from('customer_loyalty_accounts').upsert({
      customer_user_id: order.customer_user_id,
      business_id: order.business_id,
      points_balance: newBalance,
      lifetime_points_earned: newEarned,
      lifetime_visit_count: newVisits,
      lifetime_spend_cents: newSpend,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_user_id,business_id' });

    if (upsertErr) {
      return { success: false, message: upsertErr.message };
    }

    // 7. Insert immutable points ledger entry
    await admin.from('loyalty_points_ledger').insert({
      customer_user_id: order.customer_user_id,
      business_id: order.business_id,
      order_id: orderId,
      transaction_type: 'earn',
      points: pointsEarned,
      reason: `Earned ${pointsEarned} points on Order #${orderId.slice(0, 8)}`,
    });

    return { success: true, pointsEarned, newBalance };
  }

  /**
   * Rewards Management: Create Reward
   */
  static async createReward(businessId: string, input: CreateRewardInput) {
    const admin = createAdminClient();

    const payload = {
      business_id: businessId,
      title: input.title,
      description: input.description || null,
      points_required: input.pointsRequired,
      reward_type: input.rewardType,
      discount_amount_cents: input.discountAmountCents || null,
      discount_percentage: input.discountPercentage || null,
      free_menu_item_id: input.freeMenuItemId || null,
      min_order_value_cents: input.minOrderValueCents || 0,
      is_active: input.isActive ?? true,
      valid_from: input.validFrom || null,
      valid_until: input.validUntil || null,
    };

    const { data, error } = await admin.from('loyalty_rewards').insert(payload).select().single();
    if (error) {
      return { success: false, message: error.message };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      action: 'loyalty.reward.created',
      target_type: 'loyalty_rewards',
      target_id: data.id,
      payload: { title: input.title, points_required: input.pointsRequired },
    });

    return { success: true, reward: data };
  }

  /**
   * Retrieves active rewards for a business.
   */
  static async getAvailableRewards(businessId: string): Promise<LoyaltyRewardRecord[]> {
    const admin = createAdminClient();

    const { data: rewards } = await admin
      .from('loyalty_rewards')
      .select('*, menu_items(name)')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('points_required', { ascending: true });

    if (!rewards || rewards.length === 0) {
      return [];
    }

    return rewards.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      title: r.title,
      description: r.description,
      pointsRequired: r.points_required,
      rewardType: r.reward_type,
      discountAmountCents: r.discount_amount_cents,
      discountPercentage: r.discount_percentage ? Number(r.discount_percentage) : null,
      freeMenuItemId: r.free_menu_item_id,
      freeMenuItemName: (r.menu_items as unknown as { name?: string })?.name || null,
      minOrderValueCents: r.min_order_value_cents,
      isActive: r.is_active,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Redeem a reward securely for a customer.
   */
  static async redeemReward(userId: string, businessId: string, rewardId: string, orderId?: string) {
    if (!IS_LOYALTY_ENABLED) {
      return { success: false, code: 'FEATURE_DISABLED', message: 'Loyalty reward redemption is temporarily disabled for V1.' };
    }

    const admin = createAdminClient();

    // 1. Fetch reward details
    const { data: reward } = await admin
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .single();

    if (!reward) {
      return { success: false, code: 'REWARD_NOT_FOUND', message: 'Reward not found or inactive.' };
    }

    // 2. Fetch customer account
    const { data: account } = await admin
      .from('customer_loyalty_accounts')
      .select('id, points_balance, lifetime_points_redeemed')
      .eq('customer_user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!account || account.points_balance < reward.points_required) {
      return {
        success: false,
        code: 'INSUFFICIENT_POINTS',
        message: `Insufficient points balance. Required: ${reward.points_required}, Available: ${account?.points_balance || 0}.`,
      };
    }

    const newBalance = account.points_balance - reward.points_required;
    const newRedeemed = account.lifetime_points_redeemed + reward.points_required;

    // 3. Atomically update balance
    const { error: updateErr } = await admin
      .from('customer_loyalty_accounts')
      .update({
        points_balance: newBalance,
        lifetime_points_redeemed: newRedeemed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .gte('points_balance', reward.points_required); // Prevents concurrent double spend!

    if (updateErr) {
      return { success: false, message: updateErr.message || 'Failed to redeem points.' };
    }

    // 4. Create ledger entry
    await admin.from('loyalty_points_ledger').insert({
      customer_user_id: userId,
      business_id: businessId,
      order_id: orderId || null,
      reward_id: rewardId,
      transaction_type: 'redeem',
      points: -reward.points_required,
      reason: `Redeemed reward: ${reward.title}`,
    });

    // 5. Create redemption record
    const { data: redemption } = await admin
      .from('loyalty_reward_redemptions')
      .insert({
        business_id: businessId,
        customer_user_id: userId,
        reward_id: rewardId,
        order_id: orderId || null,
        points_spent: reward.points_required,
        status: 'applied',
      })
      .select()
      .single();

    return { success: true, redemptionId: redemption?.id, pointsDeducted: reward.points_required, newBalance };
  }

  /**
   * Server-side redemption of a reward applied during guest QR checkout.
   * Atomically validates points, calculates exact discount, deducts points, updates order totals & snapshots.
   */
  static async redeemRewardForOrder(
    userId: string,
    orderId: string,
    rewardId: string
  ): Promise<{ success: boolean; discountCents?: number; newTotalCents?: number; message?: string }> {
    const admin = createAdminClient();

    // 1. Fetch order details
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, subtotal_cents, tax_cents, service_charge_cents, total_cents, customer_user_id')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    // Link customer_user_id to order if not already set
    if (!order.customer_user_id) {
      await admin.from('orders').update({ customer_user_id: userId }).eq('id', orderId);
    }

    // 2. Fetch reward details (strictly for this business)
    const { data: reward } = await admin
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('business_id', order.business_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!reward) {
      return { success: false, message: 'Reward not found or inactive for this venue.' };
    }

    // Check validity dates if configured
    const now = new Date();
    if (reward.valid_from && new Date(reward.valid_from) > now) {
      return { success: false, message: 'Reward is not active yet.' };
    }
    if (reward.valid_until && new Date(reward.valid_until) < now) {
      return { success: false, message: 'Reward has expired.' };
    }

    // 3. Verify minimum order spend requirement
    const subtotalCents = order.subtotal_cents || 0;
    if (reward.min_order_value_cents && subtotalCents < reward.min_order_value_cents) {
      return { success: false, message: `Minimum order spend of LKR ${reward.min_order_value_cents / 100} required.` };
    }

    // 4. Fetch customer loyalty account for this business
    const { data: account } = await admin
      .from('customer_loyalty_accounts')
      .select('id, points_balance, lifetime_points_redeemed')
      .eq('customer_user_id', userId)
      .eq('business_id', order.business_id)
      .maybeSingle();

    if (!account || account.points_balance < reward.points_required) {
      return {
        success: false,
        message: `Insufficient points balance. Required: ${reward.points_required}, Available: ${account?.points_balance || 0}.`,
      };
    }

    // 5. Server-side calculation of discount amount
    let discountCents = 0;
    if (reward.reward_type === 'fixed_discount') {
      discountCents = Math.min(subtotalCents, reward.discount_amount_cents || 0);
    } else if (reward.reward_type === 'percentage_discount') {
      const pct = Number(reward.discount_percentage) || 0;
      discountCents = Math.min(subtotalCents, Math.round(subtotalCents * (pct / 100)));
    } else if (reward.reward_type === 'free_item' && reward.free_menu_item_id) {
      const { data: orderItem } = await admin
        .from('order_items')
        .select('unit_price_cents_snapshot')
        .eq('order_id', orderId)
        .eq('menu_item_id', reward.free_menu_item_id)
        .limit(1)
        .maybeSingle();
      if (orderItem) {
        discountCents = Math.min(subtotalCents, orderItem.unit_price_cents_snapshot);
      } else {
        discountCents = Math.min(subtotalCents, reward.discount_amount_cents || 0);
      }
    } else {
      discountCents = Math.min(subtotalCents, reward.discount_amount_cents || 0);
    }

    const taxCents = order.tax_cents || 0;
    const serviceChargeCents = order.service_charge_cents || 0;
    const newTotalCents = Math.max(0, subtotalCents + taxCents + serviceChargeCents - discountCents);

    // 6. Atomically update customer loyalty account points balance
    const newBalance = account.points_balance - reward.points_required;
    const newRedeemed = account.lifetime_points_redeemed + reward.points_required;

    const { error: updateErr } = await admin
      .from('customer_loyalty_accounts')
      .update({
        points_balance: newBalance,
        lifetime_points_redeemed: newRedeemed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .gte('points_balance', reward.points_required); // Guard against concurrent double spend!

    if (updateErr) {
      return { success: false, message: 'Failed to update points balance.' };
    }

    // 7. Update master order row with discount & immutable snapshots
    await admin
      .from('orders')
      .update({
        discount_cents: discountCents,
        total_cents: newTotalCents,
        reward_id: rewardId,
        reward_title_snapshot: reward.title,
        reward_points_redeemed_snapshot: reward.points_required,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // 8. Insert immutable points ledger entry
    await admin.from('loyalty_points_ledger').insert({
      customer_user_id: userId,
      business_id: order.business_id,
      order_id: orderId,
      reward_id: rewardId,
      transaction_type: 'redeem',
      points: -reward.points_required,
      reason: `Redeemed reward: ${reward.title} (-${reward.points_required} pts)`,
    });

    // 9. Insert redemption record
    await admin.from('loyalty_reward_redemptions').insert({
      business_id: order.business_id,
      customer_user_id: userId,
      reward_id: rewardId,
      order_id: orderId,
      points_spent: reward.points_required,
      status: 'applied',
    });

    return { success: true, discountCents, newTotalCents };
  }

  /**
   * Manual Point Adjustment by business staff (requires loyalty.points.adjust).
   */
  static async adjustCustomerPoints(businessId: string, input: AdjustPointsInput, staffUserId?: string) {
    let staffId = staffUserId || null;

    if (!staffId) {
      const context = await resolveActiveBusinessContext();
      if (context?.user) {
        staffId = context.user.id;
      }
    }

    const admin = createAdminClient();

    // 1. Fetch current account
    const { data: account } = await admin
      .from('customer_loyalty_accounts')
      .select('id, points_balance, lifetime_points_earned')
      .eq('customer_user_id', input.customerUserId)
      .eq('business_id', businessId)
      .maybeSingle();

    const currentBalance = account?.points_balance || 0;
    const currentEarned = account?.lifetime_points_earned || 0;

    const newBalance = Math.max(0, currentBalance + input.pointsDelta);
    const newEarned = input.pointsDelta > 0 ? currentEarned + input.pointsDelta : currentEarned;

    // 2. Upsert customer account
    const { error: upsertErr } = await admin.from('customer_loyalty_accounts').upsert({
      customer_user_id: input.customerUserId,
      business_id: businessId,
      points_balance: newBalance,
      lifetime_points_earned: newEarned,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_user_id,business_id' });

    if (upsertErr) {
      return { success: false, message: upsertErr.message };
    }

    // 3. Write ledger transaction
    await admin.from('loyalty_points_ledger').insert({
      customer_user_id: input.customerUserId,
      business_id: businessId,
      transaction_type: 'manual_adjustment',
      points: input.pointsDelta,
      reason: input.reason,
      created_by: staffId,
    });

    // 4. Audit log
    await admin.from('audit_logs').insert({
      business_id: businessId,
      action: 'loyalty.points.adjusted',
      target_type: 'customer_loyalty_accounts',
      target_id: input.customerUserId,
      payload: { delta: input.pointsDelta, reason: input.reason, adjusted_by: staffId },
    });

    return { success: true, newBalance };
  }

  /**
   * B2B Customer Roster for business owner (`/dashboard/loyalty/customers`).
   */
  static async getBusinessLoyaltyCustomers(businessId: string) {
    const admin = createAdminClient();

    const { data: accounts } = await admin
      .from('customer_loyalty_accounts')
      .select('*, user_profiles:customer_user_id(first_name, last_name, avatar_url), loyalty_tiers(tier_name)')
      .eq('business_id', businessId)
      .order('points_balance', { ascending: false });

    if (!accounts || accounts.length === 0) {
      return [];
    }

    return accounts.map((a) => {
      const profile = a.user_profiles as unknown as { first_name?: string; last_name?: string; avatar_url?: string | null };
      const firstName = profile?.first_name || 'Customer';
      const lastName = profile?.last_name || '';
      return {
        id: a.id,
        customerUserId: a.customer_user_id,
        customerName: `${firstName} ${lastName}`.trim(),
        avatarUrl: profile?.avatar_url || null,
        pointsBalance: a.points_balance,
        lifetimePointsEarned: a.lifetime_points_earned,
        lifetimePointsRedeemed: a.lifetime_points_redeemed,
        lifetimeVisitCount: a.lifetime_visit_count,
        lifetimeSpendCents: a.lifetime_spend_cents,
        tierName: (a.loyalty_tiers as unknown as { tier_name?: string })?.tier_name || 'Member',
        updatedAt: a.updated_at,
      };
    });
  }

  /**
   * Recent ledger activity for a customer account.
   */
  static async getCustomerLedger(userId: string, businessId?: string): Promise<LoyaltyLedgerRecord[]> {
    const admin = createAdminClient();

    let query = admin
      .from('loyalty_points_ledger')
      .select('*')
      .eq('customer_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data: ledger } = await query;
    if (!ledger || ledger.length === 0) {
      return [];
    }

    return ledger.map((l) => ({
      id: l.id,
      customerUserId: l.customer_user_id,
      businessId: l.business_id,
      orderId: l.order_id,
      rewardId: l.reward_id,
      transactionType: l.transaction_type,
      points: l.points,
      reason: l.reason,
      createdBy: l.created_by,
      createdAt: l.created_at,
    }));
  }
}

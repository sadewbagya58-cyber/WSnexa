'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { SubscriptionPlanCode } from '@/lib/config/subscription-plans';
import {
  SubscriptionPricingService,
  EnterprisePricingInput,
  SubscriptionPricingResult,
  SubscriptionPricingSnapshot,
} from '@/server/services/subscription-pricing.service';
import { SubscriptionService, DowngradeConflict } from '@/server/services/subscription.service';

export interface CheckoutPreviewResult {
  quote: SubscriptionPricingResult;
  allowed: boolean;
  conflicts: DowngradeConflict[] | null;
  currentPlanCode: SubscriptionPlanCode;
  isUpgrade: boolean;
  isDowngrade: boolean;
  isRenewal: boolean;
}

export interface PaymentIntentRecord {
  id: string;
  businessId: string;
  subscriptionId: string | null;
  planCode: SubscriptionPlanCode;
  billingInterval: string;
  amountLkr: number;
  currency: string;
  status: string;
  provider: string | null;
  idempotencyKey: string;
  pricingSnapshot: SubscriptionPricingSnapshot;
  initiatedByUserId: string | null;
  createdAt: string;
}

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  conflicts?: DowngradeConflict[];
}

/**
 * Preview subscription checkout quote & validate downgrade eligibility.
 * Client display is for UX estimate only; server recalculates canonical price.
 */
export async function previewSubscriptionCheckoutAction(input: {
  planCode: SubscriptionPlanCode;
  enterpriseConfig?: EnterprisePricingInput;
}): Promise<ActionResult<CheckoutPreviewResult>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
      return { success: false, error: 'UNAUTHORIZED_ROLE', message: 'Only Business Owners can manage subscription checkout.' };
    }

    const admin = createAdminClient();
    const { data: business } = await admin
      .from('businesses')
      .select('status')
      .eq('id', authContext.businessId)
      .maybeSingle();

    if (business && (business.status === 'suspended' || business.status === 'archived')) {
      return {
        success: false,
        error: 'PLATFORM_SUSPENDED',
        message: 'Platform workspace access is suspended. Subscription payment checkout is unavailable while platform suspended.',
      };
    }

    const subContext = await SubscriptionService.resolveSubscriptionContext(authContext.businessId);
    const currentPlanCode = subContext.subscription.plan_code;

    // Downgrade Eligibility Check
    const eligibility = await SubscriptionService.validateDowngradeEligibility(
      authContext.businessId,
      input.planCode
    );

    // Calculate canonical quote server-side
    const quote = SubscriptionPricingService.calculateSubscriptionPrice({
      planCode: input.planCode,
      billingInterval: 'monthly',
      enterpriseConfig: input.enterpriseConfig,
    });

    const isRenewal = currentPlanCode === input.planCode;
    const isDowngrade = !isRenewal && !eligibility.allowed;
    const isUpgrade = !isRenewal && !isDowngrade;

    return {
      success: true,
      data: {
        quote,
        allowed: eligibility.allowed,
        conflicts: eligibility.allowed ? null : eligibility.conflicts,
        currentPlanCode,
        isUpgrade,
        isDowngrade,
        isRenewal,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_PREVIEW_CHECKOUT';
    return { success: false, error: 'PREVIEW_ERROR', message };
  }
}

/**
 * Creates a PENDING subscription payment intent row in public.business_subscription_payments.
 * Server recalculates canonical price authoritatively. Does NOT activate subscription or collect funds.
 */
export async function createSubscriptionPaymentIntentAction(input: {
  planCode: SubscriptionPlanCode;
  enterpriseConfig?: EnterprisePricingInput;
  checkoutAttemptId?: string;
}): Promise<ActionResult<PaymentIntentRecord>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
      return { success: false, error: 'UNAUTHORIZED_ROLE', message: 'Only Business Owners can create subscription payment intents.' };
    }

    const admin = createAdminClient();
    const { data: business } = await admin
      .from('businesses')
      .select('status')
      .eq('id', authContext.businessId)
      .maybeSingle();

    if (business && (business.status === 'suspended' || business.status === 'archived')) {
      return {
        success: false,
        error: 'PLATFORM_SUSPENDED',
        message: 'Platform workspace access is suspended. Cannot create subscription payment intent.',
      };
    }

    // Downgrade Eligibility Validation
    const eligibility = await SubscriptionService.validateDowngradeEligibility(
      authContext.businessId,
      input.planCode
    );

    if (!eligibility.allowed) {
      return {
        success: false,
        error: 'DOWNGRADE_INELIGIBLE',
        message: 'Cannot switch to lower plan. Current resource usage exceeds destination plan limits.',
        conflicts: eligibility.conflicts,
      };
    }

    // Server-Authoritative Price Calculation
    const quote = SubscriptionPricingService.calculateSubscriptionPrice({
      planCode: input.planCode,
      billingInterval: 'monthly',
      enterpriseConfig: input.enterpriseConfig,
    });

    if (quote.pricingMode === 'CONTACT_SALES') {
      return {
        success: false,
        error: 'CONTACT_SALES_REQUIRED',
        message: 'Custom Enterprise configuration requires direct sales engagement.',
      };
    }

    const snapshot = SubscriptionPricingService.createPricingSnapshot(quote);
    const subContext = await SubscriptionService.resolveSubscriptionContext(authContext.businessId);

    // Stable Idempotency Key Generation
    const attemptTag = input.checkoutAttemptId || 'default';
    const idempotencyKey = `sub_intent_${authContext.businessId}_${input.planCode}_${attemptTag}`;

    // Check for existing pending intent with matching idempotency key
    const { data: existingIntent } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('business_id', authContext.businessId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingIntent) {
      return {
        success: true,
        data: {
          id: existingIntent.id,
          businessId: existingIntent.business_id,
          subscriptionId: existingIntent.subscription_id,
          planCode: existingIntent.plan_code as SubscriptionPlanCode,
          billingInterval: existingIntent.billing_interval,
          amountLkr: existingIntent.amount_lkr,
          currency: existingIntent.currency,
          status: existingIntent.status,
          provider: existingIntent.provider,
          idempotencyKey: existingIntent.idempotency_key,
          pricingSnapshot: existingIntent.pricing_snapshot as SubscriptionPricingSnapshot,
          initiatedByUserId: existingIntent.initiated_by_user_id,
          createdAt: existingIntent.created_at,
        },
      };
    }

    // Insert new PENDING payment intent row
    const { data: inserted, error: insertError } = await admin
      .from('business_subscription_payments')
      .insert({
        business_id: authContext.businessId,
        subscription_id: subContext.subscription.id,
        plan_code: input.planCode,
        billing_interval: 'monthly',
        amount_lkr: quote.total,
        currency: 'LKR',
        status: 'pending',
        provider: null,
        idempotency_key: idempotencyKey,
        pricing_snapshot: snapshot,
        initiated_by_user_id: authContext.userId,
      })
      .select('*')
      .single();

    if (insertError || !inserted) {
      return { success: false, error: 'INTENT_CREATION_FAILED', message: insertError?.message || 'Failed to create payment intent.' };
    }

    return {
      success: true,
      data: {
        id: inserted.id,
        businessId: inserted.business_id,
        subscriptionId: inserted.subscription_id,
        planCode: inserted.plan_code as SubscriptionPlanCode,
        billingInterval: inserted.billing_interval,
        amountLkr: inserted.amount_lkr,
        currency: inserted.currency,
        status: inserted.status,
        provider: inserted.provider,
        idempotencyKey: inserted.idempotency_key,
        pricingSnapshot: inserted.pricing_snapshot as SubscriptionPricingSnapshot,
        initiatedByUserId: inserted.initiated_by_user_id,
        createdAt: inserted.created_at,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_CREATE_PAYMENT_INTENT';
    return { success: false, error: 'CREATE_INTENT_ERROR', message };
  }
}

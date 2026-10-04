'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { SubscriptionPlanCode } from '@/lib/config/subscription-plans';
import {
  SubscriptionPricingService,
  EnterprisePricingInput,
} from '@/server/services/subscription-pricing.service';
import { SubscriptionService } from '@/server/services/subscription.service';
import { ManualBankTransferService } from '@/server/payments/subscriptions/manual-bank-transfer.service';
import { getWSNexaBankDetails } from '@/lib/config/bank-transfer';
import { ActionResult } from './subscription-checkout';

export interface BankTransferIntentResult {
  paymentId: string;
  businessId: string;
  planCode: SubscriptionPlanCode;
  amountLkr: number;
  currency: string;
  status: string;
  reviewStatus: string;
  paymentMethod: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface BankTransferDetailsResult {
  payment: {
    id: string;
    businessId: string;
    planCode: SubscriptionPlanCode;
    amountLkr: number;
    currency: string;
    status: string;
    reviewStatus: string;
    paymentMethod: string;
    createdAt: string;
  };
  proof?: {
    id: string;
    filePath: string;
    fileSizeBytes: number;
    mimeType: string;
    reviewStatus: string;
    notes: string | null;
    createdAt: string;
  };
  claim?: {
    id: string;
    rawReference: string;
    normalizedReference: string;
    claimStatus: string;
    createdAt: string;
  };
}

/**
 * Creates or reuses a pending manual bank transfer payment intent for a business owner.
 */
export async function createBankTransferIntentAction(input: {
  planCode: SubscriptionPlanCode;
  enterpriseConfig?: EnterprisePricingInput;
}): Promise<ActionResult<BankTransferIntentResult>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
      return {
        success: false,
        error: 'UNAUTHORIZED_ROLE',
        message: 'Only Business Owners can initiate subscription payments.',
      };
    }

    // Operational Gating: Direct bank transfer must be formally configured and authorized
    const bankDetails = getWSNexaBankDetails();
    if (!bankDetails.isConfigured) {
      return {
        success: false,
        error: 'BANK_TRANSFER_NOT_CONFIGURED',
        message: bankDetails.unconfiguredMessage,
      };
    }

    const businessId = authContext.businessId;
    const admin = createAdminClient();

    // Check platform suspension
    const { data: business } = await admin
      .from('businesses')
      .select('status')
      .eq('id', businessId)
      .maybeSingle();

    if (business && (business.status === 'suspended' || business.status === 'archived')) {
      return {
        success: false,
        error: 'PLATFORM_SUSPENDED',
        message: 'Workspace access is currently suspended. Payment cannot be initiated.',
      };
    }

    // Downgrade eligibility validation
    const downgradeCheck = await SubscriptionService.validateDowngradeEligibility(businessId, input.planCode);
    if (!downgradeCheck.allowed) {
      return {
        success: false,
        error: 'DOWNGRADE_INELIGIBLE',
        message: 'Your current resource usage exceeds the limits of the selected plan.',
        conflicts: downgradeCheck.conflicts,
      };
    }

    // Authoritative server-side pricing
    const pricing = SubscriptionPricingService.calculateSubscriptionPrice({
      planCode: input.planCode,
      billingInterval: 'monthly',
      enterpriseConfig: input.enterpriseConfig,
    });
    const snapshot = SubscriptionPricingService.createPricingSnapshot(pricing);

    // Check for existing pending bank transfer intent for this business and plan
    const { data: existingIntent } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('business_id', businessId)
      .eq('plan_code', input.planCode)
      .eq('payment_method', 'manual_bank_transfer')
      .eq('status', 'pending')
      .maybeSingle();

    if (existingIntent && existingIntent.amount_lkr === pricing.total) {
      return {
        success: true,
        data: {
          paymentId: existingIntent.id,
          businessId: existingIntent.business_id,
          planCode: existingIntent.plan_code as SubscriptionPlanCode,
          amountLkr: existingIntent.amount_lkr,
          currency: existingIntent.currency,
          status: existingIntent.status,
          reviewStatus: existingIntent.review_status || 'pending_proof',
          paymentMethod: existingIntent.payment_method,
          idempotencyKey: existingIntent.idempotency_key,
          createdAt: existingIntent.created_at,
        },
      };
    }

    // Get current subscription ID if available
    const { data: currentSub } = await admin
      .from('business_subscriptions')
      .select('id')
      .eq('business_id', businessId)
      .maybeSingle();

    const idempotencyKey = `manual_bt_${businessId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: newIntent, error: insertError } = await admin
      .from('business_subscription_payments')
      .insert({
        business_id: businessId,
        subscription_id: currentSub?.id || null,
        plan_code: input.planCode,
        billing_interval: 'monthly',
        amount_lkr: pricing.total,
        currency: 'LKR',
        status: 'pending',
        payment_method: 'manual_bank_transfer',
        review_status: 'pending_proof',
        provider: null,
        idempotency_key: idempotencyKey,
        pricing_snapshot: snapshot,
        initiated_by_user_id: authContext.userId,
      })
      .select('*')
      .single();

    if (insertError || !newIntent) {
      return {
        success: false,
        error: 'INTENT_CREATION_FAILED',
        message: insertError?.message || 'Failed to create payment intent.',
      };
    }

    return {
      success: true,
      data: {
        paymentId: newIntent.id,
        businessId: newIntent.business_id,
        planCode: newIntent.plan_code as SubscriptionPlanCode,
        amountLkr: newIntent.amount_lkr,
        currency: newIntent.currency,
        status: newIntent.status,
        reviewStatus: newIntent.review_status || 'pending_proof',
        paymentMethod: newIntent.payment_method,
        idempotencyKey: newIntent.idempotency_key,
        createdAt: newIntent.created_at,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_CREATE_INTENT';
    return { success: false, error: message };
  }
}

/**
 * Submits bank transfer proof and registers reference claim.
 */
export async function submitBankTransferProofAction(input: {
  paymentId: string;
  rawReference: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  notes?: string;
}): Promise<ActionResult<{
  claimId: string;
  proofId: string;
  claimStatus: string;
  normalizedReference: string;
}>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
      return {
        success: false,
        error: 'UNAUTHORIZED_ROLE',
        message: 'Only Business Owners can submit payment proof.',
      };
    }

    // Operational Gating: Direct bank transfer must be formally configured and authorized
    const bankDetails = getWSNexaBankDetails();
    if (!bankDetails.isConfigured) {
      return {
        success: false,
        error: 'BANK_TRANSFER_NOT_CONFIGURED',
        message: bankDetails.unconfiguredMessage,
      };
    }

    const result = await ManualBankTransferService.submitProof({
      paymentId: input.paymentId,
      businessId: authContext.businessId,
      rawReference: input.rawReference,
      filePath: input.filePath,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      notes: input.notes,
    });

    return {
      success: true,
      data: result,
      message: 'Proof submitted successfully. Our team will verify the payment shortly.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_SUBMIT_PROOF';
    return { success: false, error: message };
  }
}

/**
 * Retrieves payment details, proof, and claim for the current owner.
 */
export async function getBankTransferDetailsAction(
  paymentId: string
): Promise<ActionResult<BankTransferDetailsResult>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const admin = createAdminClient();

    const { data: payment, error: pError } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('business_id', authContext.businessId)
      .single();

    if (pError || !payment) {
      return { success: false, error: 'PAYMENT_NOT_FOUND' };
    }

    const { data: proof } = await admin
      .from('business_subscription_proofs')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('business_id', authContext.businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: claim } = await admin
      .from('business_subscription_payment_reference_claims')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('business_id', authContext.businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      success: true,
      data: {
        payment: {
          id: payment.id,
          businessId: payment.business_id,
          planCode: payment.plan_code as SubscriptionPlanCode,
          amountLkr: payment.amount_lkr,
          currency: payment.currency,
          status: payment.status,
          reviewStatus: payment.review_status || 'none',
          paymentMethod: payment.payment_method || 'none',
          createdAt: payment.created_at,
        },
        proof: proof ? {
          id: proof.id,
          filePath: proof.file_path,
          fileSizeBytes: proof.file_size_bytes,
          mimeType: proof.mime_type,
          reviewStatus: proof.review_status,
          notes: proof.notes,
          createdAt: proof.created_at,
        } : undefined,
        claim: claim ? {
          id: claim.id,
          rawReference: claim.raw_reference,
          normalizedReference: claim.normalized_reference,
          claimStatus: claim.claim_status,
          createdAt: claim.created_at,
        } : undefined,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_LOAD_DETAILS';
    return { success: false, error: message };
  }
}

import { createAdminClient } from '@/lib/supabase/server';
import { SubscriptionPlanCode } from '@/lib/config/subscription-plans';
import { ProviderVerificationResult } from './subscription-payment-provider';
import { PaymentProviderError } from './provider-registry';
import { assertLegalPaymentStateTransition } from './payment-state-machine';
import { SubscriptionService } from '@/server/services/subscription.service';

export interface SettlementOptions {
  paymentIntentId?: string;
  idempotencyKey?: string;
}

export interface SettlementResult {
  success: boolean;
  alreadySettled: boolean;
  paymentIntent: Record<string, unknown>;
}

export class SubscriptionPaymentSettlementService {
  /**
   * Process a server-verified gateway payment result.
   * Authoritatively updates payment intent status, enforces settlement idempotency,
   * validates exact amount/currency match, respects platform suspension precedence,
   * and invokes Subscription Core activation/renewal.
   */
  static async processVerifiedPaymentSettlement(
    verification: ProviderVerificationResult,
    options: SettlementOptions = {}
  ): Promise<SettlementResult> {
    if (!verification || !verification.verified) {
      throw new PaymentProviderError(
        'SIGNATURE_VERIFICATION_FAILED',
        'Cannot process unverified payment settlement payload'
      );
    }

    const admin = createAdminClient();

    // 1. Locate Payment Intent Record
    let query = admin.from('business_subscription_payments').select('*');

    if (options.paymentIntentId) {
      query = query.eq('id', options.paymentIntentId);
    } else if (options.idempotencyKey) {
      query = query.eq('idempotency_key', options.idempotencyKey);
    } else if (verification.providerTransactionId) {
      query = query.eq('provider_transaction_id', verification.providerTransactionId);
    } else {
      throw new PaymentProviderError(
        'PAYMENT_INTENT_NOT_FOUND',
        'Must supply paymentIntentId, idempotencyKey, or providerTransactionId to locate intent'
      );
    }

    const { data: paymentIntent, error: findError } = await query.maybeSingle();

    if (findError || !paymentIntent) {
      throw new PaymentProviderError(
        'PAYMENT_INTENT_NOT_FOUND',
        'Matching subscription payment intent was not found'
      );
    }

    // 2. Settlement Idempotency Check
    if (paymentIntent.status === 'paid') {
      if (verification.paymentStatus === 'paid') {
        return {
          success: true,
          alreadySettled: true,
          paymentIntent,
        };
      } else {
        throw new PaymentProviderError(
          'INVALID_PAYMENT_TRANSITION',
          `Payment intent #${paymentIntent.id} is already settled as PAID and cannot be transitioned to ${verification.paymentStatus}`
        );
      }
    }

    // 3. Assert Legal State Machine Transition
    assertLegalPaymentStateTransition(paymentIntent.status, verification.paymentStatus);

    // 4. Exact Amount & Currency Match Verification
    if (verification.amountLkr !== paymentIntent.amount_lkr) {
      throw new PaymentProviderError(
        'PAYMENT_AMOUNT_MISMATCH',
        `Verified amount LKR ${verification.amountLkr} does not match intent amount LKR ${paymentIntent.amount_lkr}`
      );
    }

    if (verification.currency !== 'LKR') {
      throw new PaymentProviderError(
        'PAYMENT_CURRENCY_MISMATCH',
        `Verified currency ${verification.currency} does not match required currency LKR`
      );
    }

    // 5. Provider Transaction Uniqueness Check (Prevent 1 tx from settling multiple intents)
    if (verification.providerTransactionId) {
      const { data: duplicateTx } = await admin
        .from('business_subscription_payments')
        .select('id')
        .eq('provider', verification.provider)
        .eq('provider_transaction_id', verification.providerTransactionId)
        .neq('id', paymentIntent.id)
        .maybeSingle();

      if (duplicateTx) {
        throw new PaymentProviderError(
          'INVALID_PROVIDER_RESPONSE',
          `Provider transaction ID "${verification.providerTransactionId}" has already been applied to payment intent #${duplicateTx.id}`
        );
      }
    }

    // 6. Platform Suspension Precedence Check
    const { data: business } = await admin
      .from('businesses')
      .select('status')
      .eq('id', paymentIntent.business_id)
      .maybeSingle();

    if (business && (business.status === 'suspended' || business.status === 'archived')) {
      throw new PaymentProviderError(
        'PLATFORM_SUSPENDED_SETTLEMENT_BLOCKED',
        'Platform workspace access is suspended. Commercial payment settlement cannot override platform suspension.'
      );
    }

    // 7. Update Payment Intent Record
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: verification.paymentStatus,
      provider: verification.provider,
      provider_transaction_id: verification.providerTransactionId || paymentIntent.provider_transaction_id,
      provider_reference: verification.providerReference || paymentIntent.provider_reference,
      failure_code: verification.failureCode || null,
      failure_message: verification.failureMessage || null,
      updated_at: now,
    };

    if (verification.paymentStatus === 'paid') {
      updatePayload.paid_at = now;
    } else if (verification.paymentStatus === 'failed') {
      updatePayload.failed_at = now;
    } else if (verification.paymentStatus === 'cancelled') {
      updatePayload.cancelled_at = now;
    } else if (verification.paymentStatus === 'processing') {
      updatePayload.processing_at = now;
    }

    const { data: updatedIntent, error: updateError } = await admin
      .from('business_subscription_payments')
      .update(updatePayload)
      .eq('id', paymentIntent.id)
      .select('*')
      .single();

    if (updateError || !updatedIntent) {
      throw new Error(`Failed to update payment intent status: ${updateError?.message}`);
    }

    // 8. Invoke Subscription Core Lifecycle Activation (ONLY if status === 'paid')
    if (verification.paymentStatus === 'paid') {
      await SubscriptionService.activateSubscriptionFromVerifiedPayment({
        businessId: paymentIntent.business_id,
        planCode: paymentIntent.plan_code as SubscriptionPlanCode,
        pricingSnapshot: paymentIntent.pricing_snapshot,
        paymentPurpose: paymentIntent.payment_purpose || 'new_subscription',
        actorId: paymentIntent.initiated_by_user_id || 'gateway_webhook',
      });
    }

    return {
      success: true,
      alreadySettled: false,
      paymentIntent: updatedIntent,
    };
  }
}

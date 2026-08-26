'use server';

import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { requireSuperAdmin } from '@/server/auth/super-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { SubscriptionPaymentQueryService } from '@/server/services/subscription-payment-query.service';
import { assertLegalPaymentStateTransition } from '../payments/subscriptions/payment-state-machine';

export interface GetOwnerPaymentHistoryInput {
  page?: number;
  limit?: number;
}

export interface GetAdminPaymentsInput {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  purpose?: string;
  plan?: string;
  search?: string;
  businessId?: string;
}

export interface CancelPaymentIntentInput {
  paymentId: string;
  reason?: string;
}

export interface ExpirePaymentIntentInput {
  paymentId: string;
  reason: string;
}

/**
 * Server action to retrieve owner's subscription payment history (tenant isolated).
 */
export async function getOwnerPaymentHistoryAction(input: GetOwnerPaymentHistoryInput = {}) {
  try {
    const authContext = await resolveAuthorizationContext();

    if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
      return { success: false, error: 'UNAUTHORIZED_ROLE', message: 'Only Business Owners can access subscription payment history.' };
    }

    if (!authContext.businessId) {
      return { success: false, error: 'MISSING_BUSINESS_CONTEXT', message: 'No active business context found.' };
    }

    const result = await SubscriptionPaymentQueryService.listOwnerSubscriptionPayments({
      businessId: authContext.businessId,
      page: input.page || 1,
      limit: input.limit || 10,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch billing history';
    return { success: false, error: 'FETCH_ERROR', message };
  }
}

/**
 * Server action to retrieve platform-wide subscription payments for Super Admin.
 */
export async function getAdminPaymentsAction(input: GetAdminPaymentsInput = {}) {
  try {
    await requireSuperAdmin();
    const result = await SubscriptionPaymentQueryService.listAdminSubscriptionPayments(input);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch admin payment records';
    return { success: false, error: 'FETCH_ERROR', message };
  }
}

/**
 * Server action for owner or Super Admin to cancel a PENDING subscription payment intent.
 */
export async function cancelPendingPaymentIntentAction(input: CancelPaymentIntentInput) {
  try {
    if (!input.paymentId) {
      return { success: false, error: 'INVALID_INPUT', message: 'Payment ID is required.' };
    }

    const admin = createAdminClient();

    // Check if Super Admin first
    let isSuperAdmin = false;
    try {
      await requireSuperAdmin();
      isSuperAdmin = true;
    } catch {}

    let authContext = null;
    if (!isSuperAdmin) {
      authContext = await resolveAuthorizationContext();
      if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
        return { success: false, error: 'UNAUTHORIZED_ROLE', message: 'Only Business Owners or Super Admins can cancel payment intents.' };
      }
    }

    if (isSuperAdmin && (!input.reason || !input.reason.trim())) {
      return { success: false, error: 'REASON_REQUIRED', message: 'Super Admin cancellation requires an administrative reason.' };
    }

    // Fetch payment intent
    const { data: intent, error: fetchErr } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('id', input.paymentId)
      .maybeSingle();

    if (fetchErr || !intent) {
      return { success: false, error: 'NOT_FOUND', message: 'Payment intent not found.' };
    }

    // Tenant isolation check if owner
    if (!isSuperAdmin && authContext && intent.business_id !== authContext.businessId) {
      return { success: false, error: 'TENANT_MISMATCH', message: 'You cannot cancel payment intents for another business.' };
    }

    if (intent.status !== 'pending') {
      return { success: false, error: 'INVALID_STATUS', message: `Only PENDING payment intents can be cancelled. Current status is ${intent.status.toUpperCase()}.` };
    }

    assertLegalPaymentStateTransition(intent.status, 'cancelled');

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await admin
      .from('business_subscription_payments')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        admin_reason: input.reason?.trim() || (isSuperAdmin ? 'admin_cancelled' : 'owner_cancelled'),
        updated_at: now,
      })
      .eq('id', intent.id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      return { success: false, error: 'UPDATE_FAILED', message: `Failed to cancel intent: ${updateErr?.message}` };
    }

    // Record audit entry if admin
    if (isSuperAdmin) {
      await admin.from('audit_logs').insert({
        business_id: intent.business_id,
        action: 'payment.cancelled_by_admin',
        target_type: 'subscription_payment',
        target_id: intent.id,
        payload: {
          previousStatus: 'pending',
          newStatus: 'cancelled',
          reason: input.reason?.trim(),
          amountLkr: intent.amount_lkr,
          planCode: intent.plan_code,
        },
      });
    }

    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel payment intent';
    return { success: false, error: 'ACTION_FAILED', message };
  }
}

/**
 * Server action for Super Admin to mark a PENDING subscription payment intent EXPIRED.
 */
export async function expirePendingPaymentIntentAction(input: ExpirePaymentIntentInput) {
  try {
    await requireSuperAdmin();

    if (!input.paymentId) {
      return { success: false, error: 'INVALID_INPUT', message: 'Payment ID is required.' };
    }

    if (!input.reason || !input.reason.trim()) {
      return { success: false, error: 'REASON_REQUIRED', message: 'Super Admin expiration requires an administrative reason.' };
    }

    const admin = createAdminClient();
    const { data: intent, error: fetchErr } = await admin
      .from('business_subscription_payments')
      .select('*')
      .eq('id', input.paymentId)
      .maybeSingle();

    if (fetchErr || !intent) {
      return { success: false, error: 'NOT_FOUND', message: 'Payment intent not found.' };
    }

    if (intent.status !== 'pending') {
      return { success: false, error: 'INVALID_STATUS', message: `Only PENDING payment intents can be expired. Current status is ${intent.status.toUpperCase()}.` };
    }

    assertLegalPaymentStateTransition(intent.status, 'expired');

    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await admin
      .from('business_subscription_payments')
      .update({
        status: 'expired',
        expired_at: now,
        admin_reason: input.reason.trim(),
        updated_at: now,
      })
      .eq('id', intent.id)
      .select('*')
      .single();

    if (updateErr || !updated) {
      return { success: false, error: 'UPDATE_FAILED', message: `Failed to expire intent: ${updateErr?.message}` };
    }

    // Audit Log Entry
    await admin.from('audit_logs').insert({
      business_id: intent.business_id,
      action: 'payment.expired_by_admin',
      target_type: 'subscription_payment',
      target_id: intent.id,
      payload: {
        previousStatus: 'pending',
        newStatus: 'expired',
        reason: input.reason.trim(),
        amountLkr: intent.amount_lkr,
        planCode: intent.plan_code,
      },
    });

    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to expire payment intent';
    return { success: false, error: 'ACTION_FAILED', message };
  }
}

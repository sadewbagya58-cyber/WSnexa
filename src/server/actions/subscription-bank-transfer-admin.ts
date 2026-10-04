'use server';

import { requireSuperAdmin } from '@/server/auth/super-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ManualBankTransferService } from '@/server/payments/subscriptions/manual-bank-transfer.service';
import { ActionResult } from './subscription-checkout';

export interface AdminApprovePaymentInput {
  paymentId: string;
  expectedPlanId: string;
  expectedAmountLkr: number;
  reconciliationNote: string;
  externalBankStatementRef: string;
}

export interface AdminRejectPaymentInput {
  paymentId: string;
  rejectionReason: string;
}

export interface AdminBankTransferReviewDetails {
  payment: {
    id: string;
    businessId: string;
    businessName: string;
    planCode: string;
    billingInterval: string;
    amountLkr: number;
    currency: string;
    status: string;
    reviewStatus: string;
    paymentMethod: string;
    pricingSnapshot: Record<string, unknown>;
    createdAt: string;
  };
  proof?: {
    id: string;
    filePath: string;
    signedUrl: string | null;
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
    conflictMetadata: Record<string, unknown>;
    createdAt: string;
  };
  resourceAudit: {
    activeBranches: number;
    activeStaff: number;
  };
}

/**
 * Super Admin Action to atomically approve and settle a verified bank transfer payment.
 */
export async function approveBankTransferPaymentAdminAction(
  input: AdminApprovePaymentInput
): Promise<ActionResult<{
  paymentId: string;
  businessId: string;
  subscriptionId: string;
  planCode: string;
  periodStartsAt: string;
  periodEndsAt: string;
  auditId: string;
}>> {
  try {
    await requireSuperAdmin();

    if (!input.paymentId) {
      return { success: false, error: 'INVALID_INPUT', message: 'Payment ID is required.' };
    }

    if (!input.reconciliationNote || !input.reconciliationNote.trim()) {
      return { success: false, error: 'REASON_REQUIRED', message: 'Reconciliation note is mandatory for settlement.' };
    }

    if (!input.externalBankStatementRef || !input.externalBankStatementRef.trim()) {
      return { success: false, error: 'STATEMENT_REF_REQUIRED', message: 'Bank statement transaction reference is mandatory.' };
    }

    const result = await ManualBankTransferService.approvePayment({
      paymentId: input.paymentId,
      expectedPlanId: input.expectedPlanId,
      expectedAmountLkr: input.expectedAmountLkr,
      reconciliationNote: input.reconciliationNote,
      externalBankStatementRef: input.externalBankStatementRef,
    });

    return {
      success: true,
      data: result,
      message: 'Subscription payment approved and settled atomically.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_APPROVE_PAYMENT';
    return { success: false, error: message };
  }
}

/**
 * Super Admin Action to reject an unverified or fraudulent bank transfer payment.
 */
export async function rejectBankTransferPaymentAdminAction(
  input: AdminRejectPaymentInput
): Promise<ActionResult<{
  paymentId: string;
  businessId: string;
  auditId: string;
}>> {
  try {
    await requireSuperAdmin();

    if (!input.paymentId) {
      return { success: false, error: 'INVALID_INPUT', message: 'Payment ID is required.' };
    }

    if (!input.rejectionReason || !input.rejectionReason.trim()) {
      return { success: false, error: 'REASON_REQUIRED', message: 'Rejection reason is mandatory.' };
    }

    const result = await ManualBankTransferService.rejectPayment({
      paymentId: input.paymentId,
      rejectionReason: input.rejectionReason,
    });

    return {
      success: true,
      data: result,
      message: 'Payment rejected. Tenant notified.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_REJECT_PAYMENT';
    return { success: false, error: message };
  }
}

/**
 * Super Admin Action to fetch full review dossier for a bank transfer payment intent.
 */
export async function getAdminBankTransferReviewDetailsAction(
  paymentId: string
): Promise<ActionResult<AdminBankTransferReviewDetails>> {
  try {
    await requireSuperAdmin();

    const admin = createAdminClient();

    const { data: payment, error: pError } = await admin
      .from('business_subscription_payments')
      .select('*, businesses(name)')
      .eq('id', paymentId)
      .single();

    if (pError || !payment) {
      return { success: false, error: 'PAYMENT_NOT_FOUND', message: 'Payment intent not found.' };
    }

    const { data: proof } = await admin
      .from('business_subscription_proofs')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: claim } = await admin
      .from('business_subscription_payment_reference_claims')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Query active resource counts for the business
    const [branchRes, staffRes] = await Promise.all([
      admin
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', payment.business_id)
        .is('deleted_at', null),
      admin
        .from('business_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', payment.business_id)
        .eq('membership_status', 'active'),
    ]);

    let signedUrl: string | null = null;
    if (proof?.file_path) {
      signedUrl = await ManualBankTransferService.getSignedReceiptUrl(proof.file_path);
    }

    type PaymentWithBusiness = typeof payment & {
      businesses?: { name?: string | null } | null;
    };
    const paymentTyped = payment as PaymentWithBusiness;

    return {
      success: true,
      data: {
        payment: {
          id: payment.id,
          businessId: payment.business_id,
          businessName: paymentTyped.businesses?.name || 'Unknown Business',
          planCode: payment.plan_code,
          billingInterval: payment.billing_interval,
          amountLkr: payment.amount_lkr,
          currency: payment.currency,
          status: payment.status,
          reviewStatus: payment.review_status || 'none',
          paymentMethod: payment.payment_method || 'none',
          pricingSnapshot: payment.pricing_snapshot || {},
          createdAt: payment.created_at,
        },
        proof: proof ? {
          id: proof.id,
          filePath: proof.file_path,
          signedUrl,
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
          conflictMetadata: claim.conflict_metadata || {},
          createdAt: claim.created_at,
        } : undefined,
        resourceAudit: {
          activeBranches: branchRes.count || 0,
          activeStaff: staffRes.count || 0,
        },
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_LOAD_DOSSIER';
    return { success: false, error: message };
  }
}

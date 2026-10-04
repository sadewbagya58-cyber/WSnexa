import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NotificationService } from '@/server/services/notification.service';

export interface SubmitBankTransferProofInput {
  paymentId: string;
  businessId: string;
  rawReference: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  notes?: string;
}

export interface ApproveBankTransferInput {
  paymentId: string;
  expectedPlanId: string;
  expectedAmountLkr: number;
  reconciliationNote: string;
  externalBankStatementRef: string;
}

export interface RejectBankTransferInput {
  paymentId: string;
  rejectionReason: string;
}

export class ManualBankTransferService {
  private static readonly BUCKET_NAME = 'bank-transfer-receipts';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  /**
   * Validates file upload metadata before or during submission.
   */
  static validateProofMetadata(fileSizeBytes: number, mimeType: string, filePath: string, businessId: string, paymentId: string): void {
    if (fileSizeBytes <= 0 || fileSizeBytes > this.MAX_FILE_SIZE) {
      throw new Error(`File size must be between 1 byte and 5 MB. Received: ${fileSizeBytes} bytes.`);
    }

    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type "${mimeType}". Allowed formats: JPEG, PNG, WebP, PDF.`);
    }

    // Verify storage path convention: receipts/{businessId}/{paymentId}/{filename}
    const expectedPrefix = `receipts/${businessId}/${paymentId}/`;
    if (!filePath.startsWith(expectedPrefix)) {
      throw new Error(`Invalid storage path format. Expected path starting with "${expectedPrefix}".`);
    }
  }

  /**
   * Submits bank transfer proof and registers reference claim via atomic SECURITY DEFINER RPC.
   * Includes Tier 2 compensation cleanup: if RPC fails, deletes uploaded storage file immediately.
   */
  static async submitProof(input: SubmitBankTransferProofInput): Promise<{
    success: boolean;
    claimId: string;
    proofId: string;
    claimStatus: string;
    normalizedReference: string;
  }> {
    const { paymentId, businessId, rawReference, filePath, fileSizeBytes, mimeType, notes } = input;

    this.validateProofMetadata(fileSizeBytes, mimeType, filePath, businessId, paymentId);

    const supabase = await createClient();

    try {
      const { data, error } = await supabase.rpc('register_bank_reference_claim', {
        p_payment_id: paymentId,
        p_raw_reference: rawReference.trim(),
        p_file_path: filePath,
        p_file_size_bytes: fileSizeBytes,
        p_mime_type: mimeType,
        p_notes: notes ? notes.trim() : null,
      });

      if (error) {
        throw new Error(error.message);
      }

      const res = data as {
        success: boolean;
        claim_id: string;
        proof_id: string;
        claim_status: string;
        normalized_reference: string;
      };

      return {
        success: res.success,
        claimId: res.claim_id,
        proofId: res.proof_id,
        claimStatus: res.claim_status,
        normalizedReference: res.normalized_reference,
      };
    } catch (err: unknown) {
      // Tier 2 Compensation: Purge uploaded orphan file from storage
      console.warn('[ManualBankTransferService.submitProof] Submission failed. Compensating storage file:', filePath);
      try {
        const admin = createAdminClient();
        await admin.storage.from(this.BUCKET_NAME).remove([filePath]);
      } catch (cleanupErr) {
        console.error('[ManualBankTransferService.submitProof] Failed to clean up storage orphan:', cleanupErr);
      }

      const msg = err instanceof Error ? err.message : 'FAILED_TO_SUBMIT_PROOF';
      throw new Error(msg);
    }
  }

  /**
   * Approves a verified bank transfer payment via atomic SECURITY DEFINER RPC.
   * On success, dispatches an in-app business notification to tenant owners.
   */
  static async approvePayment(input: ApproveBankTransferInput): Promise<{
    success: boolean;
    paymentId: string;
    businessId: string;
    subscriptionId: string;
    planCode: string;
    periodStartsAt: string;
    periodEndsAt: string;
    auditId: string;
    eventId: string;
  }> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('apply_atomic_subscription_settlement', {
      p_payment_id: input.paymentId,
      p_expected_plan_id: input.expectedPlanId,
      p_expected_amount_lkr: input.expectedAmountLkr,
      p_reconciliation_note: input.reconciliationNote.trim(),
      p_external_bank_statement_ref: input.externalBankStatementRef.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    const res = data as {
      success: boolean;
      payment_id: string;
      business_id: string;
      subscription_id: string;
      plan_code: string;
      period_starts_at: string;
      period_ends_at: string;
      audit_id: string;
      event_id: string;
    };

    // Non-blocking in-app notification dispatch to business owners
    try {
      const formattedDate = new Date(res.period_ends_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      await NotificationService.createBusinessNotification({
        businessId: res.business_id,
        notificationType: 'subscription_payment_verified',
        priority: 'high',
        title: 'Subscription Activated ⚡',
        message: `Your bank transfer payment for the ${res.plan_code.toUpperCase()} plan has been verified. Subscription active through ${formattedDate}.`,
        actionUrl: '/dashboard/settings/subscription',
        entityType: 'business_subscription_payments',
        entityId: res.payment_id,
        metadata: {
          paymentId: res.payment_id,
          planCode: res.plan_code,
          periodEndsAt: res.period_ends_at,
        },
      });
    } catch (notifErr) {
      console.warn('[ManualBankTransferService.approvePayment] Notification dispatch failed (non-fatal):', notifErr);
    }

    return {
      success: res.success,
      paymentId: res.payment_id,
      businessId: res.business_id,
      subscriptionId: res.subscription_id,
      planCode: res.plan_code,
      periodStartsAt: res.period_starts_at,
      periodEndsAt: res.period_ends_at,
      auditId: res.audit_id,
      eventId: res.event_id,
    };
  }

  /**
   * Rejects an unverified or fraudulent bank transfer proof via atomic SECURITY DEFINER RPC.
   * On rejection, dispatches an in-app business notification to tenant owners.
   */
  static async rejectPayment(input: RejectBankTransferInput): Promise<{
    success: boolean;
    paymentId: string;
    businessId: string;
    auditId: string;
  }> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('reject_bank_transfer_payment', {
      p_payment_id: input.paymentId,
      p_rejection_reason: input.rejectionReason.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    const res = data as {
      success: boolean;
      payment_id: string;
      business_id: string;
      audit_id: string;
    };

    // Non-blocking in-app notification dispatch to business owners
    try {
      await NotificationService.createBusinessNotification({
        businessId: res.business_id,
        notificationType: 'subscription_payment_rejected',
        priority: 'urgent',
        title: 'Payment Verification Notice ⚠️',
        message: `Your bank transfer proof could not be verified: ${input.rejectionReason.trim()}. Please submit a valid payment receipt or contact support.`,
        actionUrl: '/dashboard/settings/subscription',
        entityType: 'business_subscription_payments',
        entityId: res.payment_id,
        metadata: {
          paymentId: res.payment_id,
          reason: input.rejectionReason,
        },
      });
    } catch (notifErr) {
      console.warn('[ManualBankTransferService.rejectPayment] Notification dispatch failed (non-fatal):', notifErr);
    }

    return {
      success: res.success,
      paymentId: res.payment_id,
      businessId: res.business_id,
      auditId: res.audit_id,
    };
  }

  /**
   * Generates a temporary signed URL to view a private bank transfer proof.
   * Valid for 3600 seconds (1 hour).
   */
  static async getSignedReceiptUrl(filePath: string): Promise<string | null> {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, 3600);

      if (error || !data) {
        console.warn('[ManualBankTransferService.getSignedReceiptUrl] Failed to sign URL:', error?.message);
        return null;
      }

      return data.signedUrl;
    } catch (err) {
      console.warn('[ManualBankTransferService.getSignedReceiptUrl] Error:', err);
      return null;
    }
  }
}

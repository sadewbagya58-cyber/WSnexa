export type SubscriptionPaymentProviderCode = 'onepay' | 'dialog' | 'payhere';

export type PaymentPurpose =
  | 'new_subscription'
  | 'upgrade'
  | 'downgrade'
  | 'renewal'
  | 'reactivation';

export interface CreateCheckoutInput {
  paymentIntentId: string;
  businessId: string;
  planCode: string;
  amountLkr: number;
  currency: 'LKR';
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutResult {
  provider: SubscriptionPaymentProviderCode;
  checkoutId: string;
  redirectUrl: string;
  expiresAt?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface ProviderVerificationResult {
  verified: boolean;
  provider: SubscriptionPaymentProviderCode;
  providerTransactionId: string;
  providerReference?: string;
  paymentStatus: 'paid' | 'failed' | 'cancelled' | 'processing';
  amountLkr: number;
  currency: 'LKR';
  rawStatus?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface SubscriptionPaymentProvider {
  readonly code: SubscriptionPaymentProviderCode;

  /**
   * Initializes a provider checkout session and returns a normalized redirect URL.
   */
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;

  /**
   * Verifies a browser return callback parameters safely server-side.
   */
  verifyReturn(input: Record<string, unknown>): Promise<ProviderVerificationResult>;

  /**
   * Verifies an incoming webhook request body and signature server-side.
   */
  verifyWebhook(
    payload: string | Buffer,
    headers: Record<string, string>
  ): Promise<ProviderVerificationResult>;

  /**
   * Queries provider transaction status directly if supported.
   */
  getPaymentStatus?(providerTransactionId: string): Promise<ProviderVerificationResult>;
}

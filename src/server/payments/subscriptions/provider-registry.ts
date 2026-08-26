import {
  SubscriptionPaymentProvider,
  SubscriptionPaymentProviderCode,
} from './subscription-payment-provider';

export type PaymentErrorCode =
  | 'PROVIDER_UNSUPPORTED'
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'SIGNATURE_VERIFICATION_FAILED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'PAYMENT_CURRENCY_MISMATCH'
  | 'PAYMENT_ALREADY_SETTLED'
  | 'INVALID_PAYMENT_TRANSITION'
  | 'PAYMENT_INTENT_NOT_FOUND'
  | 'PLATFORM_SUSPENDED_SETTLEMENT_BLOCKED';

export class PaymentProviderError extends Error {
  public readonly code: PaymentErrorCode;

  constructor(code: PaymentErrorCode, message: string) {
    super(message);
    this.name = 'PaymentProviderError';
    this.code = code;
  }
}

export interface ProviderAvailabilityConfig {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  hasCredentials: boolean;
}

/**
 * Server-side availability configuration for subscription payment providers.
 * All candidate providers (onepay, dialog, payhere) default to disabled/unconfigured in production.
 */
export const SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG: Record<
  SubscriptionPaymentProviderCode,
  ProviderAvailabilityConfig
> = {
  onepay: { enabled: false, environment: 'sandbox', hasCredentials: false },
  dialog: { enabled: false, environment: 'sandbox', hasCredentials: false },
  payhere: { enabled: false, environment: 'sandbox', hasCredentials: false },
};

const providerAdaptersMap = new Map<SubscriptionPaymentProviderCode, SubscriptionPaymentProvider>();

/**
 * Registers a completed provider adapter instance.
 */
export function registerSubscriptionPaymentProvider(adapter: SubscriptionPaymentProvider): void {
  providerAdaptersMap.set(adapter.code, adapter);
}

/**
 * Resolves a subscription payment provider adapter by code.
 * Rejects unsupported, disabled, or unconfigured providers.
 */
export function getSubscriptionPaymentProvider(
  providerCode: string
): SubscriptionPaymentProvider {
  if (!providerCode || typeof providerCode !== 'string') {
    throw new PaymentProviderError('PROVIDER_UNSUPPORTED', 'Missing or invalid provider code');
  }

  const code = providerCode.toLowerCase() as SubscriptionPaymentProviderCode;

  if (code !== 'onepay' && code !== 'dialog' && code !== 'payhere') {
    throw new PaymentProviderError(
      'PROVIDER_UNSUPPORTED',
      `Subscription payment provider "${providerCode}" is not supported`
    );
  }

  const config = SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG[code];
  if (!config || !config.enabled) {
    throw new PaymentProviderError(
      'PROVIDER_DISABLED',
      `Subscription payment provider "${code}" is currently disabled`
    );
  }

  if (!config.hasCredentials) {
    throw new PaymentProviderError(
      'PROVIDER_NOT_CONFIGURED',
      `Subscription payment provider "${code}" is missing valid merchant credentials`
    );
  }

  const adapter = providerAdaptersMap.get(code);
  if (!adapter) {
    throw new PaymentProviderError(
      'PROVIDER_NOT_CONFIGURED',
      `No active adapter registered for provider "${code}"`
    );
  }

  return adapter;
}

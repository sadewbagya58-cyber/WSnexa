import { SubscriptionPaymentStatus } from '@/server/services/subscription-pricing.service';
import { PaymentProviderError } from './provider-registry';

export const ALLOWED_PAYMENT_TRANSITIONS: Record<
  SubscriptionPaymentStatus,
  SubscriptionPaymentStatus[]
> = {
  pending: ['processing', 'paid', 'failed', 'cancelled', 'expired'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: ['refunded'],
  failed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

/**
 * Checks whether a payment state transition is legal according to canonical lifecycle rules.
 */
export function isLegalPaymentStateTransition(
  fromStatus: string,
  toStatus: string
): boolean {
  const from = (fromStatus || '').toLowerCase() as SubscriptionPaymentStatus;
  const to = (toStatus || '').toLowerCase() as SubscriptionPaymentStatus;

  if (from === to) {
    return true; // Idempotent no-op transition
  }

  const allowedTargets = ALLOWED_PAYMENT_TRANSITIONS[from];
  if (!allowedTargets) {
    return false;
  }

  return allowedTargets.includes(to);
}

/**
 * Asserts that a payment state transition is legal. Throws PaymentProviderError if illegal.
 */
export function assertLegalPaymentStateTransition(
  fromStatus: string,
  toStatus: string
): void {
  const from = (fromStatus || '').toLowerCase();
  const to = (toStatus || '').toLowerCase();

  if (!isLegalPaymentStateTransition(from, to)) {
    throw new PaymentProviderError(
      'INVALID_PAYMENT_TRANSITION',
      `Illegal subscription payment status transition from "${fromStatus}" to "${toStatus}"`
    );
  }
}

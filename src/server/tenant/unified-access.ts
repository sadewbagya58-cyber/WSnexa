export type UnifiedAccessRestrictionReason =
  | 'platform_suspended'
  | 'subscription_suspended'
  | 'subscription_cancelled'
  | null;

export interface UnifiedAccessResult {
  isRestricted: boolean;
  reason: UnifiedAccessRestrictionReason;
  isOperational: boolean;
  businessStatus: string;
  subscriptionEffectiveStatus: string;
}

/**
 * Single canonical effective workspace access resolver.
 * Priority:
 * 1. Platform business status ('suspended' / 'archived') -> platform_suspended
 * 2. Commercial subscription effective status ('SUSPENDED') -> subscription_suspended
 * 3. Commercial subscription effective status ('CANCELLED') -> subscription_cancelled
 * 4. Otherwise -> Operational
 */
export function resolveUnifiedAccessState({
  businessStatus,
  effectiveSubscriptionStatus,
}: {
  businessStatus: string;
  effectiveSubscriptionStatus: string;
}): UnifiedAccessResult {
  const normBusinessStatus = (businessStatus || 'active').toLowerCase();
  const normSubStatus = (effectiveSubscriptionStatus || 'TRIALING').toUpperCase();

  if (normBusinessStatus === 'suspended' || normBusinessStatus === 'archived') {
    return {
      isRestricted: true,
      reason: 'platform_suspended',
      isOperational: false,
      businessStatus: normBusinessStatus,
      subscriptionEffectiveStatus: normSubStatus,
    };
  }

  if (normSubStatus === 'SUSPENDED') {
    return {
      isRestricted: true,
      reason: 'subscription_suspended',
      isOperational: false,
      businessStatus: normBusinessStatus,
      subscriptionEffectiveStatus: normSubStatus,
    };
  }

  if (normSubStatus === 'CANCELLED') {
    return {
      isRestricted: true,
      reason: 'subscription_cancelled',
      isOperational: false,
      businessStatus: normBusinessStatus,
      subscriptionEffectiveStatus: normSubStatus,
    };
  }

  return {
    isRestricted: false,
    reason: null,
    isOperational: true,
    businessStatus: normBusinessStatus,
    subscriptionEffectiveStatus: normSubStatus,
  };
}

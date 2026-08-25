import { SubscriptionService } from './subscription.service';

export interface BranchQuotaStatus {
  allowed: boolean;
  currentBranchCount: number;
  maxBranchLimit: number;
  subscriptionTier: string;
}

/**
 * Subscription-ready branch quota validator.
 * Delegates limit enforcement to SubscriptionService while preserving signature compatibility.
 */
export async function checkBranchQuota(businessId: string): Promise<BranchQuotaStatus> {
  const result = await SubscriptionService.validateLimit(businessId, 'branches');

  return {
    allowed: result.allowed,
    currentBranchCount: result.currentUsage,
    maxBranchLimit: result.effectiveLimit !== null ? result.effectiveLimit : 999999,
    subscriptionTier: result.planCode,
  };
}

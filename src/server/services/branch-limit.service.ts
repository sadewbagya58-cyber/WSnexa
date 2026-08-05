import { createClient } from '@/lib/supabase/server';

export interface BranchQuotaStatus {
  allowed: boolean;
  currentBranchCount: number;
  maxBranchLimit: number;
  subscriptionTier: string;
}

/**
 * Subscription-ready branch quota validator.
 * Enforces tier limits: free (1), starter (3), pro (unlimited).
 */
export async function checkBranchQuota(businessId: string): Promise<BranchQuotaStatus> {
  const supabase = await createClient();

  // Fetch active (non-deleted) branch count
  const { count } = await supabase
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .is('deleted_at', null);

  const currentBranchCount = count || 0;

  // Default tier for MVP: 'starter' (3 branches limit) or 'pro' if needed
  const subscriptionTier = process.env.NEXT_PUBLIC_DEFAULT_SUBSCRIPTION_TIER || 'starter';

  let maxBranchLimit = 3;
  if (subscriptionTier === 'free') {
    maxBranchLimit = 1;
  } else if (subscriptionTier === 'pro') {
    maxBranchLimit = 999999; // Unlimited
  }

  const allowed = currentBranchCount < maxBranchLimit;

  return {
    allowed,
    currentBranchCount,
    maxBranchLimit,
    subscriptionTier,
  };
}

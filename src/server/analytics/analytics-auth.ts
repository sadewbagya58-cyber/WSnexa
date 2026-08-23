import { resolveAuthorizationContext, can } from '@/server/auth';
import { AuthorizationContext } from '@/types/authorization.types';
import { AnalyticsError } from '@/lib/analytics/analytics-types';

export interface AnalyticsAuthResult {
  authContext: AuthorizationContext;
  businessId: string;
  targetBranchIds: string[];
  isMultiBranchAuthorized: boolean;
  currency: string;
}

/**
 * Server-only authorization guard for analytics execution.
 * Resolves AuthorizationContext, checks `reports.view` / `reports.financial.view`,
 * and intersects requested branch IDs against authorized property scope reach.
 */
export async function requireAnalyticsAccess(
  inputBranchId?: string | null,
  inputBranchIds?: string[] | null
): Promise<AnalyticsAuthResult> {
  let authContext: AuthorizationContext | null = null;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    throw new AnalyticsError('ANALYTICS_FORBIDDEN', 'Authentication required for analytics data.');
  }

  if (!authContext || !authContext.businessId) {
    throw new AnalyticsError('ANALYTICS_FORBIDDEN', 'Active business context required for analytics.');
  }

  // 1. Determine target branch candidates
  let requestedBranches: string[] = [];
  if (inputBranchIds && inputBranchIds.length > 0) {
    requestedBranches = inputBranchIds;
  } else if (inputBranchId) {
    requestedBranches = [inputBranchId];
  } else if (authContext.activeBranchId) {
    requestedBranches = [authContext.activeBranchId];
  }

  // If no branch specified, fallback to all authorized branches for member
  if (requestedBranches.length === 0) {
    requestedBranches = authContext.authorizedBranchIds;
  }

  if (requestedBranches.length === 0) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No authorized branch scope available for analytics.');
  }

  // 2. Authorize each branch against Policy Engine
  const authorizedTargetBranches: string[] = [];
  for (const bId of requestedBranches) {
    // Member must have authorized branch scope reach
    if (!authContext.isBusinessOwner && !authContext.authorizedBranchIds.includes(bId)) {
      continue;
    }

    const branchResource = { type: 'branch' as const, id: bId };
    const canView =
      (await can({ context: authContext, permission: 'reports.view', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'reports.financial.view', resource: branchResource }));

    if (canView) {
      authorizedTargetBranches.push(bId);
    }
  }

  if (authorizedTargetBranches.length === 0) {
    throw new AnalyticsError('ANALYTICS_FORBIDDEN', 'Forbidden. Reporting permissions (reports.view) required.');
  }

  // 3. Multi-branch authorization check
  const isMultiBranchAuthorized =
    authContext.isBusinessOwner ||
    (await can({ context: authContext, permission: 'reports.view' }));

  return {
    authContext,
    businessId: authContext.businessId,
    targetBranchIds: authorizedTargetBranches,
    isMultiBranchAuthorized,
    currency: 'LKR', // Default business currency fallback
  };
}

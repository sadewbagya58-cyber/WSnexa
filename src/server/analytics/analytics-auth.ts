import { resolveAuthorizationContext } from '@/server/auth';
import { can } from '@/server/auth/policy-engine';
import { AuthorizationContext } from '@/types/authorization.types';
import { AnalyticsError } from '@/lib/analytics/analytics-types';
import { createAdminClient } from '@/lib/supabase/server';


export interface AnalyticsAuthResult {
  authContext: AuthorizationContext;
  businessId: string;
  targetBranchIds: string[];
  authorizedBranchDetails: { id: string; name: string }[];
  isMultiBranchAuthorized: boolean;
  hasFinancialAccess: boolean;
  currency: string;
}

/**
 * Validates and enforces server-side authorization for Analytics Service queries.
 *
 * Checks:
 * 1. Active business membership & authentication
 * 2. 'reports.view' permission check via Policy Engine
 * 3. 'reports.financial.view' permission check for financial metrics
 * 4. Business tenant isolation (businessId)
 * 5. Branch scoping against authContext.authorizedBranchIds
 */
export async function requireAnalyticsAccess(
  requestedBranchId?: string | null,
  requestedBranchIds?: string[] | null
): Promise<AnalyticsAuthResult> {
  // 1. Resolve full authorization context
  const authContext = await resolveAuthorizationContext();

  if (!authContext || !authContext.businessId) {
    throw new AnalyticsError('ANALYTICS_FORBIDDEN', 'Active business membership is required to access analytics.');
  }

  // 2. Permission check: reports.view required
  const canViewReports =
    authContext.isBusinessOwner ||
    (await can({ context: authContext, permission: 'reports.view' }));

  if (!canViewReports) {
    throw new AnalyticsError(
      'ANALYTICS_FORBIDDEN',
      'Permission denied: reports.view permission is required to access analytics.'
    );
  }

  // 3. Resolve target branches against user reach
  let authorizedTargetBranches: string[] = [];

  if (requestedBranchId && requestedBranchId !== 'all') {
    // Check single branch request
    if (!authContext.authorizedBranchIds.includes(requestedBranchId)) {
      throw new AnalyticsError(
        'OUTSIDE_SCOPE',
        `Target branch ${requestedBranchId} is outside your authorized scope.`
      );
    }
    authorizedTargetBranches = [requestedBranchId];
  } else if (requestedBranchIds && requestedBranchIds.length > 0) {
    // Intersect requested branch array with authorized branches
    authorizedTargetBranches = requestedBranchIds.filter((bId) =>
      authContext.authorizedBranchIds.includes(bId)
    );
    if (authorizedTargetBranches.length === 0) {
      throw new AnalyticsError(
        'OUTSIDE_SCOPE',
        'None of the requested target branches are within your authorized scope.'
      );
    }
  } else {
    // Default to all authorized branches for user
    authorizedTargetBranches = [...authContext.authorizedBranchIds];
  }

  if (authorizedTargetBranches.length === 0) {
    throw new AnalyticsError('OUTSIDE_SCOPE', 'No authorized branches available for analytics.');
  }

  // 4. Financial metric permission check
  const hasFinancialAccess =
    authContext.isBusinessOwner ||
    (await can({ context: authContext, permission: 'reports.financial.view' }));

  // 5. Multi-branch authorization check
  const isMultiBranchAuthorized =
    authContext.isBusinessOwner ||
    (await can({ context: authContext, permission: 'reports.view' }));

  // Build branch details for UI filters using authContext.branchAssignments
  const authorizedBranchDetails = (authContext.branchAssignments || [])
    .filter((b) => authContext.authorizedBranchIds.includes(b.branchId))
    .map((b) => ({ id: b.branchId, name: b.branchName }));

  // 6. Fetch canonical business currency
  const admin = createAdminClient();
  const { data: biz } = await admin
    .from('businesses')
    .select('default_currency')
    .eq('id', authContext.businessId)
    .maybeSingle();

  const currency = (biz?.default_currency || 'USD').toUpperCase();

  return {
    authContext,
    businessId: authContext.businessId,
    targetBranchIds: authorizedTargetBranches,
    authorizedBranchDetails,
    isMultiBranchAuthorized,
    hasFinancialAccess,
    currency,
  };
}


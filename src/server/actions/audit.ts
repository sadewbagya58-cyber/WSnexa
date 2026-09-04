'use server';

import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';
import { AuditService, GetAuditLogsParams } from '@/server/services/audit.service';

export async function getAuditLogsAction(params: Omit<GetAuditLogsParams, 'businessId'>) {
  try {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.business) {
      return { success: false, message: 'Unauthorized.', logs: [], total: 0 };
    }

    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      return { success: false, message: 'Unauthorized.', logs: [], total: 0 };
    }

    // Security Check: audit.view or roles.view or business_owner
    const isOwner = authContext.isBusinessOwner;
    const canViewAudit =
      isOwner ||
      (await can({
        context: authContext,
        permission: 'audit.view',
      })) ||
      (await can({
        context: authContext,
        permission: 'roles.view',
      })) ||
      (await can({
        context: authContext,
        permission: 'organization.view',
      }));

    if (!canViewAudit) {
      return { success: false, message: 'Forbidden: Insufficient permissions to view audit logs.', logs: [], total: 0 };
    }

    // Branch isolation: If user is branch-scoped and not business owner, restrict query to authorized branches
    let allowedBranchIds: string[] | null = null;
    if (!isOwner) {
      const userAssignedBranches = authContext.authorizedBranchIds || [];
      if (userAssignedBranches.length > 0) {
        allowedBranchIds = userAssignedBranches;
      }
    }

    // If a specific branchId was requested, ensure the user is authorized for it
    if (params.branchId && allowedBranchIds && !allowedBranchIds.includes(params.branchId)) {
      return { success: false, message: 'Forbidden: Branch access denied.', logs: [], total: 0 };
    }

    const result = await AuditService.getAuditLogs({
      ...params,
      businessId: tenantContext.business.id,
      branchIds: params.branchId ? undefined : (allowedBranchIds || undefined),
    });

    return {
      success: true,
      ...result,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve audit logs.';
    console.error('[getAuditLogsAction] Error:', err);
    return { success: false, message: msg, logs: [], total: 0 };
  }
}

export async function getEntityTimelineAction(entityType: string, entityId: string) {
  try {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.business) {
      return { success: false, message: 'Unauthorized.', timeline: [] };
    }

    const timeline = await AuditService.getEntityTimeline(tenantContext.business.id, entityType, entityId);
    return { success: true, timeline };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve entity timeline.';
    console.error('[getEntityTimelineAction] Error:', err);
    return { success: false, message: msg, timeline: [] };
  }
}

'use server';

import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';
import { WaiterActivityService } from '@/server/services/waiter-activity.service';

export async function getWaiterOperationalActivityAction(
  optionsOrBranchId?: string | { branchId?: string; assignedAreaIds?: string[] | null; hours?: number }
) {
  try {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.business) {
      return { success: false, message: 'Unauthorized.', events: [] };
    }

    const branchId =
      typeof optionsOrBranchId === 'string'
        ? optionsOrBranchId
        : optionsOrBranchId?.branchId || tenantContext.activeBranch?.id;

    if (!branchId) {
      return { success: false, message: 'No active branch selected.', events: [] };
    }

    const authContext = await resolveAuthorizationContext();
    if (!authContext) {
      return { success: false, message: 'Unauthorized.', events: [] };
    }

    // Security check: waiter.access or waiter.requests.view or orders.view or business_owner
    const isOwner = authContext.isBusinessOwner;
    const canViewWaiter =
      isOwner ||
      (await can({
        context: authContext,
        permission: 'waiter.requests.view',
      })) ||
      (await can({
        context: authContext,
        permission: 'waiter.access',
      })) ||
      (await can({
        context: authContext,
        permission: 'orders.view',
      }));

    if (!canViewWaiter) {
      return { success: false, message: 'Forbidden: Insufficient waiter permissions.', events: [] };
    }

    // Service area isolation for non-property-level staff
    let assignedAreaIds: string[] | null = null;
    if (typeof optionsOrBranchId === 'object' && optionsOrBranchId?.assignedAreaIds !== undefined) {
      assignedAreaIds = optionsOrBranchId.assignedAreaIds;
    } else {
      const isPropertyLevel =
        isOwner ||
        tenantContext.membership?.role === 'branch_manager' ||
        tenantContext.membership?.role === 'admin';

      if (!isPropertyLevel && tenantContext.membership?.id) {
        const { ServiceAreaService } = await import('@/server/services/service-area.service');
        assignedAreaIds = await ServiceAreaService.getStaffAssignedAreaIds(tenantContext.membership.id);
      }
    }

    const events = await WaiterActivityService.get48HourOperationalActivity(
      branchId,
      assignedAreaIds,
      tenantContext.business.id
    );

    return { success: true, events };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve waiter activity.';
    console.error('[getWaiterOperationalActivityAction] Error:', err);
    return { success: false, message: msg, events: [] };
  }
}

export async function getWaiterRequestTimelineAction(requestId: string, branchIdInput?: string) {
  try {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.business) {
      return { success: false, message: 'Unauthorized.', steps: [] };
    }

    const branchId = branchIdInput || tenantContext.activeBranch?.id;
    if (!branchId) {
      return { success: false, message: 'No active branch selected.', steps: [] };
    }

    const steps = await WaiterActivityService.getRequestTimeline(requestId, branchId);
    return { success: true, steps };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve request timeline.';
    console.error('[getWaiterRequestTimelineAction] Error:', err);
    return { success: false, message: msg, steps: [] };
  }
}

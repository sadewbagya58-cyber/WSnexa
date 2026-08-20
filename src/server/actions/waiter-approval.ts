'use server';

import { WaiterService } from '@/server/services/waiter.service';
import { can, resolveAuthorizationContext } from '@/server/auth';

export async function getPendingApprovalsAction(branchId: string, _waiterUserId?: string) {
  void _waiterUserId;
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canView =
      (await can({ context: authContext, permission: 'waiter.requests.view', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'waiter.access', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'orders.view', resource: branchResource }));

    if (!canView) {
      return { success: false, message: 'Forbidden: Missing waiter queue viewing permission.' };
    }

    // Always use authoritative session user id
    const orders = await WaiterService.getPendingApprovalsForWaiter(branchId, authContext.userId);
    return { success: true, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch pending approvals.';
    return { success: false, message: msg };
  }
}

export async function approveGuestOrderAction(orderId: string, _waiterUserId?: string) {
  void _waiterUserId;
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const orderResource = { type: 'order' as const, id: orderId };
    const canManage =
      (await can({ context: authContext, permission: 'waiter.requests.manage', resource: orderResource })) ||
      (await can({ context: authContext, permission: 'waiter.access', resource: orderResource })) ||
      (await can({ context: authContext, permission: 'orders.update_status', resource: orderResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing waiter request management permission.' };
    }

    // Always use authoritative session user id
    const res = await WaiterService.approveGuestOrder(orderId, authContext.userId);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve order.';
    return { success: false, message: msg };
  }
}

export async function rejectGuestOrderAction(orderId: string, _waiterUserId?: string, reason?: string) {
  void _waiterUserId;
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const orderResource = { type: 'order' as const, id: orderId };
    const canManage =
      (await can({ context: authContext, permission: 'waiter.requests.manage', resource: orderResource })) ||
      (await can({ context: authContext, permission: 'waiter.access', resource: orderResource })) ||
      (await can({ context: authContext, permission: 'orders.cancel', resource: orderResource })) ||
      (await can({ context: authContext, permission: 'orders.update_status', resource: orderResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing waiter request rejection permission.' };
    }

    // Always use authoritative session user id
    const res = await WaiterService.rejectGuestOrder(orderId, authContext.userId, reason);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reject order.';
    return { success: false, message: msg };
  }
}

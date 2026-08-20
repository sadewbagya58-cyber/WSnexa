'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { WaiterService } from '@/server/services/waiter.service';
import { PermissionService } from '@/server/services/permission.service';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export async function getPendingApprovalsAction(branchId: string, _waiterUserId?: string) {
  void _waiterUserId;
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branch = context.branches.find((b) => b.id === branchId);
    if (!branch && context.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canView =
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'waiter.requests.view')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'waiter.access')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'orders.view'));

    if (!canView) {
      return { success: false, message: 'Forbidden: Missing waiter queue viewing permission.' };
    }

    // Always use authoritative session user id
    const orders = await WaiterService.getPendingApprovalsForWaiter(branchId, context.user.id);
    return { success: true, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch pending approvals.';
    return { success: false, message: msg };
  }
}

export async function approveGuestOrderAction(orderId: string, _waiterUserId?: string) {
  void _waiterUserId;
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id')
      .eq('id', orderId)
      .single();

    if (!order || order.business_id !== context.business.id) {
      return { success: false, message: 'Order not found in active business.' };
    }

    const canManage =
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'waiter.requests.manage')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'waiter.access')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'orders.update_status'));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing waiter request management permission.' };
    }

    // Always use authoritative session user id
    const res = await WaiterService.approveGuestOrder(orderId, context.user.id);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve order.';
    return { success: false, message: msg };
  }
}

export async function rejectGuestOrderAction(orderId: string, _waiterUserId?: string, reason?: string) {
  void _waiterUserId;
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id')
      .eq('id', orderId)
      .single();

    if (!order || order.business_id !== context.business.id) {
      return { success: false, message: 'Order not found in active business.' };
    }

    const canManage =
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'waiter.requests.manage')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'waiter.access')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'orders.cancel')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, order.branch_id, 'orders.update_status'));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing waiter request rejection permission.' };
    }

    // Always use authoritative session user id
    const res = await WaiterService.rejectGuestOrder(orderId, context.user.id, reason);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reject order.';
    return { success: false, message: msg };
  }
}

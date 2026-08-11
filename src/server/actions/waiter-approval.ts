'use server';

import { WaiterService } from '@/server/services/waiter.service';

export async function getPendingApprovalsAction(branchId: string, waiterUserId: string) {
  try {
    const orders = await WaiterService.getPendingApprovalsForWaiter(branchId, waiterUserId);
    return { success: true, orders };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch pending approvals.';
    return { success: false, message: msg };
  }
}

export async function approveGuestOrderAction(orderId: string, waiterUserId: string) {
  try {
    const res = await WaiterService.approveGuestOrder(orderId, waiterUserId);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve order.';
    return { success: false, message: msg };
  }
}

export async function rejectGuestOrderAction(orderId: string, waiterUserId: string, reason?: string) {
  try {
    const res = await WaiterService.rejectGuestOrder(orderId, waiterUserId, reason);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reject order.';
    return { success: false, message: msg };
  }
}

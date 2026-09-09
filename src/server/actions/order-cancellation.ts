'use server';

import { createClient } from '@/lib/supabase/server';
import {
  CancellationService,
  CancelOrderParams,
  CancelOrderItemParams,
  CancellationChannel,
  InventoryDisposition,
  CustomerPolicyEvaluation,
} from '@/server/services/cancellation.service';
import { ActionResponse } from './auth';

/**
 * Server action to evaluate customer cancellation eligibility without performing a mutation.
 */
export async function evaluateCustomerCancellationAction(
  orderId: string,
  guestAccessToken?: string | null
): Promise<ActionResponse<CustomerPolicyEvaluation>> {
  try {
    let customerUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      customerUserId = user?.id || null;
    } catch {
      // Unauthenticated / guest session
    }

    const evalResult = await CancellationService.evaluateCustomerCancellationPolicy(
      orderId,
      guestAccessToken,
      customerUserId
    );

    return {
      success: evalResult.canCancel,
      message: evalResult.reason || (evalResult.canCancel ? 'Cancellation is permitted.' : 'Cancellation is not permitted.'),
      data: evalResult,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to evaluate cancellation eligibility.';
    return { success: false, message };
  }
}

/**
 * Server action for customers to cancel their own order (Guest QR or Logged-in Customer).
 */
export async function cancelOrderAsCustomerAction(input: {
  orderId: string;
  reasonCategory: string;
  reasonNotes?: string;
  guestAccessToken?: string | null;
}): Promise<ActionResponse> {
  try {
    let customerUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      customerUserId = user?.id || null;
    } catch {
      // Guest
    }

    const res = await CancellationService.cancelOrder({
      orderId: input.orderId,
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: input.reasonCategory,
      reasonNotes: input.reasonNotes,
      guestAccessToken: input.guestAccessToken,
      customerUserId,
      actorUserId: customerUserId,
    });

    return {
      success: res.success,
      message: res.message,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Order cancellation failed.';
    return { success: false, message };
  }
}

/**
 * Server action for operational staff (Waiter, Kitchen, Cashier, Manager) to cancel an order.
 */
export async function cancelOrderAsStaffAction(input: {
  orderId: string;
  channel: CancellationChannel;
  reasonCategory: string;
  reasonNotes?: string;
  inventoryDisposition: InventoryDisposition;
}): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const res = await CancellationService.cancelOrder({
      orderId: input.orderId,
      channel: input.channel,
      requestedByType: 'staff',
      reasonCategory: input.reasonCategory,
      reasonNotes: input.reasonNotes,
      inventoryDisposition: input.inventoryDisposition,
      actorUserId: user.id,
    });

    return {
      success: res.success,
      message: res.message,
      data: res.data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Staff order cancellation failed.';
    return { success: false, message };
  }
}

/**
 * Server action for operational staff to cancel/adjust a specific order line item.
 */
export async function cancelOrderItemAsStaffAction(input: {
  orderId: string;
  orderItemId: string;
  cancelledQuantity: number;
  channel: CancellationChannel;
  reasonCategory: string;
  reasonNotes?: string;
  inventoryDisposition: InventoryDisposition;
}): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const res = await CancellationService.cancelOrderItem({
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      cancelledQuantity: input.cancelledQuantity,
      channel: input.channel,
      actorUserId: user.id,
      reasonCategory: input.reasonCategory,
      reasonNotes: input.reasonNotes,
      inventoryDisposition: input.inventoryDisposition,
    });

    return {
      success: res.success,
      message: res.message,
      data: res.data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Item cancellation failed.';
    return { success: false, message };
  }
}

/**
 * Server action to request manager approval for order cancellation (e.g. from Kitchen/Waiter after prep).
 */
export async function requestCancellationApprovalAction(input: {
  orderId: string;
  channel: CancellationChannel;
  reasonCategory: string;
  reasonNotes?: string;
}): Promise<ActionResponse<{ requestId?: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const res = await CancellationService.requestCancellationApproval({
      orderId: input.orderId,
      channel: input.channel,
      requestedByUserId: user.id,
      reasonCategory: input.reasonCategory,
      reasonNotes: input.reasonNotes,
    });

    return {
      success: res.success,
      message: res.message,
      data: { requestId: res.requestId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to request cancellation approval.';
    return { success: false, message };
  }
}

/**
 * Server action for managers to resolve pending cancellation requests.
 */
export async function resolveCancellationApprovalAction(input: {
  requestId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
  inventoryDisposition?: InventoryDisposition;
}): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const res = await CancellationService.resolveCancellationApproval(
      input.requestId,
      input.decision,
      user.id,
      input.notes,
      input.inventoryDisposition || 'record_waste'
    );

    return {
      success: res.success,
      message: res.message,
      data: res.data,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve cancellation approval.';
    return { success: false, message };
  }
}

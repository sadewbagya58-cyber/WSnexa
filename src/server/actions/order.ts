'use server';

import { revalidatePath } from 'next/cache';
import { OrderService } from '@/server/services/order.service';
import { CreateGuestOrderInput, OrderStatus } from '@/lib/validation/order';
import { ActionResponse } from './auth';

/**
 * Guest Public Order Submission Server Action.
 */
export async function submitGuestOrderAction(
  input: CreateGuestOrderInput
): Promise<ActionResponse<{ orderId: string; accessToken: string; orderNumberFormatted: string; status: OrderStatus }>> {
  let activeUserId: string | null = null;
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    activeUserId = user?.id || null;
  } catch (err) {
    console.warn('[submitGuestOrderAction] User resolution skipped:', err);
  }

  console.log('[submitGuestOrderAction Safe Trace]:', {
    selectedRewardInCart: Boolean(input.selectedRewardId),
    selectedRewardSubmitted: Boolean(input.selectedRewardId),
    selectedRewardReceivedByAction: Boolean(input.selectedRewardId),
    authenticatedUserPresent: Boolean(activeUserId),
    cartItemsCount: input.cartItems?.length || 0,
    idempotencyKeyPrefix: input.idempotencyKey ? input.idempotencyKey.substring(0, 10) : null,
  });

  const result = await OrderService.createGuestOrder(input, activeUserId);

  console.log('[submitGuestOrderAction] Outcome:', {
    success: result.success,
    message: result.message,
    orderId: result.data?.orderId,
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      message: result.message || 'Order submission failed.',
    };
  }

  // Server-side optional auto-link for authenticated customers placing guest orders
  if (activeUserId && result.data.orderId && result.data.accessToken) {
    try {
      const { CustomerOrderService } = await import('@/server/services/customer-order.service');
      await CustomerOrderService.claimOrder(activeUserId, result.data.orderId, result.data.accessToken);
    } catch (err) {
      console.warn('[submitGuestOrderAction] Optional auto-link skipped:', err);
    }
  }

  revalidatePath(`/m/${input.rawQrToken}/checkout`);
  return {
    success: true,
    message: 'Order placed successfully!',
    data: {
      orderId: result.data.orderId,
      accessToken: result.data.accessToken,
      orderNumberFormatted: result.data.orderNumberFormatted,
      status: result.data.status,
    },
  };
}

/**
 * Staff Kitchen / Order Queue Status Update Server Action.
 */
export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  notes?: string
): Promise<ActionResponse> {
  const result = await OrderService.updateOrderStatus(orderId, status, notes);

  if (!result.success) {
    return {
      success: false,
      message: result.message || 'Failed to update order status.',
    };
  }

  revalidatePath('/dashboard/kitchen');
  return {
    success: true,
    message: result.message || `Order status updated to ${status}.`,
  };
}

/**
 * Public Safe Order Tracking & Payment State Action.
 * Token-authenticated query for guest tracker polling and live state reconciliation.
 */
export async function getPublicOrderTrackingStateAction(
  orderId: string,
  accessToken: string
): Promise<
  ActionResponse<{
    id: string;
    order_number_formatted: string;
    order_number: number;
    status: OrderStatus;
    payment_status: string;
    payment_method: string;
    total_cents: number;
    subtotal_cents: number;
    discount_cents: number;
    tax_cents: number;
    service_charge_cents: number;
    amount_paid_cents: number;
    balance_due_cents: number;
    reward_title_snapshot: string | null;
    reward_points_redeemed_snapshot: number;
    currency: string;
    updated_at: string;
    approval_status?: string;
    approved_at?: string | null;
    rejected_at?: string | null;
    rejection_reason?: string | null;
    customer_user_id: string | null;
    table?: { id: string; name: string } | null;
  }>
> {
  if (!orderId || !accessToken) {
    return { success: false, message: 'Order ID and access token are required.' };
  }

  const order = await OrderService.getOrderById(orderId, accessToken);
  if (!order) {
    return { success: false, message: 'Order not found or invalid security access token.' };
  }

  const { createAdminClient } = await import('@/lib/supabase/server');
  const admin = createAdminClient();

  const { data: rawPayments } = await admin
    .from('payments')
    .select('amount_cents, payment_status')
    .eq('order_id', orderId);

  const completedPayments = (rawPayments || []).filter((p) => p.payment_status === 'completed');
  const amountPaidCents = completedPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
  const balanceDueCents = Math.max(0, order.total_cents - amountPaidCents);

  let paymentStatus = order.payment_status;
  if (amountPaidCents >= order.total_cents && order.total_cents > 0) {
    paymentStatus = 'paid';
  } else if (amountPaidCents > 0) {
    paymentStatus = 'partially_paid';
  }

  return {
    success: true,
    data: {
      id: order.id,
      order_number_formatted: order.order_number_formatted,
      order_number: order.order_number,
      status: order.status,
      payment_status: paymentStatus,
      payment_method: order.payment_method,
      total_cents: order.total_cents,
      subtotal_cents: order.subtotal_cents,
      discount_cents: order.discount_cents || 0,
      tax_cents: order.tax_cents,
      service_charge_cents: order.service_charge_cents,
      amount_paid_cents: amountPaidCents,
      balance_due_cents: balanceDueCents,
      reward_title_snapshot: order.reward_title_snapshot || null,
      reward_points_redeemed_snapshot: order.reward_points_redeemed_snapshot || 0,
      currency: order.currency,
      updated_at: order.updated_at,
      approval_status: (order as { approval_status?: string }).approval_status || 'approved',
      approved_at: (order as { approved_at?: string | null }).approved_at || null,
      rejected_at: (order as { rejected_at?: string | null }).rejected_at || null,
      rejection_reason: (order as { rejection_reason?: string | null }).rejection_reason || null,
      customer_user_id: (order as { customer_user_id?: string | null }).customer_user_id || null,
      table: order.table ? { id: order.table.id, name: order.table.name } : null,
    },
  };
}

/**
 * Generates a short-lived server-signed location verification proof token.
 */
export async function generateLocationProofAction(
  branchId: string,
  latitude: number,
  longitude: number,
  tableId?: string | null
): Promise<ActionResponse<{ proof: string }>> {
  try {
    const { OrderSecurityService } = await import('@/server/services/order-security.service');
    const locCheck = await OrderSecurityService.verifyLocation(branchId, latitude, longitude);
    if (!locCheck.verified) {
      return {
        success: false,
        message: locCheck.reason || 'Device location is outside the venue ordering radius.',
      };
    }
    const proof = OrderSecurityService.createLocationProof(branchId, latitude, longitude, tableId);
    return {
      success: true,
      data: { proof },
    };
  } catch (err) {
    return {
      success: false,
      message: (err as Error).message || 'Failed to verify location.',
    };
  }
}


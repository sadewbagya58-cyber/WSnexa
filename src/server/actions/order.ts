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
  console.log('[submitGuestOrderAction] Received order submission request:', {
    rawQrTokenPrefix: input.rawQrToken ? input.rawQrToken.substring(0, 10) : null,
    tableId: input.tableId,
    signedTableAccessProofExists: Boolean(input.signedTableAccessProof),
    inputPinExists: Boolean(input.inputPin && input.inputPin.trim().length > 0),
    cartItemsCount: input.cartItems?.length || 0,
    idempotencyKey: input.idempotencyKey,
  });

  const result = await OrderService.createGuestOrder(input);

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
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const { CustomerOrderService } = await import('@/server/services/customer-order.service');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && result.data.orderId && result.data.accessToken) {
      await CustomerOrderService.claimOrder(user.id, result.data.orderId, result.data.accessToken);
    }
  } catch (err) {
    console.warn('[submitGuestOrderAction] Optional auto-link skipped:', err);
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

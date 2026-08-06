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
  const result = await OrderService.createGuestOrder(input);

  if (!result.success || !result.data) {
    return {
      success: false,
      message: result.message || 'Order submission failed.',
    };
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

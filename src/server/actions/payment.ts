'use server';

import { revalidatePath } from 'next/cache';
import { PaymentService, ReceiptData } from '@/server/services/payment.service';
import { RecordPaymentInput, VoidPaymentInput } from '@/lib/validation/payment';
import { ActionResponse } from './auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Records payment settlement for an active branch order.
 */
export async function recordOrderPaymentAction(
  input: RecordPaymentInput
): Promise<ActionResponse<{ paymentId: string; paidCents: number; balanceDueCents: number; paymentStatus: string }>> {
  const result = await PaymentService.recordPayment(input);
  if (result.success) {
    revalidatePath('/dashboard/cashier');
    revalidatePath('/dashboard/kitchen');
  }
  return result;
}

/**
 * Voids a payment transaction record (Manager / Owner authorization required).
 */
export async function voidOrderPaymentAction(
  input: VoidPaymentInput
): Promise<ActionResponse<undefined>> {
  const result = await PaymentService.voidPayment(input);
  if (result.success) {
    revalidatePath('/dashboard/cashier');
  }
  return result;
}

/**
 * Resolves receipt data for printable preview or modal.
 */
export async function getOrderReceiptAction(
  orderId: string
): Promise<ActionResponse<ReceiptData>> {
  const data = await PaymentService.getOrderReceiptData(orderId);
  if (!data) {
    return { success: false, message: 'Order or receipt data not found.' };
  }
  return { success: true, message: 'Receipt data resolved.', data };
}

/**
 * Acknowledges / resolves a guest "Need Bill" waiter request from Cashier POS.
 */
export async function acknowledgeBillRequestAction(
  requestId: string
): Promise<ActionResponse<undefined>> {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active branch context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canAcknowledge =
    (await can({ context: authContext, permission: 'waiter.requests.manage', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'cashier.access', resource: branchResource }));

  if (!canAcknowledge) {
    return { success: false, message: 'Forbidden: Missing permission to acknowledge bill requests.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('waiter_requests')
    .update({
      status: 'completed',
      resolved_at: new Date().toISOString(),
      resolved_by: authContext.userId,
    })
    .eq('id', requestId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/dashboard/cashier');
  return { success: true, message: 'Bill request acknowledged.' };
}

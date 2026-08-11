'use server';

import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { ConfiguredPaymentMethodType } from '@/types/database.types';

export async function getBranchPaymentMethodsAction(branchId: string) {
  try {
    const methods = await BranchPaymentService.getBranchPaymentMethods(branchId);
    return { success: true, methods };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch payment methods.';
    return { success: false, message: msg };
  }
}

export async function updateBranchPaymentMethodAction(
  branchId: string,
  method: ConfiguredPaymentMethodType,
  updates: {
    is_enabled?: boolean;
    display_name?: string;
    instructions?: string;
    sort_order?: number;
  }
) {
  try {
    const res = await BranchPaymentService.updateBranchPaymentMethod(branchId, method, updates);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update payment method.';
    return { success: false, message: msg };
  }
}

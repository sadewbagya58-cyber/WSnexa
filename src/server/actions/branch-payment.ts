'use server';

import { revalidatePath } from 'next/cache';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { ConfiguredPaymentMethodType } from '@/types/database.types';

export async function getBranchPaymentMethodsAction(branchId: string) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canView =
      (await can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'branches.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'cashier.access', resource: branchResource }));

    if (!canView) {
      return { success: false, message: 'Forbidden: Missing permission to view payment methods.' };
    }

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
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canManage =
      (await can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'branches.manage', resource: branchResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing permission to configure branch payment methods.' };
    }

    const res = await BranchPaymentService.updateBranchPaymentMethod(branchId, method, updates);
    if (res.success) {
      revalidatePath('/dashboard/settings/payments');
    }
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update payment method.';
    return { success: false, message: msg };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { BranchPaymentService } from '@/server/services/branch-payment.service';
import { PermissionService } from '@/server/services/permission.service';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
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
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branch = context.branches.find((b) => b.id === branchId);
    if (!branch && context.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canManage =
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'branches.operational.manage')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'branches.manage'));

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

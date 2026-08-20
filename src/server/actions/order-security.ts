'use server';

import { revalidatePath } from 'next/cache';
import { OrderSecurityService } from '@/server/services/order-security.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { SecurityPresetLevel, BranchOrderSecuritySettings } from '@/types/database.types';

export async function getBranchOrderSecuritySettingsAction(branchId: string) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canView =
      (await can({ context: authContext, permission: 'order_security.view', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'order_security.manage', resource: branchResource }));

    if (!canView) {
      return { success: false, message: 'Forbidden: Missing order security view permission.' };
    }

    const settings = await OrderSecurityService.getBranchSecuritySettings(branchId);
    return { success: true, settings };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch security settings.';
    return { success: false, message: msg };
  }
}

export async function updateBranchOrderSecuritySettingsAction(
  branchId: string,
  updates: Partial<BranchOrderSecuritySettings>
) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canManage = await can({
      context: authContext,
      permission: 'order_security.manage',
      resource: branchResource,
    });

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing required order_security.manage permission.' };
    }

    const res = await OrderSecurityService.updateBranchSecuritySettings(branchId, updates);
    if (res.success) {
      revalidatePath('/dashboard/settings/order-security');
    }
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update security settings.';
    return { success: false, message: msg };
  }
}

export async function applySecurityPresetAction(branchId: string, preset: SecurityPresetLevel) {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branchResource = { type: 'branch' as const, id: branchId };
    const canManage = await can({
      context: authContext,
      permission: 'order_security.manage',
      resource: branchResource,
    });

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing required order_security.manage permission.' };
    }

    const res = await OrderSecurityService.applySecurityPreset(branchId, preset);
    if (res.success) {
      revalidatePath('/dashboard/settings/order-security');
    }
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to apply security preset.';
    return { success: false, message: msg };
  }
}

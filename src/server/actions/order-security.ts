'use server';

import { revalidatePath } from 'next/cache';
import { OrderSecurityService } from '@/server/services/order-security.service';
import { PermissionService } from '@/server/services/permission.service';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { SecurityPresetLevel, BranchOrderSecuritySettings } from '@/types/database.types';

export async function getBranchOrderSecuritySettingsAction(branchId: string) {
  try {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branch = context.branches.find((b) => b.id === branchId);
    if (!branch && context.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canView =
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'order_security.view')) ||
      (await PermissionService.hasPermission(context.user.id, context.business.id, branchId, 'order_security.manage'));

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
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branch = context.branches.find((b) => b.id === branchId);
    if (!branch && context.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      branchId,
      'order_security.manage'
    );

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
    const context = await resolveActiveBusinessContext();
    if (!context || !context.user || !context.business) {
      return { success: false, message: 'Unauthorized session.' };
    }

    const branch = context.branches.find((b) => b.id === branchId);
    if (!branch && context.membership.role !== 'business_owner') {
      return { success: false, message: 'Branch not found or access denied.' };
    }

    const canManage = await PermissionService.hasPermission(
      context.user.id,
      context.business.id,
      branchId,
      'order_security.manage'
    );

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

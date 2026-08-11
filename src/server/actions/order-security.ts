'use server';

import { OrderSecurityService } from '@/server/services/order-security.service';
import { SecurityPresetLevel, BranchOrderSecuritySettings } from '@/types/database.types';

export async function getBranchOrderSecuritySettingsAction(branchId: string) {
  try {
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
    const res = await OrderSecurityService.updateBranchSecuritySettings(branchId, updates);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update security settings.';
    return { success: false, message: msg };
  }
}

export async function applySecurityPresetAction(branchId: string, preset: SecurityPresetLevel) {
  try {
    const res = await OrderSecurityService.applySecurityPreset(branchId, preset);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to apply security preset.';
    return { success: false, message: msg };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { updateInventorySettingsSchema, UpdateInventorySettingsInput } from '@/lib/validation/purchasing';

export async function updateInventorySettingsAction(input: UpdateInventorySettingsInput) {
  const parsed = updateInventorySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid settings data.' };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const { PermissionService } = await import('@/server/services/permission.service');
  const canManage = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    input.branchId || context.activeBranch?.id || null,
    'inventory.settings.manage'
  );
  if (!canManage) {
    return { success: false, message: 'Forbidden: Missing inventory.settings.manage permission.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('inventory_settings')
    .upsert({
      business_id: context.business.id,
      branch_id: input.branchId || null,
      deduction_timing: input.deductionTiming,
      costing_method: input.costingMethod,
      auto_sold_out_mode: input.autoSoldOutMode,
      receiving_tolerance_percent: input.receivingTolerancePercent,
      default_consumption_location_id: input.defaultConsumptionLocationId || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'business_id, branch_id',
    });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/dashboard/inventory/settings');
  revalidatePath('/dashboard/inventory');
  return { success: true, message: 'Inventory settings saved successfully.' };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { updateInventorySettingsSchema, UpdateInventorySettingsInput } from '@/lib/validation/purchasing';

export async function updateInventorySettingsAction(input: UpdateInventorySettingsInput) {
  const parsed = updateInventorySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid settings data.' };
  }

  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return { success: false, message: 'Unauthorized.' };
  }

  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const targetBranchId = input.branchId || authContext.activeBranchId || null;
  const targetResource = targetBranchId
    ? {
        resourceType: 'branch' as const,
        resourceId: targetBranchId,
        businessId: authContext.businessId,
        branchId: targetBranchId,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      }
    : undefined;

  const canManage =
    (await can({
      context: authContext,
      permission: 'inventory.settings.manage',
      resource: targetResource,
    })) ||
    (await can({
      context: authContext,
      permission: 'inventory.manage',
      resource: targetResource,
    })) ||
    authContext.isBusinessOwner;

  if (!canManage) {
    return { success: false, message: 'Forbidden: Missing inventory.settings.manage permission.' };
  }

  const admin = createAdminClient();

  // Find existing settings for business and branch
  const query = admin
    .from('inventory_settings')
    .select('id')
    .eq('business_id', authContext.businessId);

  if (input.branchId) {
    query.eq('branch_id', input.branchId);
  } else {
    query.is('branch_id', null);
  }

  const { data: existingSettings } = await query.maybeSingle();

  const settingsPayload = {
    business_id: authContext.businessId,
    branch_id: input.branchId || null,
    deduction_timing: input.deductionTiming,
    costing_method: input.costingMethod,
    auto_sold_out_mode: input.autoSoldOutMode,
    receiving_tolerance_percent: input.receivingTolerancePercent,
    default_consumption_location_id: input.defaultConsumptionLocationId || null,
    updated_at: new Date().toISOString(),
  };

  let saveError = null;

  if (existingSettings?.id) {
    const { error: updateError } = await admin
      .from('inventory_settings')
      .update(settingsPayload)
      .eq('id', existingSettings.id);
    saveError = updateError;
  } else {
    const { error: insertError } = await admin
      .from('inventory_settings')
      .insert(settingsPayload);
    saveError = insertError;
  }

  if (saveError) {
    return { success: false, message: saveError.message };
  }

  revalidatePath('/dashboard/inventory/settings');
  revalidatePath('/dashboard/inventory');
  return { success: true, message: 'Inventory settings saved successfully.' };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import { parseDecimalToMinorUnits } from '@/lib/utils/money';
import {
  createModifierGroupSchema,
  updateModifierGroupSchema,
  createModifierOptionSchema,
  updateModifierOptionSchema,
  CreateModifierGroupInput,
  UpdateModifierGroupInput,
  CreateModifierOptionInput,
  UpdateModifierOptionInput,
} from '@/lib/validation/modifier';
import { ActionResponse } from './auth';

/**
 * Creates a new modifier group for a specific menu item.
 */
export async function createModifierGroupAction(
  formData: CreateModifierGroupInput
): Promise<ActionResponse<{ groupId: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const canManage =
    (await PermissionService.hasPermission(context.user.id, context.business.id, context.activeBranch.id, 'menu.modifiers.manage')) ||
    (await PermissionService.hasPermission(context.user.id, context.business.id, context.activeBranch.id, 'menu.manage'));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Missing permission to manage modifiers.' };
  }

  const parsed = createModifierGroupSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    menuItemId,
    name,
    description,
    selectionType,
    isRequired,
    minSelections,
    maxSelections,
    displayOrder,
    isActive,
  } = parsed.data;

  const supabase = await createClient();

  // Verify menu item belongs to active business & branch and is not archived
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, deleted_at')
    .eq('id', menuItemId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .single();

  if (!item || item.deleted_at !== null) {
    return { success: false, message: 'Invalid or archived menu item.' };
  }

  const { data: group, error } = await supabase
    .from('modifier_groups')
    .insert({
      business_id: context.business.id,
      branch_id: context.activeBranch.id,
      menu_item_id: menuItemId,
      name,
      description: description || null,
      selection_type: selectionType,
      is_required: isRequired,
      min_selections: minSelections,
      max_selections: maxSelections || null,
      display_order: displayOrder,
      is_active: isActive,
    })
    .select()
    .single();

  if (error || !group) {
    return { success: false, message: error?.message || 'Failed to create modifier group.' };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'menu.modifier_group_created',
    target_type: 'modifier_group',
    target_id: group.id,
    payload: { name, selection_type: selectionType, menu_item_id: menuItemId },
  });

  revalidatePath(`/dashboard/menu/items/${menuItemId}/modifiers`);
  return {
    success: true,
    message: 'Modifier group created successfully!',
    data: { groupId: group.id },
  };
}

/**
 * Updates an existing modifier group.
 */
export async function updateModifierGroupAction(
  formData: UpdateModifierGroupInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const parsed = updateModifierGroupSchema.safeParse(formData);
  if (!parsed.success) return { success: false, message: 'Validation failed.' };

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.name !== undefined) updateData.name = rest.name;
  if (rest.description !== undefined) updateData.description = rest.description || null;
  if (rest.selectionType !== undefined) updateData.selection_type = rest.selectionType;
  if (rest.isRequired !== undefined) updateData.is_required = rest.isRequired;
  if (rest.minSelections !== undefined) updateData.min_selections = rest.minSelections;
  if (rest.maxSelections !== undefined) updateData.max_selections = rest.maxSelections || null;
  if (rest.displayOrder !== undefined) updateData.display_order = rest.displayOrder;
  if (rest.isActive !== undefined) updateData.is_active = rest.isActive;

  const { data: updatedGroup, error } = await supabase
    .from('modifier_groups')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .select('menu_item_id')
    .single();

  if (error || !updatedGroup) return { success: false, message: error?.message || 'Failed to update group.' };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'menu.modifier_group_updated',
    target_type: 'modifier_group',
    target_id: id,
  });

  revalidatePath(`/dashboard/menu/items/${updatedGroup.menu_item_id}/modifiers`);
  return { success: true, message: 'Modifier group updated.' };
}

/**
 * Archives (soft deletes) a modifier group.
 */
export async function archiveModifierGroupAction(groupId: string): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from('modifier_groups')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', groupId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .select('menu_item_id')
    .single();

  if (error || !group) return { success: false, message: error?.message || 'Failed to archive group.' };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'menu.modifier_group_archived',
    target_type: 'modifier_group',
    target_id: groupId,
  });

  revalidatePath(`/dashboard/menu/items/${group.menu_item_id}/modifiers`);
  return { success: true, message: 'Modifier group archived.' };
}

/**
 * Creates a new modifier option inside a active modifier group.
 */
export async function createModifierOptionAction(
  formData: CreateModifierOptionInput
): Promise<ActionResponse<{ optionId: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const canManage =
    (await PermissionService.hasPermission(context.user.id, context.business.id, context.activeBranch.id, 'menu.modifiers.manage')) ||
    (await PermissionService.hasPermission(context.user.id, context.business.id, context.activeBranch.id, 'menu.manage'));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Missing permission to manage modifiers.' };
  }

  const parsed = createModifierOptionSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { modifierGroupId, name, additionalPrice, displayOrder, isActive } = parsed.data;
  const supabase = await createClient();

  // Verify group belongs to active business & branch and is not archived
  const { data: group } = await supabase
    .from('modifier_groups')
    .select('id, menu_item_id, deleted_at')
    .eq('id', modifierGroupId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .single();

  if (!group || group.deleted_at !== null) {
    return { success: false, message: 'Invalid or archived modifier group.' };
  }

  const additionalPriceCents = parseDecimalToMinorUnits(additionalPrice);

  const { data: option, error } = await supabase
    .from('modifier_options')
    .insert({
      business_id: context.business.id,
      branch_id: context.activeBranch.id,
      modifier_group_id: modifierGroupId,
      name,
      additional_price_cents: additionalPriceCents,
      display_order: displayOrder,
      is_active: isActive,
    })
    .select()
    .single();

  if (error || !option) {
    return { success: false, message: error?.message || 'Failed to create modifier option.' };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'menu.modifier_option_created',
    target_type: 'modifier_option',
    target_id: option.id,
    payload: { name, additional_price_cents: additionalPriceCents, modifier_group_id: modifierGroupId },
  });

  revalidatePath(`/dashboard/menu/items/${group.menu_item_id}/modifiers`);
  return {
    success: true,
    message: 'Modifier option created successfully!',
    data: { optionId: option.id },
  };
}

/**
 * Updates an existing modifier option.
 */
export async function updateModifierOptionAction(
  formData: UpdateModifierOptionInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const parsed = updateModifierOptionSchema.safeParse(formData);
  if (!parsed.success) return { success: false, message: 'Validation failed.' };

  const { id, additionalPrice, ...rest } = parsed.data;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.name !== undefined) updateData.name = rest.name;
  if (additionalPrice !== undefined) updateData.additional_price_cents = parseDecimalToMinorUnits(additionalPrice);
  if (rest.displayOrder !== undefined) updateData.display_order = rest.displayOrder;
  if (rest.isActive !== undefined) updateData.is_active = rest.isActive;

  const { data: updatedOpt, error } = await supabase
    .from('modifier_options')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .select('modifier_groups(menu_item_id)')
    .single();

  if (error || !updatedOpt) return { success: false, message: error?.message || 'Failed to update option.' };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: additionalPrice !== undefined ? 'menu.modifier_option_price_changed' : 'menu.modifier_option_updated',
    target_type: 'modifier_option',
    target_id: id,
  });

  const menuItemId = (updatedOpt as unknown as { modifier_groups: { menu_item_id: string } | null }).modifier_groups?.menu_item_id;
  if (menuItemId) revalidatePath(`/dashboard/menu/items/${menuItemId}/modifiers`);

  return { success: true, message: 'Modifier option updated.' };
}

/**
 * Archives (soft deletes) a modifier option.
 */
export async function archiveModifierOptionAction(optionId: string): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const supabase = await createClient();
  const { data: opt, error } = await supabase
    .from('modifier_options')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', optionId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .select('modifier_groups(menu_item_id)')
    .single();

  if (error || !opt) return { success: false, message: error?.message || 'Failed to archive option.' };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'menu.modifier_option_archived',
    target_type: 'modifier_option',
    target_id: optionId,
  });

  const menuItemId = (opt as unknown as { modifier_groups: { menu_item_id: string } | null }).modifier_groups?.menu_item_id;
  if (menuItemId) revalidatePath(`/dashboard/menu/items/${menuItemId}/modifiers`);

  return { success: true, message: 'Modifier option archived.' };
}

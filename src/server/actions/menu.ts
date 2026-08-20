'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { generateSlug, appendSlugSuffix } from '@/lib/tenant/slug';
import {
  createMenuCategorySchema,
  updateMenuCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from '@/lib/validation/menu';
import { parseDecimalToMinorUnits } from '@/lib/utils/money';
import { ActionResponse } from './auth';

/**
 * Creates a new menu category for the active business & default branch.
 */
export async function createMenuCategoryAction(
  formData: CreateMenuCategoryInput
): Promise<ActionResponse<{ categoryId: string; slug: string }>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active business branch not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canManage =
    (await can({ context: authContext, permission: 'menu.categories.manage', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: branchResource }));

  if (!canManage) {
    return { success: false, message: 'Forbidden. Missing required permission to create category.' };
  }

  const parsed = createMenuCategorySchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, description, imageUrl, displayOrder, isActive } = parsed.data;
  const supabase = await createClient();

  // Generate unique slug per branch
  let slug = generateSlug(name);
  let attempts = 0;
  let isUnique = false;

  while (!isUnique && attempts < 5) {
    const { data: existing } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('branch_id', authContext.activeBranchId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      isUnique = true;
    } else {
      slug = appendSlugSuffix(generateSlug(name));
      attempts++;
    }
  }

  const { data: category, error } = await supabase
    .from('menu_categories')
    .insert({
      business_id: authContext.businessId,
      branch_id: authContext.activeBranchId,
      name,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      display_order: displayOrder,
      is_active: isActive,
    })
    .select()
    .single();

  if (error || !category) {
    return { success: false, message: error?.message || 'Failed to create menu category.' };
  }

  // Record Audit Log
  await supabase.from('audit_logs').insert({
    business_id: authContext.businessId,
    action: 'menu.category_created',
    target_type: 'menu_category',
    target_id: category.id,
    payload: { name, slug, branch_id: authContext.activeBranchId },
  });

  revalidatePath('/dashboard/menu');
  return {
    success: true,
    message: 'Menu category created successfully!',
    data: { categoryId: category.id, slug: category.slug },
  };
}

/**
 * Updates an existing menu category.
 */
export async function updateMenuCategoryAction(
  formData: UpdateMenuCategoryInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canManage =
    (await can({ context: authContext, permission: 'menu.categories.manage', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: branchResource }));

  if (!canManage) return { success: false, message: 'Forbidden. Missing required category permission.' };

  const parsed = updateMenuCategorySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.' };
  }

  const { id, name, description, imageUrl, displayOrder, isActive } = parsed.data;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description || null;
  if (imageUrl !== undefined) updateData.image_url = imageUrl || null;
  if (displayOrder !== undefined) updateData.display_order = displayOrder;
  if (isActive !== undefined) updateData.is_active = isActive;

  const { error } = await supabase
    .from('menu_categories')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/dashboard/menu');
  return { success: true, message: 'Menu category updated.' };
}

/**
 * Archives (soft deletes) a menu category.
 */
export async function archiveMenuCategoryAction(
  categoryId: string
): Promise<ActionResponse<{ itemCount?: number }>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) return { success: false, message: 'Unauthorized.' };

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canManage =
    (await can({ context: authContext, permission: 'menu.categories.manage', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: branchResource }));

  if (!canManage) return { success: false, message: 'Forbidden. Missing required category permission.' };

  const supabase = await createClient();

  // Check for active (non-deleted) menu items referencing this category
  const { count, error: countError } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId)
    .is('deleted_at', null);

  if (countError) {
    return { success: false, message: 'Failed to verify category menu items.' };
  }

  if (count && count > 0) {
    return {
      success: false,
      message: `This category contains ${count} menu item${count > 1 ? 's' : ''}. Move or delete these items before deleting the category.`,
      data: { itemCount: count },
    };
  }

  const { error } = await supabase
    .from('menu_categories')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', categoryId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: authContext.businessId,
    action: 'menu.category_archived',
    target_type: 'menu_category',
    target_id: categoryId,
  });

  revalidatePath('/dashboard/menu');
  revalidatePath('/dashboard/menu/categories');
  revalidatePath('/m/[token]', 'layout');
  revalidatePath('/dashboard/waiter');
  return { success: true, message: 'Menu category archived.' };
}

/**
 * Creates a new menu item under a verified active category.
 */
export async function createMenuItemAction(
  formData: CreateMenuItemInput
): Promise<ActionResponse<{ itemId: string; slug: string }>> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canCreate =
    (await can({ context: authContext, permission: 'menu.items.create', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: branchResource }));

  if (!canCreate) {
    return { success: false, message: 'Forbidden. Missing required permission menu.items.create.' };
  }

  const parsed = createMenuItemSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    name,
    categoryId,
    description,
    price,
    currency,
    preparationTimeMinutes,
    availabilityStatus,
    isFeatured,
    displayOrder,
    primaryImageUrl,
  } = parsed.data;

  const supabase = await createClient();

  // Verify category belongs to active business & branch
  const { data: category } = await supabase
    .from('menu_categories')
    .select('id, deleted_at')
    .eq('id', categoryId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId)
    .single();

  if (!category || category.deleted_at !== null) {
    return { success: false, message: 'Invalid or archived category.' };
  }

  // Generate unique item slug
  let slug = generateSlug(name);
  let attempts = 0;
  let isUnique = false;

  while (!isUnique && attempts < 5) {
    const { data: existing } = await supabase
      .from('menu_items')
      .select('id')
      .eq('branch_id', authContext.activeBranchId)
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      isUnique = true;
    } else {
      slug = appendSlugSuffix(generateSlug(name));
      attempts++;
    }
  }

  const priceCents = parseDecimalToMinorUnits(price);

  const { data: item, error } = await supabase
    .from('menu_items')
    .insert({
      business_id: authContext.businessId,
      branch_id: authContext.activeBranchId,
      category_id: categoryId,
      name,
      slug,
      description: description || null,
      price_cents: priceCents,
      currency: currency || 'USD',
      preparation_time_minutes: preparationTimeMinutes || null,
      availability_status: availabilityStatus,
      is_featured: isFeatured,
      display_order: displayOrder,
      primary_image_url: primaryImageUrl || null,
    })
    .select()
    .single();

  if (error || !item) {
    return { success: false, message: error?.message || 'Failed to create menu item.' };
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    business_id: authContext.businessId,
    action: 'menu.item_created',
    target_type: 'menu_item',
    target_id: item.id,
    payload: { name, price_cents: priceCents, category_id: categoryId },
  });

  revalidatePath('/dashboard/menu');
  return {
    success: true,
    message: 'Menu item created successfully!',
    data: { itemId: item.id, slug: item.slug },
  };
}

/**
 * Updates an existing menu item.
 */
export async function updateMenuItemAction(
  formData: UpdateMenuItemInput
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) return { success: false, message: 'Unauthorized.' };

  const parsed = updateMenuItemSchema.safeParse(formData);
  if (!parsed.success) return { success: false, message: 'Validation failed.' };

  const { id, price, ...rest } = parsed.data;
  const itemResource = { type: 'menu_item' as const, id };

  const isPriceChanging = price !== undefined;
  const isAvailabilityChanging = rest.availabilityStatus !== undefined;
  const isGeneralChanging =
    rest.name !== undefined ||
    rest.categoryId !== undefined ||
    rest.description !== undefined ||
    rest.isFeatured !== undefined ||
    rest.displayOrder !== undefined ||
    rest.primaryImageUrl !== undefined;

  const hasMenuManage = await can({
    context: authContext,
    permission: 'menu.manage',
    resource: itemResource,
  });

  if (isPriceChanging && !hasMenuManage) {
    const canPrice = await can({
      context: authContext,
      permission: 'menu.price.update',
      resource: itemResource,
    });
    if (!canPrice) {
      return { success: false, message: 'Forbidden. Missing required permission menu.price.update.' };
    }
  }

  if (isAvailabilityChanging && !hasMenuManage) {
    const canAvail = await can({
      context: authContext,
      permission: 'menu.availability.update',
      resource: itemResource,
    });
    if (!canAvail) {
      return { success: false, message: 'Forbidden. Missing required permission menu.availability.update.' };
    }
  }

  if (isGeneralChanging && !hasMenuManage) {
    const canEdit = await can({
      context: authContext,
      permission: 'menu.items.edit',
      resource: itemResource,
    });
    if (!canEdit) {
      return { success: false, message: 'Forbidden. Missing required permission menu.items.edit.' };
    }
  }

  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.name !== undefined) updateData.name = rest.name;
  if (rest.categoryId !== undefined) updateData.category_id = rest.categoryId;
  if (rest.description !== undefined) updateData.description = rest.description || null;
  if (price !== undefined) updateData.price_cents = parseDecimalToMinorUnits(price);
  if (rest.availabilityStatus !== undefined) updateData.availability_status = rest.availabilityStatus;
  if (rest.isFeatured !== undefined) updateData.is_featured = rest.isFeatured;
  if (rest.displayOrder !== undefined) updateData.display_order = rest.displayOrder;
  if (rest.primaryImageUrl !== undefined) updateData.primary_image_url = rest.primaryImageUrl || null;

  const { error } = await supabase
    .from('menu_items')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) return { success: false, message: error.message };

  revalidatePath('/dashboard/menu');
  revalidatePath('/dashboard/menu/items');
  revalidatePath('/m/[token]', 'layout');
  revalidatePath('/dashboard/waiter');
  return { success: true, message: 'Menu item updated.' };
}

/**
 * Toggles menu item availability status (available / out_of_stock / hidden).
 */
export async function updateMenuItemAvailabilityAction(
  itemId: string,
  availabilityStatus: 'available' | 'out_of_stock' | 'hidden'
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) return { success: false, message: 'Unauthorized.' };

  const itemResource = { type: 'menu_item' as const, id: itemId };
  const canUpdate =
    (await can({ context: authContext, permission: 'menu.availability.update', resource: itemResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: itemResource }));

  if (!canUpdate) {
    return { success: false, message: 'Forbidden. Missing permission menu.availability.update.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ availability_status: availabilityStatus, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) return { success: false, message: error.message };

  revalidatePath('/dashboard/menu');
  revalidatePath('/dashboard/menu/items');
  revalidatePath('/m/[token]', 'layout');
  revalidatePath('/dashboard/waiter');
  return { success: true, message: `Availability status updated to ${availabilityStatus}.` };
}

/**
 * Toggles menu item featured status.
 */
export async function toggleMenuItemFeaturedAction(
  itemId: string,
  isFeatured: boolean
): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) return { success: false, message: 'Unauthorized.' };

  const itemResource = { type: 'menu_item' as const, id: itemId };
  const canUpdate =
    (await can({ context: authContext, permission: 'menu.items.edit', resource: itemResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: itemResource }));

  if (!canUpdate) return { success: false, message: 'Forbidden.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) return { success: false, message: error.message };

  revalidatePath('/dashboard/menu');
  revalidatePath('/dashboard/menu/items');
  revalidatePath('/m/[token]', 'layout');
  revalidatePath('/dashboard/waiter');
  return { success: true, message: 'Featured status updated.' };
}

/**
 * Archives (soft deletes) a menu item.
 */
export async function archiveMenuItemAction(itemId: string): Promise<ActionResponse> {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) return { success: false, message: 'Unauthorized.' };

  const itemResource = { type: 'menu_item' as const, id: itemId };
  const canDelete =
    (await can({ context: authContext, permission: 'menu.items.delete', resource: itemResource })) ||
    (await can({ context: authContext, permission: 'menu.manage', resource: itemResource }));

  if (!canDelete) return { success: false, message: 'Forbidden. Missing permission menu.items.delete.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', itemId)
    .eq('business_id', authContext.businessId)
    .eq('branch_id', authContext.activeBranchId);

  if (error) return { success: false, message: error.message };

  revalidatePath('/dashboard/menu');
  revalidatePath('/dashboard/menu/items');
  revalidatePath('/m/[token]', 'layout');
  revalidatePath('/dashboard/waiter');
  return { success: true, message: 'Menu item archived.' };
}


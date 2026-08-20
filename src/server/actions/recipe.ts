'use server';

import { revalidatePath } from 'next/cache';
import { RecipeService } from '@/server/services/recipe.service';
import { PermissionService } from '@/server/services/permission.service';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import {
  createRecipeSchema,
  producePrepBatchSchema,
  CreateRecipeInput,
  ProducePrepBatchInput,
} from '@/lib/validation/recipe';

export async function createRecipeAction(input: CreateRecipeInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const canManage = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch?.id || null,
    'recipes.manage'
  );

  if (!canManage) {
    return { success: false, message: 'Forbidden: Missing required recipes.manage permission.' };
  }

  const parsed = createRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid recipe data.' };
  }

  const res = await RecipeService.createRecipe(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/recipes');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function producePrepBatchAction(input: ProducePrepBatchInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const canProduce = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch?.id || null,
    'inventory.production.manage'
  );

  if (!canProduce) {
    return { success: false, message: 'Forbidden: Missing required inventory.production.manage permission.' };
  }

  const parsed = producePrepBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid batch data.' };
  }

  const res = await RecipeService.producePrepBatch(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/production');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

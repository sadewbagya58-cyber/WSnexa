'use server';

import { revalidatePath } from 'next/cache';
import { RecipeService } from '@/server/services/recipe.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import {
  createRecipeSchema,
  producePrepBatchSchema,
  CreateRecipeInput,
  ProducePrepBatchInput,
} from '@/lib/validation/recipe';

export async function createRecipeAction(input: CreateRecipeInput) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const branchResource = authContext.activeBranchId ? { type: 'branch' as const, id: authContext.activeBranchId } : undefined;
  const canManage = await can({
    context: authContext,
    permission: 'recipes.manage',
    resource: branchResource,
  });

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

export async function updateRecipeAction(input: import('@/lib/validation/recipe').UpdateRecipeInput) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const { updateRecipeSchema } = await import('@/lib/validation/recipe');
  const parsed = updateRecipeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid recipe data.' };
  }

  const res = await RecipeService.updateRecipe(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/recipes');
    revalidatePath(`/dashboard/inventory/recipes/${input.id}`);
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function archiveRecipeAction(recipeId: string) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const res = await RecipeService.archiveRecipe(recipeId);
  if (res.success) {
    revalidatePath('/dashboard/inventory/recipes');
    revalidatePath(`/dashboard/inventory/recipes/${recipeId}`);
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function producePrepBatchAction(input: ProducePrepBatchInput) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized session.' };
  }

  const branchResource = authContext.activeBranchId
    ? { type: 'branch' as const, id: authContext.activeBranchId }
    : undefined;

  const canProduce = await can({
    context: authContext,
    permission: 'inventory.production.manage',
    resource: branchResource,
  });

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

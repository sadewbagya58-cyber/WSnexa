'use server';

import { revalidatePath } from 'next/cache';
import { RecipeService } from '@/server/services/recipe.service';
import {
  createRecipeSchema,
  producePrepBatchSchema,
  CreateRecipeInput,
  ProducePrepBatchInput,
} from '@/lib/validation/recipe';

export async function createRecipeAction(input: CreateRecipeInput) {
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

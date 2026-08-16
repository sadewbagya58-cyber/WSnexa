import { z } from 'zod';

export const recipeTypeEnum = z.enum(['menu_item', 'prep_recipe']);
export type RecipeType = z.infer<typeof recipeTypeEnum>;

export const modifierEffectTypeEnum = z.enum(['add', 'remove', 'substitute', 'scale']);
export type ModifierEffectType = z.infer<typeof modifierEffectTypeEnum>;

export const recipeIngredientSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid('Invalid inventory item ID').optional().nullable(),
  subRecipeId: z.string().uuid('Invalid sub-recipe ID').optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  yieldFactor: z
    .number()
    .min(0.01, 'Yield factor must be at least 1%')
    .max(1.0, 'Yield factor cannot exceed 100%')
    .default(1.0),
  defaultLocationId: z.string().uuid('Invalid storage location ID').optional().nullable(),
  displayOrder: z.number().int().default(0),
  notes: z.string().max(250).optional().nullable(),
}).refine(
  (data) => (data.itemId && !data.subRecipeId) || (!data.itemId && data.subRecipeId),
  { message: 'Must specify either an inventory item or a sub-recipe, not both.' }
);

export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;

export const createRecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required').max(100, 'Recipe name too long'),
  menuItemId: z.string().uuid('Invalid menu item ID').optional().nullable(),
  recipeType: recipeTypeEnum.default('menu_item'),
  outputInventoryItemId: z.string().uuid('Invalid output inventory item ID').optional().nullable(),
  yieldQuantity: z.number().positive('Yield quantity must be positive').default(1.0),
  yieldUnit: z.string().min(1, 'Yield unit is required').default('portion'),
  portionSize: z.string().max(50).optional().nullable(),
  preparationInstructions: z.string().max(2000).optional().nullable(),
  branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).min(1, 'Recipe must have at least one ingredient'),
}).refine(
  (data) => data.recipeType !== 'prep_recipe' || !!data.outputInventoryItemId,
  { message: 'Prep recipes must define an output prepared inventory item.', path: ['outputInventoryItemId'] }
);

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z.object({
  id: z.string().uuid('Invalid recipe ID'),
  name: z.string().min(1, 'Recipe name is required').max(100).optional(),
  menuItemId: z.string().uuid().optional().nullable(),
  recipeType: recipeTypeEnum.optional(),
  outputInventoryItemId: z.string().uuid().optional().nullable(),
  yieldQuantity: z.number().positive().optional(),
  yieldUnit: z.string().min(1).optional(),
  portionSize: z.string().max(50).optional().nullable(),
  preparationInstructions: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).optional(),
});

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export const producePrepBatchSchema = z.object({
  recipeId: z.string().uuid('Invalid recipe ID'),
  sourceLocationId: z.string().uuid('Invalid source storage location ID'),
  targetLocationId: z.string().uuid('Invalid target storage location ID'),
  batchNumber: z.string().min(1, 'Batch number is required').max(50),
  scale: z.number().positive('Scale factor must be positive').default(1.0),
  actualQuantity: z.number().positive('Actual produced quantity must be positive'),
  notes: z.string().max(500).optional().nullable(),
});

export type ProducePrepBatchInput = z.infer<typeof producePrepBatchSchema>;

export const modifierOverrideSchema = z.object({
  modifierOptionId: z.string().uuid('Invalid modifier option ID'),
  effectType: modifierEffectTypeEnum.default('add'),
  itemId: z.string().uuid('Invalid inventory item ID').optional().nullable(),
  quantity: z.number().default(1.0),
  unit: z.string().default('pcs'),
});

export type ModifierOverrideInput = z.infer<typeof modifierOverrideSchema>;

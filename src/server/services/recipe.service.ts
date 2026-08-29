import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { UnitConverter } from '@/lib/inventory/unit-converter';
import {
  CreateRecipeInput,
  UpdateRecipeInput,
  ProducePrepBatchInput,
} from '@/lib/validation/recipe';

export interface RecipeWithIngredients {
  id: string;
  businessId: string;
  menuItemId: string | null;
  menuItemName?: string | null;
  menuItemPriceCents?: number | null;
  name: string;
  recipeType: 'menu_item' | 'prep_recipe';
  outputInventoryItemId: string | null;
  outputItemName?: string | null;
  version: number;
  yieldQuantity: number;
  yieldUnit: string;
  portionSize: string | null;
  preparationInstructions: string | null;
  isActive: boolean;
  branchId: string | null;
  totalCostCents: number;
  costPerPortionCents: number;
  foodCostPercentage: number;
  grossProfitCents: number;
  grossMarginPercentage: number;
  currency: string;
  ingredients: RecipeIngredientDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredientDetail {
  id: string;
  recipeId: string;
  itemId: string | null;
  itemName?: string | null;
  subRecipeId: string | null;
  subRecipeName?: string | null;
  quantity: number;
  unit: string;
  quantityBase: number;
  yieldFactor: number;
  unitCostCents: number;
  totalCostCents: number;
  defaultLocationId: string | null;
  defaultLocationName?: string | null;
  displayOrder: number;
  notes: string | null;
}

export class RecipeService {
  /**
   * Validates DAG to prevent any recursive sub-recipe cycles.
   */
  static async validateNoCycles(
    businessId: string,
    recipeId: string | null,
    subRecipeIds: string[]
  ): Promise<{ valid: boolean; cyclePath?: string[] }> {
    if (!subRecipeIds || subRecipeIds.length === 0) return { valid: true };

    const admin = createAdminClient();
    const { data: allIngredients } = await admin
      .from('inventory_recipe_ingredients')
      .select('recipe_id, sub_recipe_id')
      .not('sub_recipe_id', 'is', null);

    // Build adjacency graph
    const graph: Record<string, string[]> = {};
    for (const row of allIngredients || []) {
      if (!graph[row.recipe_id]) graph[row.recipe_id] = [];
      graph[row.recipe_id].push(row.sub_recipe_id);
    }

    if (recipeId) {
      graph[recipeId] = subRecipeIds;
    }

    // Depth-First Search for cycle detection
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): boolean {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    }

    const startNodes = recipeId ? [recipeId, ...subRecipeIds] : subRecipeIds;
    for (const node of startNodes) {
      if (recipeId && node === recipeId && subRecipeIds.includes(recipeId)) {
        return { valid: false, cyclePath: [recipeId, recipeId] };
      }
      visited.clear();
      recStack.clear();
      path.length = 0;
      if (dfs(node)) {
        return { valid: false, cyclePath: [...path] };
      }
    }

    return { valid: true };
  }

  /**
   * Retrieves all recipes for active business.
   */
  static async getRecipes(filter?: {
    recipeType?: 'menu_item' | 'prep_recipe';
    menuItemId?: string;
    isActive?: boolean;
  }): Promise<RecipeWithIngredients[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) return [];

    const admin = createAdminClient();
    let query = admin
      .from('inventory_recipes')
      .select(`
        *,
        menu_items ( id, name, price_cents ),
        inventory_items:output_inventory_item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
        ingredients:inventory_recipe_ingredients!inventory_recipe_ingredients_recipe_id_fkey (
          id,
          recipe_id,
          item_id,
          sub_recipe_id,
          quantity,
          unit,
          quantity_base,
          yield_factor,
          default_location_id,
          display_order,
          notes,
          inventory_items:item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
          sub_recipe:inventory_recipes!inventory_recipe_ingredients_sub_recipe_id_fkey ( id, name )
        )
      `)
      .eq('business_id', context.business.id)
      .order('name', { ascending: true });

    if (filter?.recipeType) query = query.eq('recipe_type', filter.recipeType);
    if (filter?.menuItemId) query = query.eq('menu_item_id', filter.menuItemId);
    if (filter?.isActive !== undefined) query = query.eq('is_active', filter.isActive);

    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error('[RecipeService.getRecipes] Query error:', error);
      return [];
    }

    const businessCurrency = context.business.defaultCurrency || 'USD';

    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let canViewCosts = false;
    try {
      const authContext = await resolveAuthorizationContext();
      if (authContext) {
        canViewCosts =
          (await can({ context: authContext, permission: 'recipes.costs.view' })) ||
          (await can({ context: authContext, permission: 'inventory.costs.view' }));
      }
    } catch {
      canViewCosts = false;
    }

    interface RawIngredientRow {
      id: string;
      recipe_id: string;
      item_id: string | null;
      sub_recipe_id: string | null;
      quantity: number;
      unit: string;
      quantity_base: number;
      yield_factor: number;
      default_location_id: string | null;
      display_order: number | null;
      notes: string | null;
      inventory_items?: { id: string; name: string; base_unit: string; cost_per_unit_cents: number; currency: string } | null;
      sub_recipe?: { id: string; name: string } | null;
    }

    return data.map((r) => {
      let totalCostCents = 0;
      const ingredients: RecipeIngredientDetail[] = ((r.ingredients as unknown as RawIngredientRow[]) || []).map((ing) => {
        const itemCost = canViewCosts ? (ing.inventory_items?.cost_per_unit_cents || 0) : 0;
        const effectiveQty = ing.yield_factor > 0 ? ing.quantity_base / ing.yield_factor : ing.quantity_base;
        const lineCost = canViewCosts ? Math.round(effectiveQty * itemCost) : 0;
        if (canViewCosts) {
          totalCostCents += lineCost;
        }

        return {
          id: ing.id,
          recipeId: ing.recipe_id,
          itemId: ing.item_id,
          itemName: ing.inventory_items?.name || null,
          subRecipeId: ing.sub_recipe_id,
          subRecipeName: ing.sub_recipe?.name || null,
          quantity: Number(ing.quantity),
          unit: ing.unit,
          quantityBase: Number(ing.quantity_base),
          yieldFactor: Number(ing.yield_factor),
          unitCostCents: itemCost,
          totalCostCents: lineCost,
          defaultLocationId: ing.default_location_id,
          displayOrder: ing.display_order || 0,
          notes: ing.notes,
        };
      });

      const yieldQty = Number(r.yield_quantity) || 1.0;
      const costPerPortionCents = canViewCosts && yieldQty > 0 ? Math.round(totalCostCents / yieldQty) : 0;
      const sellingPriceCents = r.menu_items?.price_cents || 0;

      let foodCostPercentage = 0;
      if (canViewCosts && sellingPriceCents > 0) {
        foodCostPercentage = Number(((costPerPortionCents / sellingPriceCents) * 100).toFixed(1));
      }

      const grossProfitCents = canViewCosts ? Math.max(0, sellingPriceCents - costPerPortionCents) : 0;
      let grossMarginPercentage = 0;
      if (canViewCosts && sellingPriceCents > 0) {
        grossMarginPercentage = Number(((grossProfitCents / sellingPriceCents) * 100).toFixed(1));
      }

      return {
        id: r.id,
        businessId: r.business_id,
        menuItemId: r.menu_item_id,
        menuItemName: r.menu_items?.name || null,
        menuItemPriceCents: sellingPriceCents,
        name: r.name,
        recipeType: r.recipe_type,
        outputInventoryItemId: r.output_inventory_item_id,
        outputItemName: r.inventory_items?.name || null,
        outputItemUnit: r.inventory_items?.base_unit || null,
        version: r.version,
        yieldQuantity: yieldQty,
        yieldUnit: r.yield_unit,
        portionSize: r.portion_size,
        preparationInstructions: r.preparation_instructions,
        isActive: r.is_active,
        branchId: r.branch_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        ingredients,
        totalCostCents,
        costPerPortionCents,
        sellingPriceCents,
        foodCostPercentage,
        grossProfitCents,
        grossMarginPercentage,
        currency: businessCurrency,
      };
    });
  }

  /**
   * Retrieves single recipe by ID with complete calculated metrics.
   */
  static async getRecipeById(recipeId: string): Promise<RecipeWithIngredients | null> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business) return null;

    const admin = createAdminClient();
    const { data: r, error } = await admin
      .from('inventory_recipes')
      .select(`
        *,
        menu_items ( id, name, price_cents ),
        inventory_items:output_inventory_item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
        ingredients:inventory_recipe_ingredients!inventory_recipe_ingredients_recipe_id_fkey (
          id,
          recipe_id,
          item_id,
          sub_recipe_id,
          quantity,
          unit,
          quantity_base,
          yield_factor,
          default_location_id,
          display_order,
          notes,
          inventory_items:item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
          sub_recipe:inventory_recipes!inventory_recipe_ingredients_sub_recipe_id_fkey ( id, name )
        )
      `)
      .eq('id', recipeId)
      .eq('business_id', context.business.id)
      .maybeSingle();

    if (error || !r) {
      if (error) console.error('[RecipeService.getRecipeById] Query error:', error);
      return null;
    }

    interface RawIngredientRow {
      id: string;
      recipe_id: string;
      item_id: string | null;
      sub_recipe_id: string | null;
      quantity: number;
      unit: string;
      quantity_base: number;
      yield_factor: number;
      default_location_id: string | null;
      display_order: number | null;
      notes: string | null;
      inventory_items?: { id: string; name: string; base_unit: string; cost_per_unit_cents: number; currency: string } | null;
      sub_recipe?: { id: string; name: string } | null;
    }

    const businessCurrency = context.business.defaultCurrency || 'USD';

    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let canViewCosts = false;
    try {
      const authContext = await resolveAuthorizationContext();
      if (authContext) {
        canViewCosts =
          (await can({ context: authContext, permission: 'recipes.costs.view' })) ||
          (await can({ context: authContext, permission: 'inventory.costs.view' }));
      }
    } catch {
      canViewCosts = false;
    }

    let totalCostCents = 0;
    const ingredients: RecipeIngredientDetail[] = ((r.ingredients as unknown as RawIngredientRow[]) || []).map((ing) => {
      const itemCost = canViewCosts ? (ing.inventory_items?.cost_per_unit_cents || 0) : 0;
      const effectiveQty = ing.yield_factor > 0 ? ing.quantity_base / ing.yield_factor : ing.quantity_base;
      const lineCost = canViewCosts ? Math.round(effectiveQty * itemCost) : 0;
      if (canViewCosts) {
        totalCostCents += lineCost;
      }

      return {
        id: ing.id,
        recipeId: ing.recipe_id,
        itemId: ing.item_id,
        itemName: ing.inventory_items?.name || null,
        subRecipeId: ing.sub_recipe_id,
        subRecipeName: ing.sub_recipe?.name || null,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        quantityBase: Number(ing.quantity_base),
        yieldFactor: Number(ing.yield_factor),
        unitCostCents: itemCost,
        totalCostCents: lineCost,
        defaultLocationId: ing.default_location_id,
        displayOrder: ing.display_order || 0,
        notes: ing.notes,
      };
    });

    const yieldQty = Number(r.yield_quantity) || 1.0;
    const costPerPortionCents = canViewCosts && yieldQty > 0 ? Math.round(totalCostCents / yieldQty) : 0;
    const sellingPriceCents = r.menu_items?.price_cents || 0;

    let foodCostPercentage = 0;
    let grossProfitCents = 0;
    let grossMarginPercentage = 0;

    if (canViewCosts && sellingPriceCents > 0) {
      foodCostPercentage = Number(((costPerPortionCents / sellingPriceCents) * 100).toFixed(1));
      grossProfitCents = Math.max(0, sellingPriceCents - costPerPortionCents);
      grossMarginPercentage = Number(((grossProfitCents / sellingPriceCents) * 100).toFixed(1));
    }

    return {
      id: r.id,
      businessId: r.business_id,
      menuItemId: r.menu_item_id,
      menuItemName: r.menu_items?.name || null,
      menuItemPriceCents: sellingPriceCents,
      name: r.name,
      recipeType: r.recipe_type,
      outputInventoryItemId: r.output_inventory_item_id,
      outputItemName: r.inventory_items?.name || null,
      version: r.version,
      yieldQuantity: yieldQty,
      yieldUnit: r.yield_unit,
      portionSize: r.portion_size,
      preparationInstructions: r.preparation_instructions,
      isActive: r.is_active,
      branchId: r.branch_id,
      totalCostCents,
      costPerPortionCents,
      foodCostPercentage,
      grossProfitCents,
      grossMarginPercentage,
      currency: businessCurrency,
      ingredients,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  static async createRecipe(input: CreateRecipeInput) {
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

    const branchResource = input.branchId
      ? { type: 'branch' as const, id: input.branchId }
      : (authContext.activeBranchId ? { type: 'branch' as const, id: authContext.activeBranchId } : undefined);

    const canManage =
      (await can({ context: authContext, permission: 'recipes.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing recipes.manage permission.' };
    }

    const admin = createAdminClient();

    // 1. Check Sub-Recipe Cycles
    const subRecipeIds = input.ingredients
      .filter((i) => !!i.subRecipeId)
      .map((i) => i.subRecipeId as string);

    const cycleCheck = await this.validateNoCycles(authContext.businessId, null, subRecipeIds);
    if (!cycleCheck.valid) {
      return {
        success: false,
        message: `Recursive recipe cycle detected: ${cycleCheck.cyclePath?.join(' -> ')}. Sub-recipe references must form a directed acyclic graph.`,
      };
    }

    // 2. Fetch inventory items to normalize base units
    const itemIds = input.ingredients.filter((i) => !!i.itemId).map((i) => i.itemId as string);
    const { data: invItems } = await admin
      .from('inventory_items')
      .select('id, base_unit, cost_per_unit_cents')
      .in('id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);

    const itemMap = new Map<string, { base_unit: string; cost_per_unit_cents: number }>();
    (invItems || []).forEach((i) => itemMap.set(i.id, i));

    // 3. Check for existing active recipe for this menu item and determine next version
    let nextVersion = 1;
    if (input.menuItemId) {
      let activeQuery = admin
        .from('inventory_recipes')
        .select('id, version')
        .eq('business_id', authContext.businessId)
        .eq('menu_item_id', input.menuItemId);

      if (input.branchId) {
        activeQuery = activeQuery.eq('branch_id', input.branchId);
      } else {
        activeQuery = activeQuery.is('branch_id', null);
      }

      const { data: existingList } = await activeQuery;
      if (existingList && existingList.length > 0) {
        const maxV = Math.max(...existingList.map((r) => r.version || 1));
        nextVersion = maxV + 1;

        // Deactivate previous active versions to satisfy single-active invariant
        let deactQuery = admin
          .from('inventory_recipes')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('business_id', authContext.businessId)
          .eq('menu_item_id', input.menuItemId)
          .eq('is_active', true);

        if (input.branchId) {
          deactQuery = deactQuery.eq('branch_id', input.branchId);
        } else {
          deactQuery = deactQuery.is('branch_id', null);
        }

        await deactQuery;
      }
    }

    // 4. Insert Recipe Header
    const { data: recipe, error: recipeErr } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: authContext.businessId,
        menu_item_id: input.menuItemId || null,
        name: input.name.trim(),
        recipe_type: input.recipeType,
        output_inventory_item_id: input.outputInventoryItemId || null,
        version: nextVersion,
        yield_quantity: input.yieldQuantity,
        yield_unit: input.yieldUnit.trim(),
        portion_size: input.portionSize || null,
        preparation_instructions: input.preparationInstructions || null,
        is_active: true,
        branch_id: input.branchId || null,
        created_by: authContext.userId,
      })
      .select()
      .single();

    if (recipeErr || !recipe) {
      return { success: false, message: recipeErr?.message || 'Failed to create recipe.' };
    }

    // 5. Normalize & Insert Ingredients
    const ingredientRows = input.ingredients.map((ing, idx) => {
      let quantityBase = ing.quantity;
      const matchedItem = ing.itemId ? itemMap.get(ing.itemId) : null;
      if (matchedItem && ing.unit) {
        try {
          quantityBase = UnitConverter.normalizeToBase(ing.quantity, ing.unit, matchedItem.base_unit);
        } catch {
          quantityBase = ing.quantity;
        }
      }

      return {
        recipe_id: recipe.id,
        item_id: ing.itemId || null,
        sub_recipe_id: ing.subRecipeId || null,
        quantity: ing.quantity,
        unit: ing.unit,
        quantity_base: quantityBase,
        yield_factor: ing.yieldFactor ?? 1.0,
        default_location_id: ing.defaultLocationId || null,
        display_order: idx + 1,
        notes: ing.notes || null,
      };
    });

    const { error: ingErr } = await admin
      .from('inventory_recipe_ingredients')
      .insert(ingredientRows);

    if (ingErr) {
      await admin.from('inventory_recipes').delete().eq('id', recipe.id);
      return { success: false, message: `Failed to save ingredients: ${ingErr.message}` };
    }

    return { success: true, recipeId: recipe.id, message: 'Recipe created successfully.' };
  }

  /**
   * Updates an existing recipe and its ingredients in-place.
   */
  static async updateRecipe(input: UpdateRecipeInput) {
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

    const admin = createAdminClient();

    // 1. Fetch existing recipe to verify tenant boundary
    const { data: existing, error: fetchErr } = await admin
      .from('inventory_recipes')
      .select('*')
      .eq('id', input.id)
      .eq('business_id', authContext.businessId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { success: false, message: 'Recipe not found.' };
    }

    const branchResource = existing.branch_id
      ? { type: 'branch' as const, id: existing.branch_id }
      : (authContext.activeBranchId ? { type: 'branch' as const, id: authContext.activeBranchId } : undefined);

    const canManage =
      (await can({ context: authContext, permission: 'recipes.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing recipes.manage permission.' };
    }

    // 2. Validate DAG cycles if ingredients are updated
    if (input.ingredients && input.ingredients.length > 0) {
      const subRecipeIds = input.ingredients
        .filter((i) => !!i.subRecipeId)
        .map((i) => i.subRecipeId as string);

      const cycleCheck = await this.validateNoCycles(authContext.businessId, input.id, subRecipeIds);
      if (!cycleCheck.valid) {
        return {
          success: false,
          message: `Recursive recipe cycle detected: ${cycleCheck.cyclePath?.join(' -> ')}. Sub-recipe references must form a directed acyclic graph.`,
        };
      }
    }

    // 3. Update Recipe Header
    const updateHeader: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updateHeader.name = input.name.trim();
    if (input.yieldQuantity !== undefined) updateHeader.yield_quantity = input.yieldQuantity;
    if (input.yieldUnit !== undefined) updateHeader.yield_unit = input.yieldUnit.trim();
    if (input.portionSize !== undefined) updateHeader.portion_size = input.portionSize || null;
    if (input.preparationInstructions !== undefined) updateHeader.preparation_instructions = input.preparationInstructions || null;
    if (input.outputInventoryItemId !== undefined) updateHeader.output_inventory_item_id = input.outputInventoryItemId || null;
    if (input.isActive !== undefined) updateHeader.is_active = input.isActive;

    const { error: updateErr } = await admin
      .from('inventory_recipes')
      .update(updateHeader)
      .eq('id', input.id)
      .eq('business_id', authContext.businessId);

    if (updateErr) {
      return { success: false, message: updateErr.message || 'Failed to update recipe header.' };
    }

    // 4. Update Ingredients if provided
    if (input.ingredients && input.ingredients.length > 0) {
      const itemIds = input.ingredients.filter((i) => !!i.itemId).map((i) => i.itemId as string);
      const { data: invItems } = await admin
        .from('inventory_items')
        .select('id, base_unit, cost_per_unit_cents')
        .in('id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);

      const itemMap = new Map<string, { base_unit: string; cost_per_unit_cents: number }>();
      (invItems || []).forEach((i) => itemMap.set(i.id, i));

      // Remove existing ingredients
      await admin.from('inventory_recipe_ingredients').delete().eq('recipe_id', input.id);

      // Insert new ingredients
      const ingredientRows = input.ingredients.map((ing, idx) => {
        let quantityBase = ing.quantity;
        const matchedItem = ing.itemId ? itemMap.get(ing.itemId) : null;
        if (matchedItem && ing.unit) {
          try {
            quantityBase = UnitConverter.normalizeToBase(ing.quantity, ing.unit, matchedItem.base_unit);
          } catch {
            quantityBase = ing.quantity;
          }
        }

        return {
          recipe_id: input.id,
          item_id: ing.itemId || null,
          sub_recipe_id: ing.subRecipeId || null,
          quantity: ing.quantity,
          unit: ing.unit,
          quantity_base: quantityBase,
          yield_factor: ing.yieldFactor ?? 1.0,
          default_location_id: ing.defaultLocationId || null,
          display_order: idx + 1,
          notes: ing.notes || null,
        };
      });

      const { error: ingErr } = await admin
        .from('inventory_recipe_ingredients')
        .insert(ingredientRows);

      if (ingErr) {
        return { success: false, message: `Failed to update ingredients: ${ingErr.message}` };
      }
    }

    return { success: true, recipeId: input.id, message: 'Recipe updated successfully.' };
  }

  /**
   * Safely archives/deactivates a recipe.
   */
  static async archiveRecipe(recipeId: string) {
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

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('inventory_recipes')
      .select('id, branch_id')
      .eq('id', recipeId)
      .eq('business_id', authContext.businessId)
      .maybeSingle();

    if (!existing) {
      return { success: false, message: 'Recipe not found.' };
    }

    const branchResource = existing.branch_id
      ? { type: 'branch' as const, id: existing.branch_id }
      : (authContext.activeBranchId ? { type: 'branch' as const, id: authContext.activeBranchId } : undefined);

    const canManage =
      (await can({ context: authContext, permission: 'recipes.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));

    if (!canManage) {
      return { success: false, message: 'Forbidden: Missing recipes.manage permission.' };
    }

    const { error } = await admin
      .from('inventory_recipes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', recipeId)
      .eq('business_id', authContext.businessId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Recipe archived successfully.' };
  }

  /**
   * Deletes a recipe if unreferenced in history, or archives it.
   */
  static async deleteRecipe(recipeId: string) {
    return this.archiveRecipe(recipeId);
  }

  /**
   * Produces a batch of prepared sub-recipe atomically.
   */
  static async producePrepBatch(input: ProducePrepBatchInput) {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized.' };
    }

    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: 'Unauthorized or active branch required.' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
    const canProduce =
      (await can({ context: authContext, permission: 'recipes.produce', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.production.manage', resource: branchResource }));

    if (!canProduce) {
      return { success: false, message: 'Forbidden: Missing production permission.' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('produce_prep_recipe_batch', {
      p_business_id: authContext.businessId,
      p_branch_id: authContext.activeBranchId,
      p_recipe_id: input.recipeId,
      p_batch_number: input.batchNumber.trim(),
      p_source_location_id: input.sourceLocationId,
      p_target_location_id: input.targetLocationId,
      p_scale: input.scale,
      p_actual_quantity: input.actualQuantity,
      p_actor_id: authContext.userId,
      p_notes: input.notes || null,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const res = data as { success: boolean; error?: string; message?: string; batch_id?: string };
    if (!res.success) {
      return { success: false, message: res.message || res.error || 'Production batch failed.' };
    }

    return { success: true, batchId: res.batch_id, message: 'Production batch recorded successfully.' };
  }
}

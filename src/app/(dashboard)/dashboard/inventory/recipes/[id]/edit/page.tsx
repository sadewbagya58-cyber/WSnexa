import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { RecipeService } from '@/server/services/recipe.service';
import { RecipeBuilderForm, InitialRecipeData } from '@/components/inventory/recipe-builder-form';

export const metadata: Metadata = {
  title: 'Edit Recipe | WSNexa Inventory',
  description: 'Modify recipe ingredients, yields, and cost portioning',
};

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  const recipe = await RecipeService.getRecipeById(id);
  if (!recipe) {
    notFound();
  }

  const admin = createAdminClient();

  // 1. Fetch available inventory items
  const { data: rawItems } = await admin
    .from('inventory_items')
    .select('id, name, base_unit, cost_per_unit_cents')
    .eq('business_id', context.business.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const availableItems = (rawItems || []).map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.base_unit,
    costPerUnitCents: i.cost_per_unit_cents || 0,
  }));

  // 2. Fetch available menu items
  const { data: rawMenuItems } = await admin
    .from('menu_items')
    .select('id, name, price_cents')
    .eq('business_id', context.business.id)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  const availableMenuItems = (rawMenuItems || []).map((m) => ({
    id: m.id,
    name: m.name,
    priceCents: m.price_cents || 0,
  }));

  // 3. Fetch existing sub-recipes
  const { data: rawSubRecipes } = await admin
    .from('inventory_recipes')
    .select('id, name, yield_quantity, yield_unit')
    .eq('business_id', context.business.id)
    .eq('recipe_type', 'prep_recipe')
    .eq('is_active', true)
    .neq('id', id)
    .order('name', { ascending: true });

  const availableSubRecipes = (rawSubRecipes || []).map((s) => ({
    id: s.id,
    name: s.name,
    yieldQuantity: Number(s.yield_quantity) || 1,
    yieldUnit: s.yield_unit,
  }));

  const initialRecipeData: InitialRecipeData = {
    id: recipe.id,
    name: recipe.name,
    recipeType: recipe.recipeType,
    menuItemId: recipe.menuItemId,
    outputInventoryItemId: recipe.outputInventoryItemId,
    yieldQuantity: recipe.yieldQuantity,
    yieldUnit: recipe.yieldUnit,
    portionSize: recipe.portionSize,
    ingredients: recipe.ingredients.map((ing) => ({
      itemId: ing.itemId,
      subRecipeId: ing.subRecipeId,
      quantity: ing.quantity,
      unit: ing.unit,
      yieldFactor: ing.yieldFactor,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${recipe.name}`}
        description={`Modify Bill of Materials and yield settings for version ${recipe.version}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Recipes & Costing', href: '/dashboard/inventory/recipes' },
          { label: recipe.name, href: `/dashboard/inventory/recipes/${recipe.id}` },
          { label: 'Edit' },
        ]}
      />

      <RecipeBuilderForm
        availableItems={availableItems}
        availableMenuItems={availableMenuItems}
        availableSubRecipes={availableSubRecipes}
        currency={recipe.currency || context.business.defaultCurrency || 'USD'}
        initialRecipe={initialRecipeData}
      />
    </div>
  );
}

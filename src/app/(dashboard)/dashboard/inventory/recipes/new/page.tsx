import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { RecipeBuilderForm } from '@/components/inventory/recipe-builder-form';

export const metadata: Metadata = {
  title: 'Create Recipe | WSNexa Inventory',
  description: 'Design a new menu item recipe or prep sub-recipe with ingredient portioning and cost calculation',
};

export default async function NewRecipePage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  const admin = createAdminClient();

  // 1. Fetch available inventory stock items
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
    .eq('is_active', true);

  const availableSubRecipes = (rawSubRecipes || []).map((s) => ({
    id: s.id,
    name: s.name,
    yieldQuantity: Number(s.yield_quantity) || 1.0,
    yieldUnit: s.yield_unit,
  }));

  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Recipe / BOM"
        description="Link menu items to inventory ingredients for automated stock consumption and real-time food cost margin tracking"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Recipes', href: '/dashboard/inventory/recipes' },
          { label: 'New Recipe' },
        ]}
        helpSlug="creating-recipes-and-bom"
      />

      <RecipeBuilderForm
        availableItems={availableItems}
        availableMenuItems={availableMenuItems}
        availableSubRecipes={availableSubRecipes}
        currency={currency}
      />
    </div>
  );
}

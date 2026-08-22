import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { RecipeService } from '@/server/services/recipe.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { formatCurrencyMinor } from '@/lib/utils/currency';

export const metadata: Metadata = {
  title: 'Recipes & BOM Costing | WSNexa Inventory',
  description: 'Recipe costing, Bill of Materials, portion yield, food cost percentage, and sub-recipe management',
};

export default async function RecipesPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.activeBranch) {
    redirect('/login');
  }

  let canManageRecipes = false;
  try {
    const authContext = await resolveAuthorizationContext();
    const branchResource = {
      resourceType: 'branch' as const,
      resourceId: context.activeBranch.id,
      businessId: context.business.id,
      branchId: context.activeBranch.id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    };
    const hasRecipeManage = await can({ context: authContext, permission: 'inventory.recipes.manage', resource: branchResource });
    const hasManage = await can({ context: authContext, permission: 'inventory.manage', resource: branchResource });
    canManageRecipes = hasRecipeManage || hasManage || authContext.isBusinessOwner;
  } catch {
    canManageRecipes = false;
  }

  const recipes = await RecipeService.getRecipes();
  const currency = context.business.defaultCurrency || 'USD';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes & BOM Costing"
        description="Configure recipe formulas, ingredient portioning, yield factors, and track real-time food cost margins"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Recipes' },
        ]}
        helpSlug="creating-recipes-and-bom"
        primaryAction={
          canManageRecipes ? (
            <Link
              href="/dashboard/inventory/recipes/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + Create Recipe
            </Link>
          ) : undefined
        }
        secondaryActions={
          <Link
            href="/dashboard/inventory/production"
            className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            🍲 Batch Production
          </Link>
        }
      />

      {/* Overview Filter Tabs */}
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
        <Link
          href="/dashboard/inventory/recipes"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white shadow-xs"
        >
          All Recipes ({recipes.length})
        </Link>
        <Link
          href="/dashboard/inventory/production"
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
        >
          🍲 Prep Batches
        </Link>
      </div>

      {/* Recipes Grid */}
      {recipes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3 shadow-xs">
          <div className="text-4xl">👨‍🍳</div>
          <h3 className="text-base font-bold text-zinc-900">No Recipes Configured Yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Link your menu items to inventory ingredients to begin tracking ingredient consumption, portion costs, and food margins automatically.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/inventory/recipes/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-xs"
            >
              + Create First Recipe
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((r) => {
            const isPrep = r.recipeType === 'prep_recipe';
            const costFormatted = formatCurrencyMinor(r.costPerPortionCents, currency);
            const priceFormatted = r.menuItemPriceCents ? formatCurrencyMinor(r.menuItemPriceCents, currency) : null;

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 hover:border-zinc-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                        {isPrep ? '🍲 Sub-Recipe / Prep' : '🍽️ Menu Item Recipe'}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-950">{r.name}</h3>
                    </div>
                    {isPrep ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        Prep Output: {r.outputItemName || 'Inventory'}
                      </span>
                    ) : r.foodCostPercentage > 0 ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          r.foodCostPercentage <= 30
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.foodCostPercentage <= 38
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {r.foodCostPercentage}% Cost
                      </span>
                    ) : null}
                  </div>

                  {r.menuItemName && (
                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                      <span>Linked Menu:</span>
                      <span className="font-semibold text-zinc-800">{r.menuItemName}</span>
                    </div>
                  )}

                  {/* Ingredients Preview */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-zinc-700 block mb-1.5">
                      Formula ({r.ingredients.length} ingredients):
                    </span>
                    <ul className="text-xs space-y-1 text-zinc-600">
                      {r.ingredients.slice(0, 4).map((ing) => (
                        <li key={ing.id} className="flex justify-between items-center text-[11px]">
                          <span className="text-zinc-800 truncate pr-2">
                            • {ing.itemName || ing.subRecipeName}
                          </span>
                          <span className="font-mono text-zinc-500">
                            {ing.quantity} {ing.unit}
                          </span>
                        </li>
                      ))}
                      {r.ingredients.length > 4 && (
                        <li className="text-[10px] text-zinc-400 italic">
                          +{r.ingredients.length - 4} more ingredients
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Financial Summary Footer */}
                <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">
                      {isPrep ? 'Batch Cost' : 'Portion Cost'}
                    </span>
                    <span className="font-bold text-zinc-950">{costFormatted}</span>
                  </div>

                  {!isPrep && priceFormatted ? (
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Gross Margin</span>
                      <span className="font-bold text-emerald-600">{r.grossMarginPercentage}%</span>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Yield</span>
                      <span className="font-bold text-zinc-700">
                        {r.yieldQuantity} {r.yieldUnit}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

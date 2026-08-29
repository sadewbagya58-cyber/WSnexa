import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RecipeService } from '@/server/services/recipe.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { RecipeDetailActions } from '@/components/inventory/recipe-detail-actions';

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Recipe Details | WSNexa Inventory',
  description: 'Detailed recipe cost breakdown, Bill of Materials, and portion metrics',
};

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { id } = await params;
  const recipe = await RecipeService.getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={recipe.name}
        description={`Version ${recipe.version} • Yield: ${recipe.yieldQuantity} ${recipe.yieldUnit}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory Hub', href: '/dashboard/inventory' },
          { label: 'Recipes & Costing', href: '/dashboard/inventory/recipes' },
          { label: recipe.name },
        ]}
        badge={<Badge variant="neutral">{recipe.recipeType === 'prep_recipe' ? 'Prep Formula' : 'Menu Item'}</Badge>}
        primaryAction={
          <RecipeDetailActions recipeId={recipe.id} isActive={recipe.isActive} />
        }
        secondaryActions={
          <Link
            href="/dashboard/inventory/recipes"
            className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            ← Back to Recipes
          </Link>
        }
      />

      {/* Financial Rollup Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Portion Cost
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">
            {formatCurrencyMinor(recipe.costPerPortionCents, recipe.currency)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Total Batch: {formatCurrencyMinor(recipe.totalCostCents, recipe.currency)}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Selling Price
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">
            {(recipe.menuItemPriceCents || 0) > 0
              ? formatCurrencyMinor(recipe.menuItemPriceCents || 0, recipe.currency)
              : 'N/A (Prep Item)'}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{recipe.menuItemName || 'Internal Batch Output'}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Food Cost %
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">
            {recipe.foodCostPercentage > 0 ? `${recipe.foodCostPercentage}%` : '—'}
          </div>
          <p className="text-xs text-zinc-500 mt-1">Target benchmark: 28% – 35%</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Gross Margin
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            {recipe.grossMarginPercentage > 0 ? `${recipe.grossMarginPercentage}%` : '—'}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Profit: {recipe.grossProfitCents > 0 ? formatCurrencyMinor(recipe.grossProfitCents, recipe.currency) : '—'}
          </p>
        </div>
      </div>

      {/* Bill of Materials Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-5 sm:px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Bill of Materials (BOM Ingredients)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Quantities normalized to canonical inventory base units with yield trim factor.
          </p>
        </div>

        {/* Mobile BOM Cards View */}
        <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
          {recipe.ingredients.map((ing) => (
            <div
              key={ing.id}
              className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {ing.subRecipeName ? (
                    <span className="text-indigo-600 font-bold block truncate">
                      🍲 {ing.subRecipeName} <span className="text-[10px] text-indigo-400 font-normal">(Sub-Recipe)</span>
                    </span>
                  ) : (
                    <span className="font-bold text-zinc-900 block truncate">
                      🥦 {ing.itemName || 'Raw Item'}
                    </span>
                  )}
                  {ing.notes && <p className="text-[11px] text-zinc-500 mt-0.5 italic">&quot;{ing.notes}&quot;</p>}
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 whitespace-nowrap">
                  Yield: {(ing.yieldFactor * 100).toFixed(0)}%
                </span>
              </div>

              <div className="bg-white rounded-lg p-2.5 border border-zinc-200/70 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Formula Quantity:</span>
                  <span className="font-bold text-zinc-900">
                    {ing.quantity} {ing.unit} <span className="text-zinc-400 font-mono font-normal">({ing.quantityBase.toFixed(3)} base)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-1.5">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">Unit Cost</span>
                    <span className="font-mono text-zinc-700">
                      {formatCurrencyMinor(ing.unitCostCents, recipe.currency)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">Line Total</span>
                    <span className="font-mono font-bold text-zinc-950">
                      {formatCurrencyMinor(ing.totalCostCents, recipe.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop BOM Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-6 py-3">Ingredient / Sub-Recipe</th>
                <th className="px-6 py-3">Recipe Quantity</th>
                <th className="px-6 py-3">Base Qty</th>
                <th className="px-6 py-3">Yield Factor</th>
                <th className="px-6 py-3">Unit Cost</th>
                <th className="px-6 py-3 text-right">Line Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {recipe.ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {ing.subRecipeName ? (
                      <span className="text-indigo-600 font-semibold">
                        {ing.subRecipeName} (Sub-Recipe)
                      </span>
                    ) : (
                      ing.itemName || 'Raw Item'
                    )}
                    {ing.notes && <p className="text-xs text-zinc-400 mt-0.5">{ing.notes}</p>}
                  </td>
                  <td className="px-6 py-4 text-zinc-700">
                    {ing.quantity} {ing.unit}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono text-xs">
                    {ing.quantityBase.toFixed(3)} base
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {(ing.yieldFactor * 100).toFixed(0)}%
                  </td>
                  <td className="px-6 py-4 text-zinc-700">
                    {formatCurrencyMinor(ing.unitCostCents, recipe.currency)}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-900">
                    {formatCurrencyMinor(ing.totalCostCents, recipe.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preparation Instructions */}
      {recipe.preparationInstructions && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">
            Preparation Instructions
          </h3>
          <p className="text-sm text-zinc-600 whitespace-pre-line leading-relaxed">
            {recipe.preparationInstructions}
          </p>
        </div>
      )}
    </div>
  );
}

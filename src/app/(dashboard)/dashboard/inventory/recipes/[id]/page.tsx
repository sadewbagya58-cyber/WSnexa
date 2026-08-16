import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { RecipeService } from '@/server/services/recipe.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

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
      {/* Header Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/inventory/recipes"
            className="px-3 py-1.5 text-sm font-medium border border-zinc-200 rounded-xl hover:bg-zinc-50 transition"
          >
            ← Back
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {recipe.name}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                recipe.recipeType === 'prep_recipe'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {recipe.recipeType === 'prep_recipe' ? 'Prep Formula' : 'Menu Item'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Version {recipe.version} • Yield: {recipe.yieldQuantity} {recipe.yieldUnit}
            </p>
          </div>
        </div>
      </div>

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
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Bill of Materials (BOM Ingredients)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Quantities normalized to canonical inventory base units with yield trim factor.
          </p>
        </div>

        <div className="overflow-x-auto">
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

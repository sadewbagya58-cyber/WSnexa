'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createRecipeAction, updateRecipeAction } from '@/server/actions/recipe';
import { STANDARD_UNITS } from '@/lib/inventory/unit-converter';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface AvailableItem {
  id: string;
  name: string;
  baseUnit: string;
  costPerUnitCents: number;
}

interface AvailableMenuItem {
  id: string;
  name: string;
  priceCents: number;
}

interface AvailableSubRecipe {
  id: string;
  name: string;
  yieldQuantity: number;
  yieldUnit: string;
}

export interface InitialRecipeData {
  id: string;
  name: string;
  recipeType: 'menu_item' | 'prep_recipe';
  menuItemId?: string | null;
  outputInventoryItemId?: string | null;
  yieldQuantity: number;
  yieldUnit: string;
  portionSize?: string | null;
  ingredients: Array<{
    itemId?: string | null;
    subRecipeId?: string | null;
    quantity: number;
    unit: string;
    yieldFactor?: number | null;
  }>;
}

interface RecipeBuilderFormProps {
  availableItems: AvailableItem[];
  availableMenuItems: AvailableMenuItem[];
  availableSubRecipes: AvailableSubRecipe[];
  currency: string;
  initialRecipe?: InitialRecipeData;
}

export function RecipeBuilderForm({
  availableItems,
  availableMenuItems,
  availableSubRecipes,
  currency,
  initialRecipe,
}: RecipeBuilderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(initialRecipe?.name || '');
  const [recipeType, setRecipeType] = useState<'menu_item' | 'prep_recipe'>(
    initialRecipe?.recipeType || 'menu_item'
  );
  const [menuItemId, setMenuItemId] = useState<string>(initialRecipe?.menuItemId || '');
  const [outputInventoryItemId, setOutputInventoryItemId] = useState<string>(
    initialRecipe?.outputInventoryItemId || ''
  );
  const [yieldQuantity, setYieldQuantity] = useState<number>(initialRecipe?.yieldQuantity || 1.0);
  const [yieldUnit, setYieldUnit] = useState<string>(initialRecipe?.yieldUnit || 'portion');
  const [portionSize, setPortionSize] = useState<string>(initialRecipe?.portionSize || '');

  const [ingredients, setIngredients] = useState<
    Array<{
      itemId: string;
      subRecipeId: string;
      quantity: number;
      unit: string;
      yieldFactor: number;
    }>
  >(
    initialRecipe?.ingredients && initialRecipe.ingredients.length > 0
      ? initialRecipe.ingredients.map((ing) => ({
          itemId: ing.itemId || '',
          subRecipeId: ing.subRecipeId || '',
          quantity: ing.quantity || 1,
          unit: ing.unit || availableItems[0]?.baseUnit || 'kg',
          yieldFactor: ing.yieldFactor || 1.0,
        }))
      : [
          {
            itemId: availableItems[0]?.id || '',
            subRecipeId: '',
            quantity: 1,
            unit: availableItems[0]?.baseUnit || 'kg',
            yieldFactor: 1.0,
          },
        ]
  );

  // Live Cost & Margin Calculations
  const selectedMenuItem = availableMenuItems.find((m) => m.id === menuItemId);
  const sellingPriceCents = selectedMenuItem?.priceCents || 0;

  let totalRecipeCostCents = 0;
  for (const ing of ingredients) {
    if (ing.itemId) {
      const itemDef = availableItems.find((i) => i.id === ing.itemId);
      if (itemDef) {
        // Base conversion
        const unitDef = STANDARD_UNITS[ing.unit.toLowerCase()];
        const factor = unitDef ? unitDef.conversionFactor : 1.0;
        const qtyInBase = ing.quantity * factor;
        const effectiveQty = ing.yieldFactor > 0 ? qtyInBase / ing.yieldFactor : qtyInBase;
        totalRecipeCostCents += Math.round(effectiveQty * itemDef.costPerUnitCents);
      }
    }
  }

  const costPerPortionCents = yieldQuantity > 0 ? Math.round(totalRecipeCostCents / yieldQuantity) : totalRecipeCostCents;
  const foodCostPercentage = sellingPriceCents > 0 ? ((costPerPortionCents / sellingPriceCents) * 100).toFixed(1) : '0.0';
  const grossProfitCents = Math.max(0, sellingPriceCents - costPerPortionCents);
  const grossMarginPercentage = sellingPriceCents > 0 ? ((grossProfitCents / sellingPriceCents) * 100).toFixed(1) : '0.0';

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      {
        itemId: availableItems[0]?.id || '',
        subRecipeId: '',
        quantity: 1,
        unit: availableItems[0]?.baseUnit || 'kg',
        yieldFactor: 1.0,
      },
    ]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a recipe name.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        recipeType,
        menuItemId: recipeType === 'menu_item' && menuItemId ? menuItemId : null,
        outputInventoryItemId: recipeType === 'prep_recipe' && outputInventoryItemId ? outputInventoryItemId : null,
        yieldQuantity,
        yieldUnit,
        portionSize: portionSize || null,
        ingredients: ingredients.map((ing, idx) => ({
          itemId: ing.itemId || null,
          subRecipeId: ing.subRecipeId || null,
          quantity: Number(ing.quantity) || 1,
          unit: ing.unit,
          yieldFactor: Number(ing.yieldFactor) || 1.0,
          displayOrder: idx,
        })),
      };

      let res;
      if (initialRecipe?.id) {
        res = await updateRecipeAction({ id: initialRecipe.id, ...payload });
      } else {
        res = await createRecipeAction(payload);
      }

      if (res.success) {
        setSuccessMsg(res.message || 'Recipe saved successfully! Redirecting...');
        router.push('/dashboard/inventory/recipes');
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to save recipe.');
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">1. Basic Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Recipe Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Classic Beef Burger"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Recipe Type</label>
            <select
              value={recipeType}
              onChange={(e) => setRecipeType(e.target.value as 'menu_item' | 'prep_recipe')}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden bg-white"
            >
              <option value="menu_item">🍽️ Menu Item Recipe (Sold directly to customers)</option>
              <option value="prep_recipe">🍲 Prep / Sub-Recipe (Produces batch inventory like Sauce)</option>
            </select>
          </div>
        </div>

        {recipeType === 'menu_item' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Link to Menu Item (Optional)</label>
              <select
                value={menuItemId}
                onChange={(e) => {
                  setMenuItemId(e.target.value);
                  const sel = availableMenuItems.find((m) => m.id === e.target.value);
                  if (sel && !name) setName(sel.name);
                }}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden bg-white"
              >
                <option value="">-- Select Menu Item --</option>
                {availableMenuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatCurrencyMinor(m.priceCents, currency)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Portion Yield & Serving Size</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  placeholder="unit (e.g. portion)"
                  className="w-28 px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={portionSize}
                  onChange={(e) => setPortionSize(e.target.value)}
                  placeholder="Serving size (e.g. 250g)"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Output Prepared Item *</label>
              <select
                required
                value={outputInventoryItemId}
                onChange={(e) => setOutputInventoryItemId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden bg-white"
              >
                <option value="">-- Select Output Stock Item --</option>
                {availableItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (Base unit: {i.baseUnit})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700">Batch Expected Yield</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(Number(e.target.value))}
                  className="w-24 px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
                />
                <input
                  type="text"
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  placeholder="kg / Litres / portions"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
              2. Ingredients & Sub-Recipes (BOM)
            </h3>
            <p className="text-xs text-zinc-500">
              Add raw ingredients and sub-recipes with standard units and usable yield factors.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIngredient}
            className="text-xs font-bold"
          >
            + Add Ingredient
          </Button>
        </div>

        <div className="space-y-3">
          {ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Ingredient / Sub-Recipe</label>
                <select
                  value={ing.itemId || (ing.subRecipeId ? `sub:${ing.subRecipeId}` : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('sub:')) {
                      const subId = val.replace('sub:', '');
                      const sub = availableSubRecipes.find((s) => s.id === subId);
                      setIngredients((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, itemId: '', subRecipeId: subId, unit: sub?.yieldUnit || 'portion' } : item
                        )
                      );
                    } else {
                      const itm = availableItems.find((i) => i.id === val);
                      setIngredients((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, itemId: val, subRecipeId: '', unit: itm?.baseUnit || item.unit } : item
                        )
                      );
                    }
                  }}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white focus:outline-hidden"
                >
                  <optgroup label="Raw Inventory Stock Items">
                    {availableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatCurrencyMinor(item.costPerUnitCents, currency)} / {item.baseUnit})
                      </option>
                    ))}
                  </optgroup>
                  {availableSubRecipes.length > 0 && (
                    <optgroup label="Prepared Sub-Recipes">
                      {availableSubRecipes.map((sub) => (
                        <option key={sub.id} value={`sub:${sub.id}`}>
                          🍲 {sub.name} ({sub.yieldQuantity} {sub.yieldUnit})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-zinc-600">Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={ing.quantity}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, quantity: Number(e.target.value) } : item))
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono bg-white focus:outline-hidden"
                />
              </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600">Unit</label>
                  <select
                    value={ing.unit}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item))
                      )
                    }
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white focus:outline-hidden"
                  >
                    {Object.keys(STANDARD_UNITS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-zinc-600" title="Kitchen trimming & cooking yield">
                    Yield (Trimming)
                  </label>
                  <select
                    value={ing.yieldFactor}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, yieldFactor: Number(e.target.value) } : item))
                      )
                    }
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium bg-white focus:outline-hidden"
                  >
                    <option value={1.0}>100% (No waste)</option>
                    <option value={0.9}>90% yield</option>
                    <option value={0.85}>85% yield</option>
                    <option value={0.8}>80% yield</option>
                    <option value={0.75}>75% yield</option>
                  </select>
                </div>

                <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                      title="Remove ingredient"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* Live Financial Costing Card */}
      <div className="bg-zinc-950 text-white p-6 rounded-2xl shadow-lg space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Live Financial Costing & Margins
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 block uppercase font-bold">Total Recipe Cost</span>
            <span className="text-xl font-black">{formatCurrencyMinor(costPerPortionCents, currency)}</span>
            <span className="text-[10px] text-zinc-500 block">per {yieldUnit}</span>
          </div>

          {recipeType === 'menu_item' && (
            <>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Selling Price</span>
                <span className="text-xl font-black">{formatCurrencyMinor(sellingPriceCents, currency)}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Food Cost %</span>
                <span
                  className={`text-xl font-black ${
                    Number(foodCostPercentage) <= 30
                      ? 'text-emerald-400'
                      : Number(foodCostPercentage) <= 38
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {foodCostPercentage}%
                </span>
                <span className="text-[10px] text-zinc-500 block">
                  {Number(foodCostPercentage) <= 30 ? 'Target achieved ✓' : 'Above target'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Gross Margin</span>
                <span className="text-xl font-black text-emerald-400">{grossMarginPercentage}%</span>
                <span className="text-[10px] text-zinc-500 block">
                  {formatCurrencyMinor(grossProfitCents, currency)} profit
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Form Submission Action Bar */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
          className="text-xs font-bold"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-w-32"
        >
          {isPending ? 'Saving…' : initialRecipe ? 'Update Recipe' : 'Save Recipe'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { producePrepBatchAction } from '@/server/actions/recipe';

interface PrepRecipeOption {
  id: string;
  name: string;
  yieldQuantity: number;
  yieldUnit: string;
  outputItemName?: string | null;
}

interface StorageLocationOption {
  id: string;
  name: string;
}

interface PrepProductionRunnerProps {
  prepRecipes: PrepRecipeOption[];
  locations: StorageLocationOption[];
}

export function PrepProductionRunner({ prepRecipes, locations }: PrepProductionRunnerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [recipeId, setRecipeId] = useState<string>(prepRecipes[0]?.id || '');
  const [sourceLocationId, setSourceLocationId] = useState<string>(locations[0]?.id || '');
  const [targetLocationId, setTargetLocationId] = useState<string>(locations[0]?.id || '');
  const [scale, setScale] = useState<number>(1.0);
  const [actualQuantity, setActualQuantity] = useState<number>(prepRecipes[0]?.yieldQuantity || 1.0);
  const [notes, setNotes] = useState<string>('');

  const selectedRecipe = prepRecipes.find((r) => r.id === recipeId);
  const expectedQuantity = selectedRecipe ? selectedRecipe.yieldQuantity * scale : 1.0;
  const variance = Number((actualQuantity - expectedQuantity).toFixed(2));

  function handleProduce(e: React.FormEvent) {
    e.preventDefault();
    if (!recipeId || !sourceLocationId || !targetLocationId) {
      setErrorMsg('Please select a recipe and valid storage locations.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const batchNumber = `BATCH-${Date.now().toString().slice(-6)}`;
      const res = await producePrepBatchAction({
        recipeId,
        sourceLocationId,
        targetLocationId,
        batchNumber,
        scale,
        actualQuantity,
        notes: notes || null,
      });

      if (res.success) {
        setSuccessMsg(`✓ Production batch #${batchNumber} recorded successfully.`);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to produce batch.');
      }
    });
  }

  if (prepRecipes.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3">
        <div className="text-3xl">🍲</div>
        <h3 className="text-sm font-bold text-zinc-900">No Prep Sub-Recipes Configured</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Create a Prep / Sub-Recipe in Recipe Builder (like sauces, prepped meats, or marinades) to start producing batches.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleProduce} className="space-y-6 max-w-2xl bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
      <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
        Produce Prep / Sub-Recipe Batch
      </h3>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700">Sub-Recipe to Produce *</label>
          <select
            value={recipeId}
            onChange={(e) => {
              const val = e.target.value;
              setRecipeId(val);
              const r = prepRecipes.find((p) => p.id === val);
              if (r) setActualQuantity(r.yieldQuantity * scale);
            }}
            className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
          >
            {prepRecipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (Outputs {r.yieldQuantity} {r.yieldUnit} of {r.outputItemName})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Source Location (Raw Ingredients) *</label>
            <select
              value={sourceLocationId}
              onChange={(e) => setSourceLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Target Location (Finished Batch) *</label>
            <select
              value={targetLocationId}
              onChange={(e) => setTargetLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Batch Multiplier / Scale</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={scale}
              onChange={(e) => {
                const s = Number(e.target.value) || 1.0;
                setScale(s);
                if (selectedRecipe) setActualQuantity(Number((selectedRecipe.yieldQuantity * s).toFixed(2)));
              }}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Actual Produced Output *</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={actualQuantity}
                onChange={(e) => setActualQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
              />
              <span className="inline-flex items-center px-3 text-xs font-bold text-zinc-500 bg-zinc-100 rounded-xl">
                {selectedRecipe?.yieldUnit || 'units'}
              </span>
            </div>
          </div>
        </div>

        {/* Yield Variance Feedback Banner */}
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-zinc-500">Expected Yield:</span>
            <span className="font-mono font-bold text-zinc-900">
              {expectedQuantity} {selectedRecipe?.yieldUnit}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Production Yield Variance:</span>
            <span
              className={`font-mono font-bold ${
                variance === 0 ? 'text-zinc-700' : variance > 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {variance > 0 ? `+${variance}` : variance} {selectedRecipe?.yieldUnit}
            </span>
          </div>
        </div>

        {/* Kitchen Notes */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold text-zinc-700">Production Remarks / Notes (Optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Scaled for weekend rush, simmered for 45 mins"
            className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-zinc-950"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-w-36"
        >
          {isPending ? 'Producing Batch…' : 'Dispatch Production ✓'}
        </Button>
      </div>
    </form>
  );
}

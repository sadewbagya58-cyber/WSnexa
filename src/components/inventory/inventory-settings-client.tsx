'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { updateInventorySettingsAction } from '@/server/actions/inventory-settings';

interface LocationOption {
  id: string;
  name: string;
}

interface InventorySettingsClientProps {
  branchId: string;
  locations: LocationOption[];
  initialSettings: {
    deductionTiming: 'confirmed' | 'preparing' | 'served' | 'completed';
    costingMethod: 'weighted_average' | 'latest_cost';
    autoSoldOutMode: 'warn_only' | 'suggest_sold_out' | 'auto_mark_sold_out';
    receivingTolerancePercent: number;
    defaultConsumptionLocationId: string | null;
  };
}

export function InventorySettingsClient({
  branchId,
  locations,
  initialSettings,
}: InventorySettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [deductionTiming, setDeductionTiming] = useState(initialSettings.deductionTiming);
  const [costingMethod, setCostingMethod] = useState(initialSettings.costingMethod);
  const [autoSoldOutMode, setAutoSoldOutMode] = useState(initialSettings.autoSoldOutMode);
  const [receivingTolerancePercent, setReceivingTolerancePercent] = useState(
    initialSettings.receivingTolerancePercent
  );
  const [defaultConsumptionLocationId, setDefaultConsumptionLocationId] = useState<string>(
    initialSettings.defaultConsumptionLocationId || locations[0]?.id || ''
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await updateInventorySettingsAction({
        branchId,
        deductionTiming,
        costingMethod,
        autoSoldOutMode,
        receivingTolerancePercent: Number(receivingTolerancePercent) || 10,
        defaultConsumptionLocationId: defaultConsumptionLocationId || null,
      });

      if (res.success) {
        setSuccessMsg('✓ Inventory settings saved successfully.');
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to save settings.');
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
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

      {/* Stock Deduction Stage */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
            1. Automatic Recipe Stock Deduction Timing
          </h3>
          <p className="text-xs text-zinc-500">
            Choose at which stage of the order lifecycle ingredient inventory is deducted from storage locations.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="deductionTiming"
              value="preparing"
              checked={deductionTiming === 'preparing'}
              onChange={(e) => setDeductionTiming(e.target.value as 'confirmed' | 'preparing' | 'served' | 'completed')}
              className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">
                🍳 When Kitchen Starts Preparing (Recommended Default)
              </span>
              <span className="text-[11px] text-zinc-500">
                Ingredients are deducted when cooks tap &quot;Start Preparing&quot;. Reflects physical commitment of food.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="deductionTiming"
              value="confirmed"
              checked={deductionTiming === 'confirmed'}
              onChange={(e) => setDeductionTiming(e.target.value as 'confirmed' | 'preparing' | 'served' | 'completed')}
              className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">
                📝 Upon Order Confirmation
              </span>
              <span className="text-[11px] text-zinc-500">
                Ingredients are deducted the moment an order arrives or is confirmed by staff.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="deductionTiming"
              value="completed"
              checked={deductionTiming === 'completed'}
              onChange={(e) => setDeductionTiming(e.target.value as 'confirmed' | 'preparing' | 'served' | 'completed')}
              className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">
                💳 Upon Payment / Settlement (Completed)
              </span>
              <span className="text-[11px] text-zinc-500">
                Ingredients are deducted only after the customer settles the bill.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Costing Method & Tolerance */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
            2. Costing Valuation & Tolerances
          </h3>
          <p className="text-xs text-zinc-500">
            Configure financial valuation formulas for food cost calculations and receiving discrepancy warnings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Costing Method</label>
            <select
              value={costingMethod}
              onChange={(e) => setCostingMethod(e.target.value as 'weighted_average' | 'latest_cost')}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              <option value="weighted_average">Weighted Average Purchase Cost (Recommended)</option>
              <option value="latest_cost">Latest Purchase Price</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700">Receiving Discrepancy Tolerance (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={receivingTolerancePercent}
              onChange={(e) => setReceivingTolerancePercent(Number(e.target.value))}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950"
            />
          </div>
        </div>
      </div>

      {/* Stock Availability & Default Location */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider">
            3. Stock Out & Default Storage Location
          </h3>
          <p className="text-xs text-zinc-500">
            Define system behavior when an ingredient runs out and specify the default kitchen location for recipe consumption.
          </p>
        </div>

        {locations.length > 0 && (
          <div className="space-y-1.5 pb-2">
            <label className="text-xs font-bold text-zinc-700">Default Consumption Storage Location</label>
            <select
              value={defaultConsumptionLocationId}
              onChange={(e) => setDefaultConsumptionLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-zinc-950 bg-white"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="autoSoldOutMode"
              value="warn_only"
              checked={autoSoldOutMode === 'warn_only'}
              onChange={(e) => setAutoSoldOutMode(e.target.value as 'warn_only' | 'suggest_sold_out' | 'auto_mark_sold_out')}
              className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">
                ⚠️ Warn Only (Recommended Default)
              </span>
              <span className="text-[11px] text-zinc-500">
                Displays low stock warnings to managers but keeps menu items orderable.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="autoSoldOutMode"
              value="suggest_sold_out"
              checked={autoSoldOutMode === 'suggest_sold_out'}
              onChange={(e) => setAutoSoldOutMode(e.target.value as 'warn_only' | 'suggest_sold_out' | 'auto_mark_sold_out')}
              className="mt-0.5 text-zinc-950 focus:ring-zinc-950"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">
                💡 Suggest Sold Out
              </span>
              <span className="text-[11px] text-zinc-500">
                Prompts kitchen and managers to mark dish as Sold Out with a single tap.
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white min-w-36"
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}

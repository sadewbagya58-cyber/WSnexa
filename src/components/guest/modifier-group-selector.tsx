'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CatalogModifierGroup } from '@/features/cart/cart-validation';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface ModifierGroupSelectorProps {
  group: CatalogModifierGroup;
  selectedOptionIds: string[];
  currency: string;
  errorMessage?: string;
  onChange: (groupId: string, optionIds: string[]) => void;
}

export const ModifierGroupSelector: React.FC<ModifierGroupSelectorProps> = ({
  group,
  selectedOptionIds,
  currency,
  errorMessage,
  onChange,
}) => {
  const isSingle = group.selection_type === 'single';

  const handleOptionToggle = (optionId: string) => {
    if (isSingle) {
      onChange(group.id, [optionId]);
    } else {
      const exists = selectedOptionIds.includes(optionId);
      if (exists) {
        onChange(
          group.id,
          selectedOptionIds.filter((id) => id !== optionId)
        );
      } else {
        if (group.max_selections > 0 && selectedOptionIds.length >= group.max_selections) {
          return; // Block selection beyond max limit
        }
        onChange(group.id, [...selectedOptionIds, optionId]);
      }
    }
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${errorMessage ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-zinc-950">{group.name}</h4>
            {group.is_required && <Badge variant="warning">Required</Badge>}
          </div>
          {group.description && <p className="text-xs text-zinc-500 mt-0.5">{group.description}</p>}
        </div>

        <span className="text-[11px] text-zinc-500 font-semibold">
          {isSingle
            ? 'Select 1'
            : group.max_selections > 0
            ? `Select up to ${group.max_selections}`
            : 'Select multiple'}
        </span>
      </div>

      {errorMessage && (
        <p className="text-xs font-semibold text-red-700">⚠️ {errorMessage}</p>
      )}

      <div className="space-y-2 pt-1">
        {group.options.map((option) => {
          const isSelected = selectedOptionIds.includes(option.id);
          const isDisabled =
            !option.is_available ||
            (!isSingle &&
              !isSelected &&
              group.max_selections > 0 &&
              selectedOptionIds.length >= group.max_selections);

          return (
            <label
              key={option.id}
              onClick={() => !isDisabled && handleOptionToggle(option.id)}
              className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer text-xs transition-all ${
                isSelected
                  ? 'border-zinc-950 bg-zinc-900/5 font-semibold'
                  : isDisabled
                  ? 'border-zinc-100 bg-zinc-50 opacity-40 cursor-not-allowed'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type={isSingle ? 'radio' : 'checkbox'}
                  name={`group-${group.id}`}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {}} // Handled by label click
                  className="h-4 w-4 accent-zinc-950 cursor-pointer"
                />
                <span className="text-zinc-900 font-medium">{option.name}</span>
              </div>

              <div className="flex items-center gap-2">
                {!option.is_available && (
                  <span className="text-[10px] text-red-600 font-bold uppercase">Unavailable</span>
                )}
                {option.price_cents > 0 && (
                  <span className="font-bold text-zinc-950">
                    +{formatCurrency(option.price_cents, currency)}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

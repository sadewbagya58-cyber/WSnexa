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

function areGroupPropsEqual(
  prev: ModifierGroupSelectorProps,
  next: ModifierGroupSelectorProps
): boolean {
  if (prev.group.id !== next.group.id) return false;
  if (prev.currency !== next.currency) return false;
  if (prev.errorMessage !== next.errorMessage) return false;
  if (prev.selectedOptionIds.length !== next.selectedOptionIds.length) return false;

  for (let i = 0; i < prev.selectedOptionIds.length; i++) {
    if (prev.selectedOptionIds[i] !== next.selectedOptionIds[i]) return false;
  }
  return true;
}

export const ModifierGroupSelector = React.memo(function ModifierGroupSelector({
  group,
  selectedOptionIds,
  currency,
  errorMessage,
  onChange,
}: ModifierGroupSelectorProps) {
  const isSingle = group.selection_type === 'single';
  const availableOptions = (group.options || []).filter((o) => o.is_available);
  const isRequired = group.is_required && availableOptions.length > 0;

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

  // Format selection rule label
  let selectionRuleLabel = '';
  if (isSingle) {
    selectionRuleLabel = isRequired ? 'Choose 1' : 'Optional (Choose 1)';
  } else {
    const min = group.min_selections || 0;
    const max = group.max_selections || 0;
    if (min > 0 && max > 0 && min !== max) {
      const capMax = Math.min(max, Math.max(availableOptions.length, min));
      selectionRuleLabel = `Choose ${min}–${capMax}`;
    } else if (min > 0) {
      selectionRuleLabel = `Choose at least ${min}`;
    } else if (max > 0) {
      const capMax = Math.min(max, availableOptions.length);
      selectionRuleLabel = capMax > 0 ? `Choose up to ${capMax}` : 'Choose optional';
    } else {
      selectionRuleLabel = 'Choose optional';
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        errorMessage ? 'border-red-300 bg-red-50/20' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-zinc-950">{group.name}</h4>
            {isRequired ? (
              <Badge variant="warning">Required</Badge>
            ) : (
              <Badge variant="neutral">Optional</Badge>
            )}
          </div>
          {group.description && (
            <p className="text-xs text-zinc-500 mt-0.5">{group.description}</p>
          )}
        </div>

        <span className="text-[11px] text-zinc-500 font-semibold">{selectionRuleLabel}</span>
      </div>

      {errorMessage && <p className="text-xs font-semibold text-red-700">⚠️ {errorMessage}</p>}

      {group.options.length === 0 || availableOptions.length === 0 ? (
        <div className="text-xs text-zinc-500 italic p-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
          No options currently available for this group.
        </div>
      ) : (
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
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer text-xs select-none touch-manipulation active:scale-[0.99] ${
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
                    onChange={() => !isDisabled && handleOptionToggle(option.id)}
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
      )}
    </div>
  );
}, areGroupPropsEqual);

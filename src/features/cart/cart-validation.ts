import { SelectedModifierSnapshot } from './cart-types';

export interface CatalogModifierOption {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
}

export interface CatalogModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selection_type: string; // 'single' | 'multiple'
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  options: CatalogModifierOption[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  selectedSnapshots: SelectedModifierSnapshot[];
}

/**
 * Validates selected modifier option IDs against public menu catalog modifier groups.
 * Operates on customer-available options to prevent dead-end validation errors when zero options exist.
 */
export function validateItemModifiers(
  modifierGroups: CatalogModifierGroup[] | undefined | null,
  selectedOptionsMap: Record<string, string[]> // groupId -> optionIds[]
): ValidationResult {
  const errors: Record<string, string> = {};
  const selectedSnapshots: SelectedModifierSnapshot[] = [];
  const groups = modifierGroups || [];

  for (const group of groups) {
    const selectedOptionIds = selectedOptionsMap[group.id] || [];

    // Filter for options that are active and available for customer selection
    const availableOptions = (group.options || []).filter((o) => o.is_available);

    // Check for duplicate option IDs in selection
    const uniqueOptionIds = Array.from(new Set(selectedOptionIds));
    if (uniqueOptionIds.length !== selectedOptionIds.length) {
      errors[group.id] = 'Duplicate option selection detected';
      continue;
    }

    const count = uniqueOptionIds.length;

    // Effective minimum cannot exceed the number of available options rendered
    const requiredMin = group.min_selections > 0 ? group.min_selections : group.is_required ? 1 : 0;
    const effectiveMin = Math.min(requiredMin, availableOptions.length);

    // Check requirement & min selections against effective available options count
    if (effectiveMin > 0 && count < effectiveMin) {
      errors[group.id] = effectiveMin === 1 ? 'Choose an option' : `Choose at least ${effectiveMin} options`;
      continue;
    }

    // Check max selections limit
    if (group.max_selections > 0 && count > group.max_selections) {
      errors[group.id] = `Select at most ${group.max_selections} option${group.max_selections > 1 ? 's' : ''}`;
      continue;
    }

    // Check single selection rule
    if (group.selection_type === 'single' && count > 1) {
      errors[group.id] = 'Only one option allowed';
      continue;
    }

    // Validate each selected option belongs to group and is active/available
    for (const optId of uniqueOptionIds) {
      const optionDef = availableOptions.find((o) => o.id === optId);
      if (!optionDef) {
        errors[group.id] = 'Invalid or unavailable option selected';
        break;
      }

      selectedSnapshots.push({
        groupId: group.id,
        groupName: group.name,
        optionId: optionDef.id,
        optionName: optionDef.name,
        additionalPriceCents: optionDef.price_cents || 0,
      });
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    selectedSnapshots,
  };
}

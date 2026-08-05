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
    
    // Check for duplicate option IDs in selection
    const uniqueOptionIds = Array.from(new Set(selectedOptionIds));
    if (uniqueOptionIds.length !== selectedOptionIds.length) {
      errors[group.id] = 'Duplicate option selection detected';
      continue;
    }

    const count = uniqueOptionIds.length;

    // Check requirement & min selections
    if (group.is_required && count === 0) {
      errors[group.id] = `Please select an option for ${group.name}`;
      continue;
    }

    if (group.min_selections > 0 && count < group.min_selections) {
      errors[group.id] = `Please select at least ${group.min_selections} option(s) for ${group.name}`;
      continue;
    }

    // Check max selections
    if (group.max_selections > 0 && count > group.max_selections) {
      errors[group.id] = `You can select at most ${group.max_selections} option(s) for ${group.name}`;
      continue;
    }

    // Check single selection rule
    if (group.selection_type === 'single' && count > 1) {
      errors[group.id] = `Only one option allowed for ${group.name}`;
      continue;
    }

    // Validate each selected option belongs to group and is active/available
    for (const optId of uniqueOptionIds) {
      const optionDef = group.options.find((o) => o.id === optId);
      if (!optionDef) {
        errors[group.id] = `Invalid option selected for ${group.name}`;
        break;
      }

      if (!optionDef.is_available) {
        errors[group.id] = `Option "${optionDef.name}" is currently unavailable`;
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

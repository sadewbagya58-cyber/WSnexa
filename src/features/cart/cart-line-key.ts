import { SelectedModifierSnapshot } from './cart-types';

/**
 * Normalizes special instructions: trims leading/trailing whitespace, collapses repeated spaces.
 */
export function normalizeNotes(notes?: string | null): string {
  if (!notes) return '';
  return notes.trim().replace(/\s+/g, ' ');
}

/**
 * Generates a deterministic stable cart line key.
 * Used to merge identical item configurations while separating different modifiers or notes.
 */
export function generateCartLineKey(
  branchId: string,
  currency: string,
  menuItemId: string,
  selectedModifiers: SelectedModifierSnapshot[],
  specialInstructions?: string | null
): string {
  const sortedOptionIds = selectedModifiers
    .map((m) => m.optionId)
    .sort()
    .join(',');

  const cleanNotes = normalizeNotes(specialInstructions).toLowerCase();

  return `${branchId}:${currency.toUpperCase()}:${menuItemId}:opts[${sortedOptionIds}]:note[${cleanNotes}]`;
}

import { CartLine, SelectedModifierSnapshot } from './cart-types';

/**
 * Calculates line unit price in minor units (cents) with Safe Integer overflow protection.
 */
export function calculateLineUnitPriceCents(
  basePriceCents: number,
  selectedModifiers: SelectedModifierSnapshot[]
): number {
  if (!Number.isSafeInteger(basePriceCents) || basePriceCents < 0) {
    throw new Error('Invalid base price cents');
  }

  let total = basePriceCents;
  for (const mod of selectedModifiers) {
    const addPrice = mod.additionalPriceCents || 0;
    if (!Number.isSafeInteger(addPrice) || addPrice < 0) {
      throw new Error('Invalid modifier option price');
    }
    total += addPrice;
    if (!Number.isSafeInteger(total)) {
      throw new Error('Integer overflow calculating line unit price');
    }
  }

  return total;
}

/**
 * Calculates line total in minor units with Safe Integer check.
 */
export function calculateLineTotalCents(unitPriceCents: number, quantity: number): number {
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Invalid unit price cents');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new Error('Quantity must be an integer between 1 and 99');
  }

  const lineTotal = unitPriceCents * quantity;
  if (!Number.isSafeInteger(lineTotal)) {
    throw new Error('Integer overflow calculating line total');
  }

  return lineTotal;
}

/**
 * Recalculates cart derived invariants: subtotalCents and totalQuantity.
 */
export function calculateCartTotals(lines: CartLine[]): { subtotalCents: number; totalQuantity: number } {
  let subtotalCents = 0;
  let totalQuantity = 0;

  for (const line of lines) {
    const expectedLineTotal = calculateLineTotalCents(line.unitPriceCents, line.quantity);
    if (line.lineTotalCents !== expectedLineTotal) {
      line.lineTotalCents = expectedLineTotal;
    }

    subtotalCents += line.lineTotalCents;
    totalQuantity += line.quantity;

    if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(totalQuantity)) {
      throw new Error('Integer overflow calculating cart totals');
    }
  }

  return { subtotalCents, totalQuantity };
}

/**
 * Formats minor-unit integer cents to currency string using Intl.NumberFormat.
 */
export function formatCurrency(cents: number, currencyCode: string): string {
  const safeCents = Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
  const amount = safeCents / 100;
  const safeCurrency = (currencyCode || 'USD').toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

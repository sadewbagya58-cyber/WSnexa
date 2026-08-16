import { formatCurrency as baseFormatCurrency } from '@/features/cart/cart-calculations';

export function formatCurrency(cents: number, currencyCode = 'USD'): string {
  return baseFormatCurrency(cents, currencyCode);
}

export function formatCurrencyMinor(cents: number, currencyCode = 'USD'): string {
  return baseFormatCurrency(cents, currencyCode);
}

export function getCurrencySymbol(currencyCode = 'USD'): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currencyCode || 'USD').toUpperCase(),
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart?.value || currencyCode;
  } catch {
    return currencyCode;
  }
}

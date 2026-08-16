import { formatCurrency as baseFormatCurrency } from '@/features/cart/cart-calculations';

export function formatCurrency(cents: number, currencyCode = 'USD'): string {
  return baseFormatCurrency(cents, currencyCode);
}

export function formatCurrencyMinor(cents: number, currencyCode = 'USD'): string {
  return baseFormatCurrency(cents, currencyCode);
}

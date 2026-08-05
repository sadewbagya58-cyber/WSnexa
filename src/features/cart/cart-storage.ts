import { CartState, CartLine, ConfirmedTableContext } from './cart-types';
import { calculateCartTotals } from './cart-calculations';

const CART_SCHEMA_VERSION = 1;
const CART_TTL_MS = 4 * 60 * 60 * 1000; // 4 Hours Activity TTL
const MAX_STORAGE_BYTES = 50 * 1024; // 50KB Payload Limit

interface StoredCartPayload {
  version: number;
  branchId: string;
  currency: string;
  confirmedTable: ConfirmedTableContext | null;
  lines: CartLine[];
  updatedAt: string;
  expiresAt: number;
}

export function getCartStorageKey(branchId: string): string {
  return `wsnexa_cart_v1_${branchId}`;
}

/**
 * Saves current cart state to sessionStorage with branch isolation, schema version, and 4-hour TTL.
 */
export function saveCartToStorage(branchId: string, state: CartState): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  if (!branchId || state.branchId !== branchId) return;

  try {
    const expiresAt = Date.now() + CART_TTL_MS;

    // Sanitize table context (NEVER store raw PIN or PIN hash!)
    const safeTable: ConfirmedTableContext | null = state.confirmedTable
      ? {
          branchId: state.confirmedTable.branchId,
          tableId: state.confirmedTable.tableId,
          tableName: state.confirmedTable.tableName,
          tableCode: state.confirmedTable.tableCode,
          verifiedAt: state.confirmedTable.verifiedAt,
        }
      : null;

    const payload: StoredCartPayload = {
      version: CART_SCHEMA_VERSION,
      branchId: state.branchId,
      currency: state.currency.toUpperCase(),
      confirmedTable: safeTable,
      lines: state.lines,
      updatedAt: new Date().toISOString(),
      expiresAt,
    };

    const jsonStr = JSON.stringify(payload);

    // 50KB Payload Safety Limit
    if (new Blob([jsonStr]).size > MAX_STORAGE_BYTES) {
      console.warn('Cart payload exceeds 50KB safety limit. Storage skipped.');
      return;
    }

    sessionStorage.setItem(getCartStorageKey(branchId), jsonStr);
  } catch (err) {
    console.error('Failed to save cart to sessionStorage:', err);
  }
}

/**
 * Loads and validates cart state from sessionStorage. Discards corrupt/expired payloads.
 */
export function loadCartFromStorage(branchId: string, expectedCurrency?: string): CartState | null {
  if (typeof window === 'undefined' || !window.sessionStorage || !branchId) return null;

  const key = getCartStorageKey(branchId);
  const jsonStr = sessionStorage.getItem(key);
  if (!jsonStr) return null;

  try {
    if (new Blob([jsonStr]).size > MAX_STORAGE_BYTES) {
      sessionStorage.removeItem(key);
      return null;
    }

    const payload = JSON.parse(jsonStr) as StoredCartPayload;

    // Strict Validation Checks
    if (!payload || typeof payload !== 'object') return null;
    if (payload.version !== CART_SCHEMA_VERSION) return null;
    if (payload.branchId !== branchId) return null;

    // Expiry Check (4 Hours)
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }

    // Currency Mismatch Check
    if (expectedCurrency && payload.currency.toUpperCase() !== expectedCurrency.toUpperCase()) {
      sessionStorage.removeItem(key);
      return null;
    }

    if (!Array.isArray(payload.lines)) return null;

    // Validate each cart line
    const validLines: CartLine[] = [];
    for (const line of payload.lines) {
      if (
        line &&
        typeof line.lineId === 'string' &&
        typeof line.menuItemId === 'string' &&
        typeof line.itemName === 'string' &&
        Number.isInteger(line.quantity) &&
        line.quantity >= 1 &&
        line.quantity <= 99 &&
        Number.isSafeInteger(line.basePriceCents) &&
        line.basePriceCents >= 0 &&
        Number.isSafeInteger(line.unitPriceCents) &&
        line.unitPriceCents >= 0 &&
        Array.isArray(line.selectedModifiers)
      ) {
        validLines.push(line);
      }
    }

    // Recalculate totals to enforce invariants
    const { subtotalCents, totalQuantity } = calculateCartTotals(validLines);

    return {
      branchId,
      currency: payload.currency.toUpperCase(),
      confirmedTable: payload.confirmedTable || null,
      lines: validLines,
      subtotalCents,
      totalQuantity,
      updatedAt: payload.updatedAt || new Date().toISOString(),
      isHydrated: true,
    };
  } catch (err) {
    console.error('Corrupt cart payload in sessionStorage. Clearing:', err);
    sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * Clears stored cart for a branch.
 */
export function clearCartStorage(branchId: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage || !branchId) return;
  sessionStorage.removeItem(getCartStorageKey(branchId));
}

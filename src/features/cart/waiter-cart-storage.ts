export interface WaiterCartDraftLine {
  lineId: string;
  menuItemId: string;
  itemName: string;
  imageUrl?: string | null;
  quantity: number;
  basePriceCents: number;
  selectedModifiers: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    additionalPriceCents: number;
  }>;
  specialInstructions?: string;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface WaiterCartDraftState {
  businessId: string;
  branchId: string;
  userId?: string;
  selectedAreaId: string;
  selectedTableId: string;
  orderNotes: string;
  cart: WaiterCartDraftLine[];
  updatedAt: number;
}

export function getWaiterCartStorageKey(
  businessId: string,
  branchId: string,
  userId?: string
): string {
  const userPart = userId ? `:${userId}` : '';
  return `wsnexa_waiter_cart:${businessId}:${branchId}${userPart}`;
}

export function saveWaiterCartToStorage(state: WaiterCartDraftState): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const key = getWaiterCartStorageKey(state.businessId, state.branchId, state.userId);
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save waiter cart to sessionStorage:', err);
  }
}

export function loadWaiterCartFromStorage(
  businessId: string,
  branchId: string,
  userId?: string
): WaiterCartDraftState | null {
  if (typeof window === 'undefined' || !window.sessionStorage || !businessId || !branchId) {
    return null;
  }
  try {
    const key = getWaiterCartStorageKey(businessId, branchId, userId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiterCartDraftState;
    if (parsed.businessId === businessId && parsed.branchId === branchId) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Failed to load waiter cart from sessionStorage:', err);
    return null;
  }
}

export function clearWaiterCartStorage(
  businessId: string,
  branchId: string,
  userId?: string
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const key = getWaiterCartStorageKey(businessId, branchId, userId);
    window.sessionStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear waiter cart storage:', err);
  }
}

export function hasActiveWaiterCartItems(
  businessId: string,
  branchId: string,
  userId?: string
): boolean {
  const loaded = loadWaiterCartFromStorage(businessId, branchId, userId);
  return Boolean(loaded && loaded.cart && loaded.cart.length > 0);
}

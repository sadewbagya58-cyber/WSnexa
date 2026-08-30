'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  ReactNode,
} from 'react';
import { CartState, CartLine, ConfirmedTableContext, SelectedModifierSnapshot } from './cart-types';
import { generateCartLineKey, normalizeNotes } from './cart-line-key';
import { calculateLineUnitPriceCents, calculateLineTotalCents, calculateCartTotals } from './cart-calculations';
import { saveCartToStorage, loadCartFromStorage, clearCartStorage } from './cart-storage';
import type { LoyaltyRewardRecord } from '@/server/services/loyalty.service';

export type { CartState, CartLine, ConfirmedTableContext, SelectedModifierSnapshot };

export type CartAction =
  | { type: 'HYDRATE_CART'; payload: CartState }
  | {
      type: 'ADD_LINE';
      payload: {
        menuItemId: string;
        itemName: string;
        imageUrl?: string | null;
        quantity: number;
        basePriceCents: number;
        selectedModifiers: SelectedModifierSnapshot[];
        specialInstructions?: string;
      };
    }
  | { type: 'UPDATE_LINE_QUANTITY'; payload: { lineId: string; quantity: number } }
  | {
      type: 'EDIT_LINE';
      payload: {
        oldLineId: string;
        quantity: number;
        selectedModifiers: SelectedModifierSnapshot[];
        specialInstructions?: string;
      };
    }
  | { type: 'REMOVE_LINE'; payload: { lineId: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_TABLE_CONTEXT'; payload: ConfirmedTableContext | null }
  | { type: 'SET_SELECTED_REWARD'; payload: LoyaltyRewardRecord | null }
  | { type: 'SET_QR_VISIT_SESSION_TOKEN'; payload: string | null };

export const initialCartState: CartState = {
  branchId: '',
  currency: 'USD',
  confirmedTable: null,
  selectedReward: null,
  lines: [],
  subtotalCents: 0,
  totalQuantity: 0,
  updatedAt: new Date().toISOString(),
  isHydrated: false,
};

export function cartReducer(state: CartState, action: CartAction): CartState {
  let nextState: CartState;

  switch (action.type) {
    case 'HYDRATE_CART': {
      return { ...action.payload, isHydrated: true };
    }

    case 'ADD_LINE': {
      const { menuItemId, itemName, imageUrl, quantity, basePriceCents, selectedModifiers, specialInstructions } = action.payload;

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return state;
      }

      const cleanNotes = normalizeNotes(specialInstructions);
      const lineKey = generateCartLineKey(state.branchId, state.currency, menuItemId, selectedModifiers, cleanNotes);

      const unitPriceCents = calculateLineUnitPriceCents(basePriceCents, selectedModifiers);

      const existingIndex = state.lines.findIndex((l) => l.lineId === lineKey);

      let newLines: CartLine[];

      if (existingIndex >= 0) {
        // Merge quantity with existing line (up to max 99)
        newLines = state.lines.map((line, idx) => {
          if (idx === existingIndex) {
            const mergedQuantity = Math.min(99, line.quantity + quantity);
            const lineTotalCents = calculateLineTotalCents(line.unitPriceCents, mergedQuantity);
            return {
              ...line,
              quantity: mergedQuantity,
              lineTotalCents,
            };
          }
          return line;
        });
      } else {
        // Create new cart line
        const lineTotalCents = calculateLineTotalCents(unitPriceCents, quantity);
        const newLine: CartLine = {
          lineId: lineKey,
          menuItemId,
          itemName,
          imageUrl: imageUrl || null,
          quantity,
          basePriceCents,
          selectedModifiers,
          specialInstructions: cleanNotes || undefined,
          unitPriceCents,
          lineTotalCents,
        };
        newLines = [...state.lines, newLine];
      }

      const { subtotalCents, totalQuantity } = calculateCartTotals(newLines);

      nextState = {
        ...state,
        lines: newLines,
        subtotalCents,
        totalQuantity,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'UPDATE_LINE_QUANTITY': {
      const { lineId, quantity } = action.payload;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return state;
      }

      const newLines = state.lines.map((line) => {
        if (line.lineId === lineId) {
          const lineTotalCents = calculateLineTotalCents(line.unitPriceCents, quantity);
          return { ...line, quantity, lineTotalCents };
        }
        return line;
      });

      const { subtotalCents, totalQuantity } = calculateCartTotals(newLines);

      nextState = {
        ...state,
        lines: newLines,
        subtotalCents,
        totalQuantity,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'EDIT_LINE': {
      const { oldLineId, quantity, selectedModifiers, specialInstructions } = action.payload;
      const targetLine = state.lines.find((l) => l.lineId === oldLineId);
      if (!targetLine) return state;

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return state;
      }

      const cleanNotes = normalizeNotes(specialInstructions);
      const newLineKey = generateCartLineKey(
        state.branchId,
        state.currency,
        targetLine.menuItemId,
        selectedModifiers,
        cleanNotes
      );

      const unitPriceCents = calculateLineUnitPriceCents(targetLine.basePriceCents, selectedModifiers);
      const lineTotalCents = calculateLineTotalCents(unitPriceCents, quantity);

      // Remove the old line and check if edited line merges with an existing line
      const otherLines = state.lines.filter((l) => l.lineId !== oldLineId);
      const existingSameKeyIndex = otherLines.findIndex((l) => l.lineId === newLineKey);

      let updatedLines: CartLine[];
      if (existingSameKeyIndex >= 0) {
        updatedLines = otherLines.map((line, idx) => {
          if (idx === existingSameKeyIndex) {
            const mergedQuantity = Math.min(99, line.quantity + quantity);
            return {
              ...line,
              quantity: mergedQuantity,
              lineTotalCents: calculateLineTotalCents(line.unitPriceCents, mergedQuantity),
            };
          }
          return line;
        });
      } else {
        const replacementLine: CartLine = {
          lineId: newLineKey,
          menuItemId: targetLine.menuItemId,
          itemName: targetLine.itemName,
          imageUrl: targetLine.imageUrl,
          quantity,
          basePriceCents: targetLine.basePriceCents,
          selectedModifiers,
          specialInstructions: cleanNotes || undefined,
          unitPriceCents,
          lineTotalCents,
        };
        updatedLines = [...otherLines, replacementLine];
      }

      const { subtotalCents, totalQuantity } = calculateCartTotals(updatedLines);

      nextState = {
        ...state,
        lines: updatedLines,
        subtotalCents,
        totalQuantity,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'REMOVE_LINE': {
      const newLines = state.lines.filter((l) => l.lineId !== action.payload.lineId);
      const { subtotalCents, totalQuantity } = calculateCartTotals(newLines);

      nextState = {
        ...state,
        lines: newLines,
        subtotalCents,
        totalQuantity,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'CLEAR_CART': {
      if (typeof window !== 'undefined') {
        clearCartStorage(state.branchId);
      }
      nextState = {
        ...initialCartState,
        branchId: state.branchId,
        currency: state.currency,
        confirmedTable: state.confirmedTable,
        qrVisitSessionToken: state.qrVisitSessionToken,
        isHydrated: true,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'SET_TABLE_CONTEXT': {
      nextState = {
        ...state,
        confirmedTable: action.payload,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'SET_SELECTED_REWARD': {
      nextState = {
        ...state,
        selectedReward: action.payload,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    case 'SET_QR_VISIT_SESSION_TOKEN': {
      nextState = {
        ...state,
        qrVisitSessionToken: action.payload,
        updatedAt: new Date().toISOString(),
      };
      break;
    }

    default:
      return state;
  }

  return nextState;
}

export interface CartActions {
  addLine: (item: {
    menuItemId: string;
    itemName: string;
    imageUrl?: string | null;
    quantity: number;
    basePriceCents: number;
    selectedModifiers: SelectedModifierSnapshot[];
    specialInstructions?: string;
  }) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  editLine: (
    oldLineId: string,
    quantity: number,
    selectedModifiers: SelectedModifierSnapshot[],
    specialInstructions?: string
  ) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  setConfirmedTable: (table: ConfirmedTableContext | null) => void;
  setSelectedReward: (reward: LoyaltyRewardRecord | null) => void;
  setQrVisitSessionToken: (token: string | null) => void;
}

export interface CartContextValue extends CartActions {
  state: CartState;
}

export interface CartStore {
  getState: () => CartState;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: CartAction) => void;
  actions: CartActions;
}

const CartStoreContext = createContext<CartStore | null>(null);

export const CartProvider: React.FC<{
  branchId: string;
  currency: string;
  qrVisitSessionToken?: string | null;
  children: ReactNode;
}> = ({ branchId, currency, qrVisitSessionToken, children }) => {
  const storeRef = useRef<CartStore | null>(null);

  if (!storeRef.current) {
    let state: CartState = {
      ...initialCartState,
      branchId,
      currency: currency.toUpperCase(),
      qrVisitSessionToken: qrVisitSessionToken || null,
    };
    const listeners = new Set<() => void>();

    const getState = () => state;

    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };

    const notify = () => {
      for (const listener of listeners) {
        listener();
      }
    };

    const dispatch = (action: CartAction) => {
      const nextState = cartReducer(state, action);
      if (nextState !== state) {
        state = nextState;
        if (typeof window !== 'undefined' && state.isHydrated) {
          saveCartToStorage(state.branchId, state);
        }
        notify();
      }
    };

    const actions: CartActions = {
      addLine: (item) => dispatch({ type: 'ADD_LINE', payload: item }),
      updateQuantity: (lineId, quantity) => dispatch({ type: 'UPDATE_LINE_QUANTITY', payload: { lineId, quantity } }),
      editLine: (oldLineId, quantity, selectedModifiers, specialInstructions) =>
        dispatch({ type: 'EDIT_LINE', payload: { oldLineId, quantity, selectedModifiers, specialInstructions } }),
      removeLine: (lineId) => dispatch({ type: 'REMOVE_LINE', payload: { lineId } }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      setConfirmedTable: (table) => dispatch({ type: 'SET_TABLE_CONTEXT', payload: table }),
      setSelectedReward: (reward) => dispatch({ type: 'SET_SELECTED_REWARD', payload: reward }),
      setQrVisitSessionToken: (token) => dispatch({ type: 'SET_QR_VISIT_SESSION_TOKEN', payload: token }),
    };

    storeRef.current = {
      getState,
      subscribe,
      dispatch,
      actions,
    };
  }

  const store = storeRef.current;

  // Restore cart state from sessionStorage on mount (Hydration safety)
  useEffect(() => {
    const loaded = loadCartFromStorage(branchId, currency);
    if (loaded) {
      const merged = {
        ...loaded,
        qrVisitSessionToken: qrVisitSessionToken || loaded.qrVisitSessionToken || null,
      };
      store.dispatch({ type: 'HYDRATE_CART', payload: merged });
    } else {
      store.dispatch({
        type: 'HYDRATE_CART',
        payload: {
          ...initialCartState,
          branchId,
          currency: currency.toUpperCase(),
          qrVisitSessionToken: qrVisitSessionToken || null,
          isHydrated: true,
        },
      });
    }
  }, [branchId, currency, qrVisitSessionToken, store]);

  return <CartStoreContext.Provider value={store}>{children}</CartStoreContext.Provider>;
};

/**
 * Hook to access stable Cart action functions without subscribing to state updates.
 * Components using this hook will NEVER re-render on cart mutations!
 */
export function useCartActions(): CartActions {
  const store = useContext(CartStoreContext);
  if (!store) {
    throw new Error('useCartActions must be used within a CartProvider');
  }
  return store.actions;
}

/**
 * Hook to subscribe ONLY to the quantity of a specific menu item.
 * Skips re-renders for all other items in the menu!
 */
export function useItemCartQuantity(menuItemId: string): number {
  const store = useContext(CartStoreContext);
  if (!store) return 0;

  return useSyncExternalStore(
    store.subscribe,
    () => {
      const state = store.getState();
      let total = 0;
      for (let i = 0; i < state.lines.length; i++) {
        if (state.lines[i].menuItemId === menuItemId) {
          total += state.lines[i].quantity;
        }
      }
      return total;
    },
    () => 0
  );
}

/**
 * Hook to subscribe ONLY to confirmed table context.
 */
export function useConfirmedTable(): ConfirmedTableContext | null {
  const store = useContext(CartStoreContext);
  if (!store) return null;

  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().confirmedTable,
    () => null
  );
}

/**
 * Hook to subscribe ONLY to cart total quantity (e.g. for header cart icon).
 */
export function useCartTotalQuantity(): number {
  const store = useContext(CartStoreContext);
  if (!store) return 0;

  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().totalQuantity,
    () => 0
  );
}

const DEFAULT_SUMMARY = { totalQuantity: 0, subtotalCents: 0, isHydrated: false };

/**
 * Hook to subscribe ONLY to cart summary (totalQuantity, subtotalCents, isHydrated).
 */
export function useCartSummary(): { totalQuantity: number; subtotalCents: number; isHydrated: boolean } {
  const store = useContext(CartStoreContext);
  const cacheRef = useRef<{ totalQuantity: number; subtotalCents: number; isHydrated: boolean }>(DEFAULT_SUMMARY);

  const subscribe = store ? store.subscribe : () => () => {};
  const getSnapshot = () => {
    if (!store) return DEFAULT_SUMMARY;
    const state = store.getState();
    const curr = cacheRef.current;
    if (
      curr.totalQuantity === state.totalQuantity &&
      curr.subtotalCents === state.subtotalCents &&
      curr.isHydrated === state.isHydrated
    ) {
      return curr;
    }
    const next = {
      totalQuantity: state.totalQuantity,
      subtotalCents: state.subtotalCents,
      isHydrated: state.isHydrated,
    };
    cacheRef.current = next;
    return next;
  };
  const getServerSnapshot = () => DEFAULT_SUMMARY;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Complete useCart hook (backwards compatible for CartDrawer).
 */
export function useCart(): CartContextValue {
  const store = useContext(CartStoreContext);
  if (!store) {
    throw new Error('useCart must be used within a CartProvider');
  }

  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    () => initialCartState
  );

  return useMemo(
    () => ({
      state,
      ...store.actions,
    }),
    [state, store.actions]
  );
}

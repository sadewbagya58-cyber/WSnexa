'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { CartState, CartLine, ConfirmedTableContext, SelectedModifierSnapshot } from './cart-types';
import { generateCartLineKey, normalizeNotes } from './cart-line-key';
import { calculateLineUnitPriceCents, calculateLineTotalCents, calculateCartTotals } from './cart-calculations';
import { saveCartToStorage, loadCartFromStorage, clearCartStorage } from './cart-storage';
import type { LoyaltyRewardRecord } from '@/server/services/loyalty.service';

type CartAction =
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

const initialCartState: CartState = {
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

function cartReducer(state: CartState, action: CartAction): CartState {
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
      const newLineKey = generateCartLineKey(state.branchId, state.currency, targetLine.menuItemId, selectedModifiers, cleanNotes);
      const unitPriceCents = calculateLineUnitPriceCents(targetLine.basePriceCents, selectedModifiers);

      // Check if new configuration matches ANOTHER existing line
      const otherMatchingLineIndex = state.lines.findIndex((l) => l.lineId === newLineKey && l.lineId !== oldLineId);

      let newLines: CartLine[];

      if (otherMatchingLineIndex >= 0) {
        // Merge with that existing line & remove old line
        newLines = state.lines
          .filter((l) => l.lineId !== oldLineId)
          .map((line) => {
            if (line.lineId === newLineKey) {
              const mergedQuantity = Math.min(99, line.quantity + quantity);
              const lineTotalCents = calculateLineTotalCents(unitPriceCents, mergedQuantity);
              return {
                ...line,
                quantity: mergedQuantity,
                selectedModifiers,
                specialInstructions: cleanNotes || undefined,
                unitPriceCents,
                lineTotalCents,
              };
            }
            return line;
          });
      } else {
        // Simply update existing line
        const lineTotalCents = calculateLineTotalCents(unitPriceCents, quantity);
        newLines = state.lines.map((line) => {
          if (line.lineId === oldLineId) {
            return {
              ...line,
              lineId: newLineKey,
              quantity,
              selectedModifiers,
              specialInstructions: cleanNotes || undefined,
              unitPriceCents,
              lineTotalCents,
            };
          }
          return line;
        });
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
      clearCartStorage(state.branchId);
      nextState = {
        ...state,
        lines: [],
        subtotalCents: 0,
        totalQuantity: 0,
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

  // Persist to sessionStorage on state mutation
  if (nextState.isHydrated && nextState.branchId) {
    saveCartToStorage(nextState.branchId, nextState);
  }

  return nextState;
}

interface CartContextValue {
  state: CartState;
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

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{
  branchId: string;
  currency: string;
  qrVisitSessionToken?: string | null;
  children: ReactNode;
}> = ({ branchId, currency, qrVisitSessionToken, children }) => {
  const [state, dispatch] = useReducer(cartReducer, {
    ...initialCartState,
    branchId,
    currency: currency.toUpperCase(),
  });

  // Restore cart state from sessionStorage on mount (Hydration safety)
  useEffect(() => {
    const loaded = loadCartFromStorage(branchId, currency);
    if (loaded) {
      const merged = {
        ...loaded,
        qrVisitSessionToken: qrVisitSessionToken || loaded.qrVisitSessionToken || null,
      };
      dispatch({ type: 'HYDRATE_CART', payload: merged });
    } else {
      dispatch({
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
  }, [branchId, currency, qrVisitSessionToken]);

  const addLine = useCallback((item: {
    menuItemId: string;
    itemName: string;
    imageUrl?: string | null;
    quantity: number;
    basePriceCents: number;
    selectedModifiers: SelectedModifierSnapshot[];
    specialInstructions?: string;
  }) => {
    dispatch({ type: 'ADD_LINE', payload: item });
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_LINE_QUANTITY', payload: { lineId, quantity } });
  }, []);

  const editLine = useCallback((
    oldLineId: string,
    quantity: number,
    selectedModifiers: SelectedModifierSnapshot[],
    specialInstructions?: string
  ) => {
    dispatch({
      type: 'EDIT_LINE',
      payload: { oldLineId, quantity, selectedModifiers, specialInstructions },
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    dispatch({ type: 'REMOVE_LINE', payload: { lineId } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const setConfirmedTable = useCallback((table: ConfirmedTableContext | null) => {
    dispatch({ type: 'SET_TABLE_CONTEXT', payload: table });
  }, []);

  const setSelectedReward = useCallback((reward: LoyaltyRewardRecord | null) => {
    dispatch({ type: 'SET_SELECTED_REWARD', payload: reward });
  }, []);

  const setQrVisitSessionToken = useCallback((token: string | null) => {
    dispatch({ type: 'SET_QR_VISIT_SESSION_TOKEN', payload: token });
  }, []);

  const contextValue = useMemo<CartContextValue>(
    () => ({
      state,
      addLine,
      updateQuantity,
      editLine,
      removeLine,
      clearCart,
      setConfirmedTable,
      setSelectedReward,
      setQrVisitSessionToken,
    }),
    [
      state,
      addLine,
      updateQuantity,
      editLine,
      removeLine,
      clearCart,
      setConfirmedTable,
      setSelectedReward,
      setQrVisitSessionToken,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}

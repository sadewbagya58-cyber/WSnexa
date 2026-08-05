# Phase 9: Guest Cart Architecture & Lifecycle

This document describes the client-side cart architecture implemented for WSNexa guest digital menus (`/m/[token]`).

---

## 1. Overview

The guest cart is a high-performance, client-side state engine designed for mobile and desktop dining experiences.
- **Client-Side State:** Built using React Context and pure reducer state management.
- **No Database Mutation:** Phase 9 creates zero database order records and requires no database migrations.
- **Untrusted Display Snapshot:** Cart lines, subtotals, quantities, notes, and table context are treated as untrusted display snapshots. Phase 10 checkout will revalidate prices, availability, and table context server-side atomically.

---

## 2. Storage & Expiry Lifecycle

- **Storage Engine:** `sessionStorage` with key `wsnexa_cart_v1_${branchId}`.
- **Branch & Currency Isolation:** Cart payloads are scoped to the active branch ID and currency. Browsing another branch or currency clears mismatched storage.
- **Activity TTL:** 4-hour activity-based expiry TTL. Any cart mutation updates `updatedAt` and refreshes `expiresAt`.
- **Payload Safety:** Enforces a 50KB payload size limit and strict JSON schema parsing. Discards corrupt or oversized payloads safely.
- **Hydration Safety:** `CartProvider` restores storage after component mount (`useEffect`) to prevent SSR hydration mismatches or flashing empty cart states.

---

## 3. Cart Line Deterministic Identity

Cart lines use a deterministic stable key:
```
${branchId}:${currency}:${menuItemId}:opts[${sortedOptionIds}]:note[${normalizedNotes}]
```
- **Merging Identical Configurations:** Adding an item with identical modifiers and notes merges line quantities up to a maximum of 99.
- **Line Editing:** Editing a line into an existing configuration merges both lines into a single row and removes the duplicate old line.

---

## 4. Reducer Invariants & Safe Integers

Every reducer mutation recalculates derived invariants using pure calculation helpers:
- `subtotalCents === sum(lineTotalCents)`
- `totalQuantity === sum(quantity)`
- **Minor-Unit Integer Math:** Prices and totals are computed in integer cents with `Number.isSafeInteger()` overflow protection.
- **Quantity Bounds:** Restricted strictly between 1 and 99. Rejects zero, negative values, decimals, `NaN`, `Infinity`, or values > 99.

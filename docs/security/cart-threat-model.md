# Cart Security Threat Model & Validation Responsibilities

This document outlines the security boundaries and Phase 10 server-side revalidation requirements.

---

## 1. Client Cart Untrusted Snapshot Principle

The Phase 9 client-side cart operates entirely in browser memory and `sessionStorage`. All client cart payloads are treated as **untrusted user input**.

| Potential Threat / Vector | Client Defense (Phase 9) | Server Revalidation (Phase 10 Requirement) |
| :--- | :--- | :--- |
| **Manipulated Line Prices** | Minor-unit calculations with `Number.isSafeInteger()` | Database price recalculation from `menu_items` & `modifier_options` |
| **Manipulated Subtotal** | Reducer invariant enforcement (`subtotalCents === sum(lineTotal)`) | Total recalculation from authoritative catalog prices |
| **Out-of-Stock Item Injection** | Disabled in UI & validated in customization sheet | Server recheck of `availability_status !== 'out_of_stock'` |
| **Cross-Item / Inactive Option Injection** | `validateItemModifiers` validates options against catalog payload | Database revalidation of modifier option existence, status, & pricing |
| **Special Instructions XSS** | Cleaned string input, max 250 chars, no `dangerouslySetInnerHTML` | Server-side string sanitization & HTML escaping |
| **Stale / Spoofed Table Context** | Branch scoping & verified table context | Server-side table validation & short-lived PIN proof recheck |

---

## 2. Table PIN & Secret Protection

- **Plain PINs:** NEVER stored in `sessionStorage`, localStorage, cookies, audit logs, or public responses.
- **PIN Hashes:** Stored server-side in `dining_tables.table_pin_hash` via HMAC-SHA-256 with server pepper `TABLE_PIN_PEPPER`. Never sent to client code.
- **Client Table Context:** Contains only non-sensitive metadata: `branchId`, `tableId`, `tableName`, `tableCode`, `verifiedAt`.

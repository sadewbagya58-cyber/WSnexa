# Phase 37 — Final UX Acceptance & System Closure

## 1. Executive Summary & Design Principle

WSNexa is designed to be:
> **"Powerful underneath. Simple on the surface."**

Phase 37 consolidates the entire tenant operational platform across:
- **Simplified 10-Item Primary Navigation** (zero sidebar bloat, high signal-to-noise ratio).
- **Secondary Hub Discoverability** (Settings, Team, Operations, Customers).
- **Role-Aware Operational Workspaces** (direct role landings for Cashier, Kitchen, Waiter; intelligent fallback workspace for custom roles).
- **Hardened Inventory Subnavigation & Route Security** (`inventory.view` read-only isolation, settings management route-gating).
- **Persistent Staff Invitation Code Copy with AES-256-GCM Encryption** (repeated copying for pending valid invites, cryptographic lockdown upon claim/expiry/revocation).
- **Full Mobile Responsiveness** (320px - 430px, touch targets $\ge 44$px, drawer branch switcher, zero horizontal scroll).
- **Realtime Operational Flow** (QR guest order $\rightarrow$ Waiter approval $\rightarrow$ Kitchen display queue $\rightarrow$ Cashier settlement).

---

## 2. Information Architecture & Canonical Navigation

### A. Primary Navigation (10 Canonical Items)
1. **Dashboard** (`/dashboard`): Today's performance, operations shortcuts, setup progress, needs attention.
2. **Orders** (`/dashboard/orders`): Order management, POS, kitchen, waiter assistance.
3. **Menu** (`/dashboard/menu`): Menu catalog, items, categories, modifier groups.
4. **Dining & QR** (`/dashboard/dining`): Table layout, service areas, QR codes, table PINs.
5. **Reservations** (`/dashboard/reservations`): Guest bookings, calendar, table allocations.
6. **Customers** (`/dashboard/customers`): Customer directory, profiles, reviews, reputation, loyalty.
7. **Operations** (`/dashboard/inventory`): Stock items, physical counts, recipes & batch production, purchasing & receiving, stock transfers, suppliers, storage locations, waste tracking, inventory policies.
8. **Team** (`/dashboard/team`): Staff directory, organization hierarchy, custom roles & permissions, access diagnostics, staff invitations.
9. **Reports** (`/dashboard/reports`): Sales summaries, hourly heatmaps, revenue time series, financial analytics.
10. **Settings** (`/dashboard/settings`): Business profile, branch management, venue discovery profile, order security & anti-fraud, branch payment methods, SaaS subscription & billing.

### B. Secondary Sub-Navigation Systems
- **SettingsSubNav**: Business Profile, Branch Management, Venue Profile, Order Security, Payments, Subscription (Owner-only).
- **TeamSubNav**: Team Directory, Staff Invitations, Organization & Hierarchy, Roles & Templates, Scope Grants, Access Diagnostics.
- **InventorySubNav**: Overview, Stock Items, Physical Counts, Recipes, Purchasing, Receiving, Transfers, Suppliers, Locations, Waste, Settings (Gated on `inventory.settings.manage`).
- **CRMSubNav**: Directory & Profiles, Guest Reviews, Reputation Management, Loyalty Program.

---

## 3. Role-Aware Workspace Matrix & Landing Behavior

| Role | Landing Route | Visible Primary Hubs | Restrictions & Gating |
|---|---|---|---|
| **Business Owner** | `/dashboard` | All 10 Hubs | Full administrative & financial access across all branches; Subscription & Billing card visible. |
| **Branch Manager** | `/dashboard` | Orders, Menu, Dining, Reservations, Customers, Operations, Team, Reports, Settings | Branch-scoped operations; cannot view SaaS billing/subscription; cannot access cross-branch data. |
| **Cashier (Built-in)** | `/dashboard/cashier` | Orders (or direct POS workspace) | Dedicated point-of-sale interface; payment settlement with canonical `p_actor_id`. |
| **Kitchen Staff (Built-in)** | `/dashboard/kitchen` | Orders / Kitchen Queue | Realtime kitchen display queue; sorted newest-first; item modifier breakdown. |
| **Waiter (Built-in)** | `/dashboard/waiter` | Orders / Waiter Center | Realtime assistance requests; table-scoped order approval; service area isolation. |
| **Restricted Custom Role** | `/dashboard` (or Fallback Workspace) | Dynamically filtered based on exact permission capabilities | Custom role users land on `/dashboard`; non-accessible hubs collapse; single/multi-destination fallback cards displayed if first view is restricted. |

---

## 4. Staff Invitation Lifecycle & AES-256-GCM Cryptographic Design

### A. Security Problem & Audit Findings
- Previously, `staff_invitations` stored only a one-way SHA-256 hash (`token_hash`) and a masked prefix (`token_prefix`).
- Plaintext invitation tokens could not be re-copied after modal dismissal.
- Storing plaintext in the database would create an unacceptable security vulnerability.

### B. Cryptographic Architecture
- **Encryption Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data).
- **Key Derivation**: 32-byte master key derived from environment secret (`INVITATION_ENCRYPTION_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
- **Storage Format**: `iv_hex:auth_tag_hex:ciphertext_hex` stored in `public.staff_invitations.encrypted_code`.
- **Decryption Protocol**:
  - Only authenticated, authorized staff managers (`business_owner`, `staff.invite`) accessing `/dashboard/team/invites` trigger on-demand decryption.
  - Decryption is executed **exclusively** for invitations in `status = 'pending'` where `expires_at > now()`.
  - Claimed, expired, or revoked invitations return `rawCode: null` and display `(Code unavailable)` with no copy action.
- **Constant-Time Verification**: Guest token redemption still computes SHA-256 hash against indexed `token_hash`, ensuring $O(1)$ constant-time lookup without database-wide decryption.

---

## 5. Verification & Test Suite Summary

- `scripts/verify-phase37-final.ts`: **33 / 33 PASSED**
- `scripts/verify-phase37-step4-ux.ts`: **53 / 53 PASSED**
- `scripts/verify-phase37-step3-closure.ts`: **17 / 17 PASSED**
- `scripts/verify-phase37-dashboard.ts`: **82 / 82 PASSED**
- `scripts/verify-phase37-navigation.ts`: **63 / 63 PASSED**
- `scripts/verify-phase31-role-aware-navigation.ts`: **42 / 42 PASSED**
- `scripts/verify-phase31-navigation-ia.ts`: **60 / 60 PASSED**

---

## 6. Migration Policy & Readiness

- **Migration File**: `supabase/migrations/20260828000000_phase37_staff_invitation_encrypted_code.sql`
- **SQL Action**: `ALTER TABLE public.staff_invitations ADD COLUMN encrypted_code TEXT;`
- **Safety**: Fully backward-compatible; idempotent `IF NOT EXISTS`; non-destructive.
- **Production Status**: `READY FOR MIGRATION` (apply SQL in Supabase console or migration runner).

# WSNexa — Phase 37 Step 4: Language, Forms & Interaction UX Cleanup

## Overview & Philosophy
Phase 37 Step 4 delivers comprehensive UX, language, and interaction simplification across WSNexa, guided by the principle:
> **"Powerful underneath. Simple on the surface."**

The application feels clear and natural to a single café owner while retaining enterprise-grade power and flexibility for multi-property hotels and resorts.

---

## 1. Product Language & Microcopy Audit

Replaced internal database, security, and architectural jargon across user-facing pages, labels, error states, and tooltips:

| Internal / Technical Jargon | User-Facing Replaced Phrasing | Module / Component |
| :--- | :--- | :--- |
| `RBAC & Scope V2 Access Control Hub` | `Roles & Permissions Hub` | `src/components/access/access-hub-overview.tsx` |
| `Tenant Defined` | `Custom Defined` | `src/components/access/access-hub-overview.tsx` |
| `RBAC V2 Access Summary` | `Role & Permissions Summary` | `src/components/access/staff-access-summary-widget.tsx` |
| `Max Scope Ceiling` / `Scope Ceiling` | `Maximum Access Limit` / `Default Access Level` | `src/components/access/built-in-roles-view.tsx`, `role-editor-modal.tsx`, `access/roles/[roleId]/page.tsx` |
| `Permission Key (WHAT)` | `Permission / Capability` | `src/components/access/member-override-modal.tsx`, `scope-grant-manager.tsx`, `access-diagnostics-client.tsx` |
| `Canonical server-calculated quote` | `Verified calculated price` | `src/components/subscription/subscription-checkout-review-client.tsx` |
| `multi-tenant operating system` | `hospitality workspace` | `src/components/onboarding/onboarding-wizard.tsx` |
| `Core multi-tenant business identity` | `Core business profile` | `src/app/(dashboard)/dashboard/business/page.tsx` |
| `selecting a different property scope` | `selecting a different location` | `src/components/organization/people-directory-client.tsx` |
| `Expands property scope reach` | `Expands access to host branch` | `src/components/access/member-access-detail-client.tsx` |
| `No Workspace Access` (blank/cryptic) | Friendly guidance with direct instructions to contact owner/manager | `src/components/dashboard/dashboard-fallback-workspace.tsx` |
| Raw permission codes (`roles.view`, `customers.view`, `reputation.view`) | Descriptive human-readable messages ("You do not have permission to view guest profiles") | `src/app/(dashboard)/dashboard/access/`, `customers/`, `reputation/` |

---

## 2. Action Verb Standards & Button Hierarchy

Standardized all primary, secondary, and destructive actions into unambiguous verbs without decorative emojis (`✓`, `⚡`, `↩️`):

### Standard Action Verbs
- **Creation Actions**: `Add Menu Item`, `Create Role`, `Send Invite`, `Create Table`, `Create Area`, `Create Reservation`, `Add Ingredient`, `Save Location`, `Save Supplier`, `Create Branch`.
- **Mutation & Save Actions**: `Save Changes`, `Save Settings`, `Save PIN`, `Save Adjustment`, `Record Waste`, `Record Supplier Return`, `Receive Delivery`, `Dispatch Batch`, `Receive Stock`.
- **Loading & Pending States**:
  - `Saving…`
  - `Sending…`
  - `Receiving Stock…`
  - `Generating Tables…`
  - `Archiving…`
  - `Approving…`
  - `Declining…`
  - `Seating…`
  - `Adding…`
- **Secondary Actions**: `Cancel` (explicit secondary button on every modal and creation flow).
- **Destructive Actions**: `Archive Role`, `Delete Table`, `Revoke`, `Decline Booking` (all styled in rose/amber tones with clear consequence explanations).

---

## 3. Form Simplifications & Progressive Disclosure

### A. Menu Item Form (`src/components/menu/create-item-form.tsx`)
- Standardized submit CTA to `Add Menu Item` with loading feedback `Saving…`.
- Replaced raw permission code tooltip on price editing with user-friendly copy: *"Price editing requires menu price management permissions."*
- Added explicit secondary `Cancel` button returning to the menu items list.

### B. Dining Areas & Tables (`src/components/table/`)
- `create-table-form.tsx`: Clear primary `Create Table` (`Saving…`) + `Cancel`.
- `bulk-generator-form.tsx`: Removed `⚡` emoji, standardized to `Generate {count} Tables` (`Generating Tables…`) + `Cancel`.
- `area-manager.tsx`: Standardized `Create Area` + `Cancel`.
- `table-grid.tsx`: Removed emojis from PIN modal buttons (`Copy PIN`, `Print PIN Sticker`, `Close`), and added loading states (`Saving…`).

### C. Inventory Item Form (`src/components/inventory/inventory-item-form.tsx`)
- Standardized submit CTA to `Add Ingredient` with `Saving…` state.
- Progressive disclosure: Essential fields (Name, Category, Unit, Cost, Initial Stock, Storage Location) visible immediately. Advanced attributes (SKU, Barcode, Description, Batch/Expiry tracking) collapsible under "Advanced Details".

### D. Reservations & Guest Bookings (`src/components/reservations/reservation-management-client.tsx`)
- Standardized interactive buttons: `Create Reservation` (`Saving…`), `Decline Booking` (`Declining…`), `Seat Walk-In` (`Seating…`), `Add to Waitlist` (`Adding…`).

---

## 4. Gated Inventory View-Only Capability Hardening

Resolved the deferred Step 3 Inventory RBAC issue: A custom role with ONLY `inventory.view` opens `/dashboard/inventory` smoothly in read-only mode with all mutation and creation controls suppressed:

| Component / Route | Gated Elements | Capability Checked |
| :--- | :--- | :--- |
| `src/app/(dashboard)/dashboard/inventory/page.tsx` | `+ Add Ingredient` header CTA, `📋 Physical Count` CTA | `inventory.items.manage`, `inventory.counts.manage` |
| `src/components/inventory/inventory-reorder-suggestions.tsx` | `Create PO →` CTA replaced with `View Details →` link | `inventory.purchasing.manage` / `inventory.manage` |
| `src/app/(dashboard)/dashboard/inventory/items/page.tsx` & `inventory-items-table.tsx` | `+ Add Ingredient`, `Manage Locations`, `Adjust`, `Waste` | `canManageItems`, `canAdjust`, `canWaste`, `canManageLocations` |
| `src/app/(dashboard)/dashboard/inventory/counts/page.tsx` | `Start Physical Count` CTA and empty state CTA | `inventory.counts.manage` / `inventory.manage` |
| `src/app/(dashboard)/dashboard/inventory/recipes/page.tsx` | `Batch Production` and `+ Create First Recipe` CTA | `inventory.recipes.manage` / `inventory.manage` |
| `src/app/(dashboard)/dashboard/inventory/purchasing/page.tsx` | `Receive Deliveries` and `+ Create First Purchase Order` CTA | `inventory.purchasing.manage` / `inventory.manage` |
| `src/components/inventory/storage-location-manager.tsx` | `+ Add Storage Location` button and form | `canManage` prop (`inventory.locations.manage`) |
| `src/components/inventory/supplier-manager-client.tsx` | `+ Add Supplier` button and form | `canManage` prop (`inventory.suppliers.manage`) |
| `src/components/inventory/prep-production-runner.tsx` | Batch dispatch button & form | `canProduce` prop (`inventory.production.manage`) |
| `src/components/inventory/goods-receiving-client.tsx` | Receive delivery submission | `canManage` prop (`inventory.receiving.manage`) |
| `src/components/inventory/supplier-returns-client.tsx` | Supplier return submission | `canManage` prop (`inventory.suppliers.manage`) |
| `src/app/(dashboard)/dashboard/inventory/transfers/page.tsx` | `+ New Transfer`, `Receive Stock` | `inventory.transfers.manage` / `inventory.manage` |

---

## 5. Mobile Form Usability & Touch Targets

- All interactive buttons and inputs comply with $\ge 44\text{px}$ touch targets (`min-h-[44px]`, `min-w-[44px]`).
- Form grids stack 1-column on mobile viewports (`grid-cols-1 sm:grid-cols-2`) and expand responsively on desktop.
- Touch manipulation optimization (`touch-manipulation`) applied across action buttons.
- Modal dialogues include accessible `aria-modal="true"`, `aria-labelledby`, keyboard `Escape` dismissal, and mobile overflow scrolling (`max-h-[90vh] overflow-y-auto`).

---

## 6. Automated Verification

- **Script**: `scripts/verify-phase37-step4-ux.ts` (21/21 assertions passed).
- **Regression Suite Passing**:
  - `npx tsx scripts/verify-phase37-dashboard.ts` (82/82 passed)
  - `npx tsx scripts/verify-phase37-navigation.ts` (63/63 passed)
  - `npm run verify:phase31-role-aware-navigation` (42/42 passed)
  - `npm run verify:phase31-navigation-ia` (60/60 passed)
  - `npx tsx scripts/verify-phase37-step3-closure.ts` (17/17 passed)
  - `npm run verify:v1-subscriptions` (30/30 passed)
  - `npm run verify:v1-notifications` (43/43 passed)
  - `npx tsc --noEmit` (0 errors)

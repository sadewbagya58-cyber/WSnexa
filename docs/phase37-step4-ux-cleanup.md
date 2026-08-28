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

## 6. Final Manual QA UX Closure Hotfix

Following production manual QA, the 15 discoverability, navigation, and responsiveness issues were resolved:

1. **Settings Hub vs Billing Separation (Issues 1, 2, 3)**:
   - Restored `/dashboard/settings` as a comprehensive, capability-aware Settings Hub surfacing Business Profile, Public Venue Profile, Branch Management, Order Security & Anti-Fraud, Payment Settings, and Inventory Policies.
   - Subscription & Billing (`/dashboard/settings/subscription`) is surfaced as a dedicated card for Business Owners only, and linked from the user profile dropdown and mobile drawer.
   - Created reusable `<SettingsSubNav />` component and integrated across all settings subpages.
2. **Team & Access Secondary Discoverability (Issue 4)**:
   - Created `<TeamSubNav />` and integrated across `/dashboard/team`, `/dashboard/team/invites`, `/dashboard/access`, `/dashboard/access/roles`, `/dashboard/access/diagnostics`, and `/dashboard/organization`.
3. **Operations / Inventory Subsection Discoverability (Issue 5)**:
   - Created `<InventorySubNav />` and integrated across `/dashboard/inventory`, `/items`, `/counts`, `/recipes`, `/purchasing`, `/receiving`, `/transfers`, `/suppliers`, `/locations`, `/waste`, and `/settings`.
4. **Global Help & Documentation Entry Point (Issue 6)**:
   - Added global Help link (`/dashboard/help`) in `DashboardShell` header, desktop user profile dropdown, and mobile drawer footer.
5. **Mobile Branch Switcher (Issue 7)**:
   - Restored `ActiveBranchSwitcher` prominently in the mobile navigation drawer with zero horizontal overflow.
6. **Subscription / Billing Purchase History Mobile Responsiveness (Issue 8)**:
   - Added responsive mobile card list view (`block md:hidden`) alongside desktop table (`hidden md:block`) in `OwnerBillingHistoryClient`.
7. **View-Only Stock Mutation Action Suppressed (Issue 9)**:
   - In `InventoryNeedsAttention`, out-of-stock items now strictly hide `Add Stock →` and `Replenish →` mutation CTAs for users with only `inventory.view`.
8. **Role Wizard Raw Permission Keys Cleaned (Issue 10)**:
   - In `PermissionMatrix` (Step 3 of Custom Role Creation), raw permission keys are hidden by default, with an optional "Show Technical IDs" disclosure toggle.
9. **Customer Secondary Tabs Gating (Issue 11)**:
   - Gated secondary customer workspaces (`Directory`, `Reviews`, `Reputation`, `Loyalty`) based on individual capabilities via `<CRMSubNav />`.
10. **Staff Invitation Microcopy (Issue 12)**:
    - Updated wording: `Generate Staff Invitation` $\rightarrow$ `New Staff Invite`; `Generate New Invitation` $\rightarrow$ `Invite Staff`; `Invited Email (Optional Binding)` $\rightarrow$ `Email (Optional)`; `Code Expiry Duration` $\rightarrow$ `Invite expires in`.
11. **Menu Item Feature Wording (Issue 13)**:
    - Updated: `Feature this item` (helper: `Show this item prominently on the menu.`).
12. **Reservation Modal Title (Issue 14)**:
    - Renamed modal title from `New Staff Reservation` to `New Reservation`.
13. **Mobile Menu Item Image Picker Layout (Issue 15)**:
    - Updated image upload container to stack preview and file chooser responsively (`flex-col sm:flex-row`).

---

## 7. Inventory Permission-Aware Subnavigation & Direct Route Hardening (Step 4 Final Blocker)

Manual QA identified a final Step 4 blocker where an account with ONLY `inventory.view` could see `Policies & Setup` in `InventorySubNav`, open `/dashboard/inventory/settings`, and observe the management form rendered underneath a forbidden warning banner.

### Root Cause Analysis & Architecture Fix
1. **Subnavigation Permission Decoupling**:
   - `InventorySubNav` previously defaulted all tab visibility flags to `true`, which caused client components rendered without explicit booleans to display all 11 inventory destinations.
   - All subnav props in `src/components/inventory/inventory-subnav.tsx` now default to `false` (fail-safe security).
   - Created authoritative helper `resolveInventorySubNavPermissions(authContext, branchId, businessId)` (`src/server/inventory/inventory-nav-permissions.ts`) that authoritatively checks canonical capabilities per tab.

2. **Inventory Subnavigation Capability Matrix**:
   | Sub-Workspace Tab | Route Path | Canonical Permission Required | Visible to `inventory.view` Only? |
   | :--- | :--- | :--- | :---: |
   | **Overview Hub** | `/dashboard/inventory` | `inventory.view` \| `inventory.items.manage` \| `inventory.manage` \| Owner | ✅ **Yes** |
   | **Stock Items** | `/dashboard/inventory/items` | `inventory.view` \| `inventory.items.manage` \| `inventory.manage` \| Owner | ✅ **Yes** |
   | **Stock Counts** | `/dashboard/inventory/counts` | `inventory.counts.manage` \| `inventory.counts.approve` \| `inventory.manage` \| Owner | ❌ No |
   | **Recipes & BOM** | `/dashboard/inventory/recipes` | `recipes.view` \| `recipes.manage` \| `recipes.costs.view` \| `inventory.manage` \| Owner | ❌ No |
   | **Purchasing** | `/dashboard/inventory/purchasing` | `purchasing.view` \| `purchasing.create` \| `purchasing.approve` \| `inventory.manage` \| Owner | ❌ No |
   | **Receiving** | `/dashboard/inventory/receiving` | `purchasing.receive` \| `inventory.receiving.manage` \| `inventory.manage` \| Owner | ❌ No |
   | **Transfers** | `/dashboard/inventory/transfers` | `inventory.transfers.manage` \| `inventory.transfers.receive` \| `inventory.manage` \| Owner | ❌ No |
   | **Suppliers** | `/dashboard/inventory/suppliers` | `suppliers.view` \| `suppliers.manage` \| `inventory.manage` \| Owner | ❌ No |
   | **Locations** | `/dashboard/inventory/locations` | `inventory.locations.manage` \| `inventory.manage` \| Owner | ❌ No |
   | **Waste Log** | `/dashboard/inventory/waste` | `inventory.waste.record` \| `inventory.items.manage` \| `inventory.manage` \| Owner | ❌ No |
   | **Policies & Setup** | `/dashboard/inventory/settings` | `inventory.settings.manage` \| `inventory.manage` \| Owner | ❌ No |

3. **Direct URL Route Hardening**:
   - `ROUTE_PERMISSION_MAP` in `src/lib/security/route-permissions.ts` updated with exact route prefix `/dashboard/inventory/settings` mapped to `['inventory.settings.manage']`.
   - `/dashboard/inventory/settings/page.tsx` now calls `requireRoutePermission('/dashboard/inventory/settings')`, resolves `navPermissions`, and if `!allowed || !navPermissions.canViewSettings`, returns `<AccessDenied />` immediately. Management forms and client components are never mounted or rendered for unauthorized users.
   - All other inventory subpages (`items`, `counts`, `recipes`, `purchasing`, `receiving`, `transfers`, `suppliers`, `locations`, `waste`, `production`) call `requireRoutePermission` with their exact canonical route path and pass resolved `navPermissions` to `<InventorySubNav {...navPermissions} />`.

4. **Server-Side Mutation Protection**:
   - `updateInventorySettingsAction` in `src/server/actions/inventory-settings.ts` verifies `inventory.settings.manage` (or `inventory.manage` / business ownership) against the targeted branch resource context, rejecting unauthorized callers with `Forbidden: Missing inventory.settings.manage permission.`.

---

## 8. Automated Verification

- **UX Verification Script**: `scripts/verify-phase37-step4-ux.ts` (53/53 assertions passed).
- **Regression Suite Passing**:
  - `npx tsx scripts/verify-phase37-dashboard.ts` (82/82 passed)
  - `npx tsx scripts/verify-phase37-navigation.ts` (63/63 passed)
  - `npm run verify:phase31-role-aware-navigation` (42/42 passed)
  - `npm run verify:phase31-navigation-ia` (60/60 passed)
  - `npm run verify:v1-subscriptions` (30/30 passed)
  - `npm run verify:v1-notifications` (43/43 passed)
  - `npx tsc --noEmit` (0 errors)
  - `npm run lint` (0 errors)
  - `npm run build` (179/179 routes compiled successfully)


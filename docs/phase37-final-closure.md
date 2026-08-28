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

## 5. Final Three Manual QA Blockers Resolution

### Blocker 1: Dashboard Attention Card & CTA Capability-Gating
- **Problem**: Custom roles without inventory permissions (e.g. `Senior Cashier` with `orders.view`, `pos.create`) saw `Check Inventory →` in Dashboard $\rightarrow$ Needs Attention, leading to Access Denied.
- **Resolution**:
  - `src/server/navigation/dashboard-today-data.ts`: Low-stock promise and attention items (`low-stock`, `pending-reservations`, `waiter-requests`) are now strictly capability-gated.
  - `src/server/navigation/dashboard-home-model.ts`: `showAttentionSection` is accurately gated on user permissions, eliminating dead-end CTAs.

### Blocker 2: Staff Directory Authoritative Custom Role Display
- **Problem**: Staff members assigned custom roles (e.g. `Senior Cashier`) displayed the underlying compatibility role (`Cashier`) on staff directory cards.
- **Resolution**:
  - `src/components/team/team-management.tsx`: `formatRoleLabel` updated to prioritize `customRoleName` with an explicit `Custom` badge, displaying `Senior Cashier` rather than `Cashier`.

### Blocker 3: Enterprise Staff Invitation Scope & Ceiling Model
- **Problem**: Staff invitations were strictly branch-bound, preventing enterprise/hotel-group invitations (Organization-wide, Department-scoped, Area-scoped).
- **Resolution**:
  - `src/lib/validation/staff-invitation.ts` & `src/server/services/staff-invitation.service.ts`: Extended with `scopeType` (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`), `departmentId`, and inviter reach enforcement via `validateAdministrativeReach` and role ceiling enforcement via `validateMaxScope`.
  - On claim, if department-scoped, atomic `staff_assignments` record is created/updated.
  - UI in `StaffInvitesManagement` dynamically adapts based on custom role presets and surfaces `🏢 Organization Wide` and `👥 Department` badges.

### Blocker 4 (Final Closure Hotfix): Permission-Aware Settings Secondary Navigation
- **Problem**: Custom roles with limited scope (e.g. `Group Viewer QA` with only `business.view`) could see all secondary navigation tabs in `SettingsSubNav` (Order Security, Payment Methods, Venue Profile, Branches, Inventory Policies), leading to dead-end links and Access Denied errors.
- **Resolution**:
  - `src/server/navigation/settings-nav-permissions.ts`: Created authoritative helper `resolveSettingsSubNavPermissions` resolving each sub-setting area (`canViewBusiness`, `canViewVenueProfile`, `canViewBranches`, `canManageBranches`, `canViewOrderSecurity`, `canViewPayments`, `canManageInventorySettings`, `canViewSubscription`).
  - `src/components/settings/settings-subnav.tsx`: Updated `SettingsSubNav` to default all visibility flags to `false` for secure-by-default, fail-safe rendering.
  - Integrated dynamic permission resolution across all Settings sub-pages:
    - `/dashboard/settings` (Overview Hub cards & subnavigation)
    - `/dashboard/business` (Business Profile)
    - `/dashboard/branches` (Branch Management)
    - `/dashboard/venue-profile` (Public Venue Profile)
    - `/dashboard/settings/order-security` (Order Security & Anti-Fraud)
    - `/dashboard/settings/payments` (Branch Payment Methods)
    - `/dashboard/settings/subscription` (SaaS Subscription & Billing)
  - Result: `Group Viewer QA` (`business.view` only) exclusively sees Business Profile in `SettingsSubNav` and Settings Hub; all unauthorized tabs and cards are cleanly hidden.

---

## 6. Verification & Test Suite Summary

- `scripts/verify-phase37-final.ts`: **46 / 46 PASSED** (includes 6 new assertions for Settings navigation gating)
- `scripts/verify-phase37-step4-ux.ts`: **53 / 53 PASSED**
- `scripts/verify-phase37-step3-closure.ts`: **17 / 17 PASSED**
- `scripts/verify-phase37-dashboard.ts`: **82 / 82 PASSED**
- `scripts/verify-phase37-navigation.ts`: **63 / 63 PASSED**
- `scripts/verify-phase31-role-aware-navigation.ts`: **42 / 42 PASSED**
- `scripts/verify-phase31-navigation-ia.ts`: **60 / 60 PASSED**
- `scripts/verify-v1-subscriptions.ts`: **30 / 30 PASSED**
- `scripts/verify-v1-notifications.ts`: **43 / 43 PASSED**
- `npm run build`: **179/179 routes compiled successfully with 0 errors**

---

## 7. Migration Policy & Readiness

- **Migration File**: `supabase/migrations/20260828000000_phase37_staff_invitation_encrypted_code.sql`
- **SQL Action**: `ALTER TABLE public.staff_invitations ADD COLUMN encrypted_code TEXT;`
- **Scope Model Schema Compatibility**: The existing canonical RBAC schema (`role_scope_presets`, `permission_scope_grants`, `staff_assignments`) fully represents Organization and Department assignments. The `branch_id` foreign key on `staff_invitations` anchors to the business's primary branch for DB integrity, requiring no additional schema migration.
- **Production Status**: `READY FOR FINAL MANUAL QA`

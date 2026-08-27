# WSNexa Phase 37 — Step 2: Simplified Navigation & Hub Workspace Implementation Document

## 1. Executive Summary

Phase 37 Step 2 successfully implements the approved simplified Information Architecture across WSNexa business workspaces:
- Reduced primary navigation from 38 visible links down to **10 canonical primary items**.
- Preserved 100% of existing Next.js page routes, server actions, RBAC v2 permissions, Supabase RLS, and deep link URLs.
- Provided direct operational workflows for Cashiers (`/dashboard/cashier`), Kitchen Staff (`/dashboard/kitchen`), and Waiters (`/dashboard/waiter`) without forcing them through owner-oriented hub pages.
- Standardized workspace navigation across desktop sidebar and mobile drawer with $44\text{px}+$ touch targets.

---

## 2. Implemented Primary Navigation Architecture

```
1. 📊 Dashboard      (/dashboard)
2. 🍽️ Orders         (/dashboard/orders)
3. 📜 Menu           (/dashboard/menu)
4. 🪑 Dining & QR    (/dashboard/dining)
5. 📅 Reservations   (/dashboard/reservations)
6. 👥 Customers      (/dashboard/customers)
7. 📦 Operations     (/dashboard/inventory)
8. 👨‍💼 Team           (/dashboard/team)
9. 📈 Reports        (/dashboard/reports)
10. ⚙️ Settings       (/dashboard/settings/subscription)
```

---

## 3. Workspace Hub Composition

| Workspace Hub | Canonical Route | Default Primary View | Secondary Workspaces & Sub-groups |
| :--- | :--- | :--- | :--- |
| **Orders** | `/dashboard/orders` | Live Operational Launchers | Cashier POS (`/dashboard/cashier`), Kitchen Queue (`/dashboard/kitchen`), Waiter Service (`/dashboard/waiter`) |
| **Menu** | `/dashboard/menu` | Menu Overview & Items | Categories (`/dashboard/menu/categories`), Menu Items (`/dashboard/menu/items`) |
| **Dining & QR** | `/dashboard/dining` | Floor Layout & Areas | Tables (`/dashboard/tables`), Service Areas (`/dashboard/areas`), QR Cards (`/dashboard/tables/qr`) |
| **Reservations** | `/dashboard/reservations` | Reservations & Waitlist | Reservation management & floor booking |
| **Customers** | `/dashboard/customers` | Customer Directory | Reviews (`/dashboard/reviews`), Reputation (`/dashboard/reputation`), Loyalty (`/dashboard/loyalty`) |
| **Operations** | `/dashboard/inventory` | Inventory Overview & KPIs | Stock Items (`/dashboard/inventory/items`), Counts (`/dashboard/inventory/counts`), Waste (`/dashboard/inventory/waste`), Recipes (`/dashboard/inventory/recipes`), Purchasing (`/dashboard/inventory/purchasing`) |
| **Team** | `/dashboard/team` | Staff Members & Invitations | **People**: Staff & Invitations, People Directory (`/dashboard/people`)<br>**Access**: Roles & Permissions (`/dashboard/access/roles`), Scoped Permissions (`/dashboard/access/scope-grants`)<br>**Organization**: Org Structure (`/dashboard/organization/structure`), Positions (`/dashboard/organization/positions`) |
| **Reports** | `/dashboard/reports` | Realtime Reports & Analytics | Financial Summary, Product Sales Mix, Channel Performance, Kitchen Efficiency |
| **Settings** | `/dashboard/settings/subscription` | Commercial Subscription | Business Profile (`/dashboard/business`), Public Venue Profile (`/dashboard/venue-profile`), Branches (`/dashboard/branches`), Order Security (`/dashboard/settings/order-security`), Payment Methods (`/dashboard/settings/payments`), Help (`/dashboard/help`) |

---

## 4. Roles & Permissions Consolidation

- **One Authoritative RBAC Engine**: WSNexa utilizes a single, unified Phase 30 RBAC v2 backend foundation (`public.custom_roles`, `public.role_permissions`, `public.role_scope_presets`).
- **Canonical Route**: `/dashboard/access/roles` is the canonical Roles & Permissions surface.
- **Legacy Route Redirection**: `/dashboard/team/roles` seamlessly redirects to `/dashboard/access/roles` with full session/permission checks, preserving all existing bookmarks and deep links.
- **Single Entry Point**: Team workspace (`/dashboard/team`) features one single, clear **"🛡️ Roles & Permissions"** workspace button. Competing concepts like "Roles & Permissions Matrix" have been removed from the header.
- **Simple Default Creation Flow**:
  - **Step 1: Role Details** (Name, Description).
  - **Step 2: Start From Template** (Preset starting points: Branch Manager, Cashier, Kitchen Staff, Waiter, Custom).
  - **Step 3: Fine-Tune Permissions** (Categorized checkboxes with search and group select).
  - **Advanced Access Settings** (Collapsible panel for Default Authority Scope and Maximum Scope Ceiling).
  - **Safe Simple Default**: Roles created without touching Advanced Settings safely default to `PROPERTY` (Property / Branch) access scope without exposing complex enterprise governance concepts to small café owners.
- **Built-in Templates**: Preserved as system-protected standards with simplified, friendly explanations and one-click role cloning.
- **Staff Invitations Compatibility**: 100% compatible with both built-in role templates and custom roles, with branch and service area bindings.
- **Zero Data Migration**: No database migration required; all role data is unified under the existing Phase 30 schema.
- **Security Guarantees**: Unconditional preservation of explicit DENY precedence, multi-tier scope ceilings, tenant isolation, and server-side policy evaluation (`can()`).

---

## 5. Operational Role Routing

- **Cashier**: `resolveDefaultWorkspaceRoute('cashier')` lands directly on `/dashboard/cashier`.
- **Kitchen Staff**: `resolveDefaultWorkspaceRoute('kitchen_staff')` lands directly on `/dashboard/kitchen`.
- **Waiter**: `resolveDefaultWorkspaceRoute('waiter')` lands directly on `/dashboard/waiter`.
- **Owner / Manager**: Lands on `/dashboard`.

---

## 6. Mobile Navigation Behavior

- **Canonical Resolution**: Shared with desktop via `resolveDashboardNavigation(context)`.
- **Touch Target Spacing**: `min-h-[44px]` touch targets enforced on all mobile links to prevent mis-taps.
- **Drawer Behavior**: Drawer closes smoothly on path selection; locks body scrolling while active.

---

## 7. Security & RBAC Guarantees

- **Navigation Presentation Only**: Navigation visibility is presentation layer logic. Every route handler and server action continues enforcing strict server-side authorization (`requireRoutePermission`).
- **Parent Hub Collapse**: In `navigation-engine.ts`, a parent hub is rendered ONLY if the user possesses permission for at least one child feature within that hub.

---

## 8. Manual QA Checklist

### A. Business Owner Role
- [ ] Log in as Business Owner.
- [ ] Confirm sidebar displays exactly 10 primary navigation items.
- [ ] Verify clicking **Orders** opens `/dashboard/orders` showing POS, Kitchen, and Waiter quick launchers.
- [ ] Verify clicking **Customers** opens `/dashboard/customers` with Customer Directory as default and quick links for Reviews, Reputation, Loyalty.
- [ ] Verify clicking **Team** opens `/dashboard/team` with Staff Members as default and clean sub-group tabs for People, Access, and Organization.
- [ ] Verify clicking **Operations** opens `/dashboard/inventory` with Inventory KPIs and stock module shortcuts.

### B. Roles & Permissions Experience (Small Café & Hotel Flows)
- [ ] Open **Team** $\rightarrow$ **Roles & Permissions** (`/dashboard/access/roles`).
- [ ] Click **Create Custom Role**.
- [ ] Verify Step 1 prompts for Role Name and Description.
- [ ] Verify Step 2 allows choosing a starting template (Cashier, Kitchen, Waiter, Manager, Custom).
- [ ] Verify Step 3 allows fine-tuning categorized permissions.
- [ ] Create role WITHOUT opening Advanced Settings; verify it creates a safe `Property / Branch` scoped role.
- [ ] Create/Edit role and open **Advanced Access Settings**; verify Default Scope and Max Scope Ceiling can be configured across Organization Wide, Department, Service Area, Self.
- [ ] Open `/dashboard/team/roles`; verify seamless redirect to `/dashboard/access/roles`.

### C. Branch Manager Role
- [ ] Log in as Branch Manager.
- [ ] Confirm permitted primary hubs display cleanly in sidebar.
- [ ] Verify access to Menu, Dining, Reservations, Operations, Team, Reports, Settings.

### D. Cashier Role
- [ ] Log in as Cashier.
- [ ] Confirm default landing route is `/dashboard/cashier`.
- [ ] Verify POS workspace operates without requiring navigation through owner hubs.

### E. Kitchen Staff Role
- [ ] Log in as Kitchen Staff.
- [ ] Confirm default landing route is `/dashboard/kitchen`.
- [ ] Verify Kitchen Queue operates directly.

### F. Waiter Role
- [ ] Log in as Waiter.
- [ ] Confirm default landing route is `/dashboard/waiter`.
- [ ] Verify Waiter Service operates directly.

### G. Custom Restricted Role
- [ ] Assign custom role with ONLY `inventory.counts.manage`.
- [ ] Verify sidebar displays **Operations** hub while collapsing Customers, Dining, and Settings hubs.

### H. Mobile Viewport
- [ ] Open application on mobile screen size ($\le 640\text{px}$).
- [ ] Open mobile drawer and verify touch targets are $\ge 44\text{px}$ high.
- [ ] Confirm drawer closes upon selecting a route.

---

## 9. Phase 37 Step 2 Status

**READY FOR MANUAL QA**

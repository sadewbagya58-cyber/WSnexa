# WSNexa — Phase 31 Step 1 Navigation & Information Architecture Audit

## 1. Executive Summary

Phase 31 objective is to build a role-aware, scope-aware, consistent, fast, mobile-friendly management experience on top of the Phase 29 Organization model and Phase 30 RBAC & Scope V2 authorization architecture.

Step 1 performs a complete audit of the repository's dashboard routes, navigation architecture, concept overlaps, unlinked pages, naming consistency, mobile readiness, and defines the frozen canonical Information Architecture (IA) for Phase 31.

---

## 2. Repository Dashboard Route Inventory

The repository contains **75 total dashboard page routes** (73 under `src/app/(dashboard)/dashboard/*` and 2 under `src/app/dashboard/settings/*`).

### Complete Route Classification Inventory Table

| # | Route Path | Title / Feature | Domain / Module | Current Nav Section | Linked in Sidebar | Route Type | Required Permission | Scope Context | Target Persona |
| :- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| 1 | `/dashboard` | Dashboard Overview | Overview | OVERVIEW | Yes | Primary Page | `orders.view` | MIXED | All Roles |
| 2 | `/dashboard/reports` | Reports & Analytics | Analytics | OVERVIEW | Yes | Primary Page | `reports.view` | MIXED | Owner, Manager |
| 3 | `/dashboard/business` | Business Profile | Venue Setup | VENUE SETUP | Yes | Primary Page | `business.settings.manage` | ORGANIZATION | Owner |
| 4 | `/dashboard/venue-profile` | Public Venue Profile | Venue Setup | VENUE SETUP | Yes | Primary Page | `venue_profile.manage` | ORGANIZATION | Owner, Manager |
| 5 | `/dashboard/branches` | Branches / Locations | Venue Setup | VENUE SETUP | Yes | Primary Page | `branches.manage` | ORGANIZATION | Owner |
| 6 | `/dashboard/dining` | Dining Setup | Venue Setup | VENUE SETUP | Yes | Primary Page | `tables.view` | PROPERTY | Owner, Manager |
| 7 | `/dashboard/team` | Team & Members | Venue Setup | VENUE SETUP | Yes | Primary Page | `staff.view` | ORGANIZATION | Owner, Manager |
| 8 | `/dashboard/team/invites` | Staff Invitations | Venue Setup | VENUE SETUP | Yes | Primary Page | `staff.invite` | ORGANIZATION | Owner, Manager |
| 9 | `/dashboard/team/roles` | Legacy Roles View | Access | VENUE SETUP | No | Redirect Subpage | `roles.view` | ORGANIZATION | Owner, Manager |
| 10 | `/dashboard/organization` | Organization Hub | Organization | ORGANIZATION & PEOPLE | Yes | Primary Page | `organization.view` | ORGANIZATION | Owner, Manager |
| 11 | `/dashboard/organization/structure` | Structure & Units | Organization | ORGANIZATION & PEOPLE | Yes | Primary Page | `organization.view` | ORGANIZATION | Owner, Manager |
| 12 | `/dashboard/organization/chart` | Org Chart | Organization | ORGANIZATION & PEOPLE | Yes | Primary Page | `organization.view` | ORGANIZATION | All Staff |
| 13 | `/dashboard/organization/job-titles` | Job Titles Catalog | Organization | ORGANIZATION & PEOPLE | Yes | Primary Page | `organization.view` | ORGANIZATION | Owner, Manager |
| 14 | `/dashboard/organization/positions` | Positions & Headcount | Organization | ORGANIZATION & PEOPLE | Yes | Primary Page | `positions.manage` | ORGANIZATION | Owner, Manager |
| 15 | `/dashboard/people` | People Directory | People | ORGANIZATION & PEOPLE | Yes | Primary Page | `people.view` | ORGANIZATION | Owner, Manager |
| 16 | `/dashboard/people/acting` | Acting & Coverage | People | ORGANIZATION & PEOPLE | Yes | Primary Page | `people.view` | PROPERTY | Owner, Manager |
| 17 | `/dashboard/people/secondments` | Secondments | People | ORGANIZATION & PEOPLE | Yes | Primary Page | `people.view` | ORGANIZATION | Owner, Manager |
| 18 | `/dashboard/people/integrity` | Integrity Diagnostics | People | ORGANIZATION & PEOPLE | Yes | Primary Page | `organization.view` | ORGANIZATION | Owner |
| 19 | `/dashboard/people/[membershipId]` | Member Profile Inspector | People | Unlinked | No | Detail Page | `people.view` | ORGANIZATION | Owner, Manager |
| 20 | `/dashboard/access` | Access Control Hub | Access | ACCESS & GOVERNANCE | Yes | Primary Page | `roles.view` | ORGANIZATION | Owner, Manager |
| 21 | `/dashboard/access/roles` | Roles & Templates | Access | ACCESS & GOVERNANCE | Yes | Primary Page | `roles.view` | ORGANIZATION | Owner, Manager |
| 22 | `/dashboard/access/roles/[roleId]` | Custom Role Detail | Access | Unlinked | No | Detail Page | `roles.view` | ORGANIZATION | Owner, Manager |
| 23 | `/dashboard/access/scope-grants` | Scope Grants Manager | Access | ACCESS & GOVERNANCE | Yes | Primary Page | `roles.view` | ORGANIZATION | Owner |
| 24 | `/dashboard/access/diagnostics` | Access Diagnostics | Access | ACCESS & GOVERNANCE | Yes | Primary Page | `roles.view` | ORGANIZATION | Owner, Manager |
| 25 | `/dashboard/access/members` | Member Overrides Directory | Access | Unlinked | No | Subpage / Tab | `roles.view` | ORGANIZATION | Owner, Manager |
| 26 | `/dashboard/access/members/[membershipId]` | Member Access Inspector | Access | Unlinked | No | Detail Page | `roles.view` | ORGANIZATION | Owner, Manager |
| 27 | `/dashboard/menu` | Menu Overview | Menu | MENU | Yes | Primary Page | `menu.view` | PROPERTY | All Staff |
| 28 | `/dashboard/menu/categories` | Categories Manager | Menu | MENU | Yes | Primary Page | `menu.categories.manage` | PROPERTY | Owner, Manager |
| 29 | `/dashboard/menu/items` | Menu Items Catalog | Menu | MENU | Yes | Primary Page | `menu.view` | PROPERTY | All Staff |
| 30 | `/dashboard/menu/items/new` | Create Menu Item | Menu | Unlinked | No | Action Page | `menu.items.create` | PROPERTY | Owner, Manager |
| 31 | `/dashboard/menu/items/[item_id]/modifiers` | Item Modifiers | Menu | Unlinked | No | Detail / Action | `menu.items.create` | PROPERTY | Owner, Manager |
| 32 | `/dashboard/cashier` | Cashier POS Workspace | Operations | OPERATIONS | Yes | Operational Workspace | `cashier.access` | PROPERTY | Cashier, Manager |
| 33 | `/dashboard/kitchen` | Kitchen Queue Workspace | Operations | OPERATIONS | Yes | Operational Workspace | `kitchen.access` | PROPERTY | Kitchen Staff |
| 34 | `/dashboard/waiter` | Waiter Assistance Workspace | Operations | OPERATIONS | Yes | Operational Workspace | `waiter.requests.view` | PROPERTY | Waiter, Manager |
| 35 | `/dashboard/waiter/menu` | Waiter Menu Quick Reference | Operations | OPERATIONS | Yes | Operational Workspace | `waiter.orders.create` | PROPERTY | Waiter, Manager |
| 36 | `/dashboard/waiter/order` | Waiter Order Entry | Operations | Unlinked | No | Action Page | `waiter.orders.create` | PROPERTY | Waiter |
| 37 | `/dashboard/inventory` | Inventory Hub | Inventory | INVENTORY | Yes | Primary Page | `inventory.view` | PROPERTY | Owner, Manager |
| 38 | `/dashboard/inventory/items` | Stock Items | Inventory | INVENTORY | Yes | Primary Page | `inventory.view` | PROPERTY | Owner, Manager |
| 39 | `/dashboard/inventory/items/new` | Create Stock Item | Inventory | Unlinked | No | Action Page | `inventory.items.manage` | PROPERTY | Manager |
| 40 | `/dashboard/inventory/items/[id]` | Stock Item Detail | Inventory | Unlinked | No | Detail Page | `inventory.view` | PROPERTY | Manager |
| 41 | `/dashboard/inventory/counts` | Stock Counts | Inventory | INVENTORY | Yes | Primary Page | `inventory.counts.manage` | PROPERTY | Manager |
| 42 | `/dashboard/inventory/counts/new` | Start Stock Count | Inventory | Unlinked | No | Action Page | `inventory.counts.manage` | PROPERTY | Manager |
| 43 | `/dashboard/inventory/counts/[id]` | Stock Count Audit | Inventory | Unlinked | No | Detail Page | `inventory.counts.manage` | PROPERTY | Manager |
| 44 | `/dashboard/inventory/waste` | Waste Tracking | Inventory | INVENTORY | Yes | Primary Page | `inventory.waste.record` | PROPERTY | Manager, Kitchen |
| 45 | `/dashboard/inventory/transfers` | Stock Transfers | Inventory | INVENTORY | Yes | Primary Page | `inventory.transfers.manage` | ORGANIZATION | Manager |
| 46 | `/dashboard/inventory/transfers/new` | Create Stock Transfer | Inventory | Unlinked | No | Action Page | `inventory.transfers.manage` | ORGANIZATION | Manager |
| 47 | `/dashboard/inventory/locations` | Storage Locations | Inventory | INVENTORY | Yes | Primary Page | `inventory.locations.manage` | PROPERTY | Manager |
| 48 | `/dashboard/inventory/recipes` | Recipe & Costing Catalog | Inventory | Unlinked | No | Primary / Subpage | `inventory.view` | PROPERTY | Owner, Manager, Kitchen |
| 49 | `/dashboard/inventory/recipes/new` | Create Recipe | Inventory | Unlinked | No | Action Page | `inventory.view` | PROPERTY | Manager, Kitchen |
| 50 | `/dashboard/inventory/recipes/[id]` | Recipe Detail & Costing | Inventory | Unlinked | No | Detail Page | `inventory.view` | PROPERTY | Manager, Kitchen |
| 51 | `/dashboard/inventory/suppliers` | Suppliers Directory | Inventory | Unlinked | No | Primary / Subpage | `inventory.view` | ORGANIZATION | Owner, Manager |
| 52 | `/dashboard/inventory/suppliers/[id]` | Supplier Detail | Inventory | Unlinked | No | Detail Page | `inventory.view` | ORGANIZATION | Manager |
| 53 | `/dashboard/inventory/purchasing` | Purchase Orders | Inventory | Unlinked | No | Primary / Subpage | `inventory.view` | ORGANIZATION | Owner, Manager |
| 54 | `/dashboard/inventory/purchasing/new` | Create Purchase Order | Inventory | Unlinked | No | Action Page | `inventory.view` | ORGANIZATION | Manager |
| 55 | `/dashboard/inventory/purchasing/[id]` | Purchase Order Detail | Inventory | Unlinked | No | Detail Page | `inventory.view` | ORGANIZATION | Manager |
| 56 | `/dashboard/inventory/receiving` | Stock Receiving | Inventory | Unlinked | No | Operational Subpage | `inventory.view` | PROPERTY | Manager |
| 57 | `/dashboard/inventory/production` | Batch Production | Inventory | Unlinked | No | Operational Subpage | `inventory.view` | PROPERTY | Kitchen, Manager |
| 58 | `/dashboard/inventory/settings` | Inventory Settings | Inventory | Unlinked | No | Config Page | `inventory.view` | ORGANIZATION | Owner, Manager |
| 59 | `/dashboard/reviews` | Customer Reviews | Guests & Growth | GROWTH & GUESTS | Yes | Primary Page | `reviews.respond` | PROPERTY | Owner, Manager |
| 60 | `/dashboard/reputation` | Reputation & Rankings | Guests & Growth | GROWTH & GUESTS | Yes | Primary Page | `reputation.view` | ORGANIZATION | Owner, Manager |
| 61 | `/dashboard/loyalty` | Loyalty & Rewards | Guests & Growth | GROWTH & GUESTS | Yes | Primary Page (Soon) | `loyalty.view` | ORGANIZATION | Owner, Manager |
| 62 | `/dashboard/loyalty/rewards` | Reward Tiers | Guests & Growth | Unlinked | No | Subpage | `loyalty.rewards.manage` | ORGANIZATION | Owner, Manager |
| 63 | `/dashboard/loyalty/customers` | Customer Loyalty Directory | Guests & Growth | Unlinked | No | Subpage | `loyalty.customers.view` | ORGANIZATION | Manager |
| 64 | `/dashboard/tables` | Table Grid Management | Dining | Unlinked | No | Subpage / Tab | `tables.view` | PROPERTY | Manager, Waiter |
| 65 | `/dashboard/areas` | Seating Areas | Dining | Unlinked | No | Subpage / Tab | `areas.manage` | PROPERTY | Manager |
| 66 | `/dashboard/tables/areas` | Table Areas Config | Dining | Unlinked | No | Config Subpage | `areas.manage` | PROPERTY | Manager |
| 67 | `/dashboard/tables/bulk` | Bulk Table Creation | Dining | Unlinked | No | Action Page | `tables.create` | PROPERTY | Manager |
| 68 | `/dashboard/tables/new` | Create Single Table | Dining | Unlinked | No | Action Page | `tables.create` | PROPERTY | Manager |
| 69 | `/dashboard/tables/qr` | Table QR Generator | Dining | Unlinked | No | Action Page | `qr.generate` | PROPERTY | Manager |
| 70 | `/dashboard/settings/order-security` | Order Security Settings | Settings | SETTINGS | Yes | Primary Page | `order_security.view` | ORGANIZATION | Owner |
| 71 | `/dashboard/settings/payments` | Payment Methods | Settings | SETTINGS | Yes | Primary Page | `branches.manage` | PROPERTY | Owner, Manager |
| 72 | `/dashboard/help` | Help Center Knowledge Base | Support | SUPPORT & GUIDANCE | Yes | Primary Page | None | None | All Staff |
| 73 | `/dashboard/help/troubleshooting` | Troubleshooting Guides | Support | Unlinked | No | Subpage | None | None | All Staff |
| 74 | `/dashboard/help/category/[category]` | Help Category Listing | Support | Unlinked | No | Subpage | None | None | All Staff |
| 75 | `/dashboard/help/[slug]` | Help Article View | Support | Unlinked | No | Detail Page | None | None | All Staff |

---

## 3. Sidebar Implementation & Architecture Audit

### Current Architecture (`src/components/layout/dashboard-shell.tsx`)
1. **Hard-coded Navigation Sections**: Defined in static `rawNavSections` array inside `dashboard-shell.tsx`.
2. **Duplicated Route-Permission Mapping**: Permission requirements are listed in `rawNavSections` via client filter AND separately in `src/lib/security/route-permissions.ts` (`ROUTE_PERMISSION_MAP`).
3. **Client-Side Permission Filtering**:
   ```ts
   const allowedNavSections = rawNavSections
     .map((sec) => ({
       ...sec,
       items: sec.items.filter((item) => {
         if (userRole === 'business_owner') return true;
         const requiredPerm = getRequiredPermissionForRoute(item.href);
         if (!requiredPerm) return true;
         return userPermissions.includes(requiredPerm);
       }),
     }))
     .filter((sec) => sec.items.length > 0);
   ```
4. **Desktop vs Mobile Rendering`:
   - `renderDesktopNavLinks()` renders plain `<Link>` components.
   - `renderMobileNavLinks()` intercepts `/dashboard/branches` and renders `SidebarBranchPicker` expandable tree.
5. **Active Route Detection**: Uses `pathname.startsWith(item.href)`.
6. **Hardcoded Role Format**: Uses local helper `formatRoleLabel(role: string)` for display strings.

---

## 4. Duplicate / Overlap Analysis

### A. Team & Members (`/dashboard/team`) vs People Directory (`/dashboard/people`)
- **Semantic Distinction**:
  - `Team & Members`: Manages account membership, staff email invitations, baseline RBAC role assignment (`business_owner`, `branch_manager`, `cashier`, `kitchen_staff`, `waiter`), and account status (`active`/`deactivated`).
  - `People Directory`: Manages organizational employee identity, primary department assignment, job title, position slot, reporting lines, acting coverage windows, secondments, and headcount integrity.
- **Audit Conclusion**: These represent two distinct concerns (Account Access vs Organizational Placement). Both routes should be preserved.

### B. Organization Hub vs Structure vs Org Chart vs Job Titles vs Positions
- **Overview**: `/dashboard/organization` (Organization Hub) is the high-level overview.
- **Structure**: `/dashboard/organization/structure` manages structural units & departments.
- **Org Chart**: `/dashboard/organization/chart` provides visual reporting tree.
- **Job Titles**: `/dashboard/organization/job-titles` manages title catalog.
- **Positions**: `/dashboard/organization/positions` manages concrete staffing slots.
- **Audit Conclusion**: Highly complementary, clear domain decomposition.

### C. Access Control Hub vs Team & Members
- `Access Control Hub` (`/dashboard/access`): Policy Engine RBAC V2 roles, custom role bundles, scope grants, member explicit overrides, access diagnostics.
- `Team & Members` (`/dashboard/team`): Member list & invitation sending.
- **Audit Conclusion**: Distinct and properly decoupled.

### D. Inventory vs Purchasing & Recipes
- **Unlinked Rich Features**: The repository contains full production pages for:
  - `/dashboard/inventory/recipes` (Recipes & Costing)
  - `/dashboard/inventory/suppliers` (Suppliers Directory)
  - `/dashboard/inventory/purchasing` (Purchase Orders)
  - `/dashboard/inventory/receiving` (Stock Receiving)
- **Recommendation**: Expose `Recipes & Costing` and `Purchasing & Suppliers` under Inventory in the canonical IA.

---

## 5. Dead, Incomplete & Feature-Flagged Page Audit

- **Loyalty & Rewards** (`/dashboard/loyalty`):
  - Controlled by `IS_LOYALTY_ENABLED` in `src/lib/config/features.ts` (`LOYALTY_REWARDS_ENABLED: false`).
  - Correctly displays `"Soon"` badge in sidebar. Database tables and architecture are 100% preserved.
- **Broken / Dead Links**: 0 broken 404 links found. Every navigation link resolves to a valid Page component.

---

## 6. Proposed Canonical Phase 31 Information Architecture

```
OVERVIEW
├── Dashboard (/dashboard)
└── Reports & Analytics (/dashboard/reports)

VENUE SETUP
├── Business Profile (/dashboard/business)
├── Public Venue Profile (/dashboard/venue-profile)
├── Branches (/dashboard/branches)
├── Dining Setup (/dashboard/dining)
├── Team & Members (/dashboard/team)
└── Staff Invitations (/dashboard/team/invites)

ORGANIZATION & PEOPLE
├── Organization Hub (/dashboard/organization)
├── Structure & Units (/dashboard/organization/structure)
├── Org Chart (/dashboard/organization/chart)
├── Job Titles (/dashboard/organization/job-titles)
├── Positions & Headcount (/dashboard/organization/positions)
├── People Directory (/dashboard/people)
├── Acting & Coverage (/dashboard/people/acting)
├── Secondments (/dashboard/people/secondments)
└── Integrity Diagnostics (/dashboard/people/integrity)

ACCESS & GOVERNANCE
├── Access Control Hub (/dashboard/access)
├── Roles & Templates (/dashboard/access/roles)
├── Scope Grants (/dashboard/access/scope-grants)
└── Access Diagnostics (/dashboard/access/diagnostics)

MENU
├── Menu Overview (/dashboard/menu)
├── Categories (/dashboard/menu/categories)
└── Menu Items (/dashboard/menu/items)

OPERATIONS
├── Cashier POS (/dashboard/cashier)
├── Kitchen Queue (/dashboard/kitchen)
├── Waiter Assistance (/dashboard/waiter)
└── Waiter Menu (/dashboard/waiter/menu)

INVENTORY
├── Inventory Hub (/dashboard/inventory)
├── Stock Items (/dashboard/inventory/items)
├── Stock Counts (/dashboard/inventory/counts)
├── Waste Tracking (/dashboard/inventory/waste)
├── Stock Transfers (/dashboard/inventory/transfers)
├── Storage Locations (/dashboard/inventory/locations)
├── Recipes & Costing (/dashboard/inventory/recipes)
└── Purchasing & Suppliers (/dashboard/inventory/purchasing)

GROWTH & GUESTS
├── Customer Reviews (/dashboard/reviews)
├── Reputation & Rankings (/dashboard/reputation)
└── Loyalty & Rewards (/dashboard/loyalty) [Soon]

SETTINGS
├── Order Security (/dashboard/settings/order-security)
└── Payment Methods (/dashboard/settings/payments)

SUPPORT & GUIDANCE
└── Help Center (/dashboard/help)
```

---

## 7. Navigation Depth Model

1. **Level 1**: Top-level module sections (e.g. `ORGANIZATION & PEOPLE`, `INVENTORY`).
2. **Level 2**: Primary sidebar pages (e.g. `People Directory`, `Stock Items`).
3. **Level 3**: Sub-navigation tabs / secondary listings (e.g. `/dashboard/access/members`, `/dashboard/inventory/receiving`).
4. **Level 4**: Entity detail inspector pages (e.g. `/dashboard/people/[membershipId]`, `/dashboard/inventory/items/[id]`).

---

## 8. Persona Visibility Planning Matrix (Preparation for Step 2)

| Primary Navigation Item | Business Owner | Branch Manager | Cashier | Kitchen | Waiter | Visibility Logic |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | Always visible |
| **Reports & Analytics** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`reports.view`) |
| **Business Profile** | ✅ | ❌ | ❌ | ❌ | ❌ | Owner-only (`business.settings.manage`) |
| **Public Venue Profile** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`venue_profile.manage`) |
| **Branches** | ✅ | ❌ | ❌ | ❌ | ❌ | Owner-only (`branches.manage`) |
| **Dining Setup** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`tables.view`) |
| **Team & Members** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`staff.view`) |
| **Staff Invitations** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`staff.invite`) |
| **Organization Hub** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`organization.view`) |
| **Structure & Units** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`organization.view`) |
| **Org Chart** | ✅ | ✅ | ✅ | ✅ | ✅ | Permission-driven (`organization.view`) |
| **Job Titles** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`organization.view`) |
| **Positions & Headcount** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`positions.manage`) |
| **People Directory** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`people.view`) |
| **Acting & Coverage** | ✅ | ✅ | ❌ | ❌ | ❌ | Scope-driven (`people.view`) |
| **Secondments** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`people.view`) |
| **Integrity Diagnostics** | ✅ | ❌ | ❌ | ❌ | ❌ | Owner-only (`organization.view`) |
| **Access Control Hub** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`roles.view`) |
| **Roles & Templates** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`roles.view`) |
| **Scope Grants** | ✅ | ❌ | ❌ | ❌ | ❌ | Owner-only (`roles.view`) |
| **Access Diagnostics** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`roles.view`) |
| **Menu Overview** | ✅ | ✅ | ✅ | ✅ | ✅ | Permission-driven (`menu.view`) |
| **Categories** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`menu.categories.manage`) |
| **Menu Items** | ✅ | ✅ | ✅ | ✅ | ✅ | Permission-driven (`menu.view`) |
| **Cashier POS** | ✅ | ✅ | ✅ | ❌ | ❌ | Operational (`cashier.access`) |
| **Kitchen Queue** | ✅ | ✅ | ❌ | ✅ | ❌ | Operational (`kitchen.access`) |
| **Waiter Assistance** | ✅ | ✅ | ❌ | ❌ | ✅ | Operational (`waiter.requests.view`) |
| **Waiter Menu** | ✅ | ✅ | ❌ | ❌ | ✅ | Operational (`waiter.orders.create`) |
| **Inventory Hub** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`inventory.view`) |
| **Stock Items** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`inventory.view`) |
| **Stock Counts** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`inventory.counts.manage`) |
| **Waste Tracking** | ✅ | ✅ | ❌ | ✅ | ❌ | Permission-driven (`inventory.waste.record`) |
| **Stock Transfers** | ✅ | ✅ | ❌ | ❌ | ❌ | Scope-driven (`inventory.transfers.manage`) |
| **Storage Locations** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`inventory.locations.manage`) |
| **Customer Reviews** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`reviews.respond`) |
| **Reputation & Rankings** | ✅ | ✅ | ❌ | ❌ | ❌ | Permission-driven (`reputation.view`) |
| **Loyalty & Rewards** | ✅ | ✅ | ❌ | ❌ | ❌ | Feature-flagged (`loyalty.view`) |
| **Order Security** | ✅ | ❌ | ❌ | ❌ | ❌ | Owner-only (`order_security.view`) |
| **Payment Methods** | ✅ | ✅ | ❌ | ❌ | ❌ | Property-context (`branches.manage`) |
| **Help Center** | ✅ | ✅ | ✅ | ✅ | ✅ | Always visible |

---

## 9. Scope Context Preparation Matrix

- **ORGANIZATION-Context Pages**: Business Profile, Branches, Organization Hub, Structure & Units, Job Titles, Positions, Integrity Diagnostics, Access Control Hub, Scope Grants, Reputation & Rankings, Order Security, Inventory Settings.
- **PROPERTY-Context Pages**: Dining Setup, Cashier POS, Kitchen Queue, Waiter Assistance, Waiter Menu, Menu Overview, Categories, Stock Items, Stock Counts, Waste Tracking, Storage Locations, Payment Methods.
- **MIXED-Context Pages**: Overview Dashboard, Reports & Analytics, People Directory, Acting & Coverage, Secondments, Stock Transfers, Help Center.

---

## 10. Verification & Quality Gates

- `verify:phase31-navigation-ia`: **PASSED (16/16 assertions clean)**
- `npx tsc --noEmit`: **PASSED (0 errors)**
- `npm run lint`: **PASSED**
- `npm run build`: **PASSED (Production bundle compiled in 22.8s)**

---

**Phase 31 Step 1 Navigation & Information Architecture Audit is COMPLETE and READY FOR CHECKPOINT.**

# WSNexa — Phase 31 Canonical Navigation Map

This document serves as the single source of truth for navigation structure, permissions, and scope context requirements across the WSNexa Management Dashboard.

---

## 1. Primary Navigation Map (Level 1 & Level 2)

```
OVERVIEW
├── Dashboard                           [ /dashboard ]                           (Perm: orders.view, Scope: MIXED)
└── Reports & Analytics                 [ /dashboard/reports ]                   (Perm: reports.view, Scope: MIXED)

VENUE SETUP
├── Business Profile                    [ /dashboard/business ]                  (Perm: business.settings.manage, Scope: ORGANIZATION)
├── Public Venue Profile                [ /dashboard/venue-profile ]             (Perm: venue_profile.manage, Scope: ORGANIZATION)
├── Branches                            [ /dashboard/branches ]                  (Perm: branches.manage, Scope: ORGANIZATION)
├── Dining Setup                        [ /dashboard/dining ]                    (Perm: tables.view, Scope: PROPERTY)
├── Team & Members                      [ /dashboard/team ]                      (Perm: staff.view, Scope: ORGANIZATION)
└── Staff Invitations                   [ /dashboard/team/invites ]              (Perm: staff.invite, Scope: ORGANIZATION)

ORGANIZATION & PEOPLE
├── Organization Hub                    [ /dashboard/organization ]              (Perm: organization.view, Scope: ORGANIZATION)
├── Structure & Units                   [ /dashboard/organization/structure ]    (Perm: organization.view, Scope: ORGANIZATION)
├── Org Chart                           [ /dashboard/organization/chart ]        (Perm: organization.view, Scope: ORGANIZATION)
├── Job Titles                          [ /dashboard/organization/job-titles ]   (Perm: organization.view, Scope: ORGANIZATION)
├── Positions & Headcount               [ /dashboard/organization/positions ]    (Perm: positions.manage, Scope: ORGANIZATION)
├── People Directory                    [ /dashboard/people ]                    (Perm: people.view, Scope: ORGANIZATION)
├── Acting & Coverage                   [ /dashboard/people/acting ]             (Perm: people.view, Scope: PROPERTY)
├── Secondments                         [ /dashboard/people/secondments ]        (Perm: people.view, Scope: ORGANIZATION)
└── Integrity Diagnostics               [ /dashboard/people/integrity ]          (Perm: organization.view, Scope: ORGANIZATION)

ACCESS & GOVERNANCE
├── Access Control Hub                  [ /dashboard/access ]                    (Perm: roles.view, Scope: ORGANIZATION)
├── Roles & Templates                   [ /dashboard/access/roles ]              (Perm: roles.view, Scope: ORGANIZATION)
├── Scope Grants                        [ /dashboard/access/scope-grants ]        (Perm: roles.view, Scope: ORGANIZATION)
└── Access Diagnostics                  [ /dashboard/access/diagnostics ]        (Perm: roles.view, Scope: ORGANIZATION)

MENU
├── Menu Overview                       [ /dashboard/menu ]                      (Perm: menu.view, Scope: PROPERTY)
├── Categories                          [ /dashboard/menu/categories ]           (Perm: menu.categories.manage, Scope: PROPERTY)
└── Menu Items                          [ /dashboard/menu/items ]                (Perm: menu.view, Scope: PROPERTY)

OPERATIONS
├── Cashier POS                         [ /dashboard/cashier ]                   (Perm: cashier.access, Scope: PROPERTY)
├── Kitchen Queue                       [ /dashboard/kitchen ]                   (Perm: kitchen.access, Scope: PROPERTY)
├── Waiter Assistance                   [ /dashboard/waiter ]                    (Perm: waiter.requests.view, Scope: PROPERTY)
└── Waiter Menu                         [ /dashboard/waiter/menu ]               (Perm: waiter.orders.create, Scope: PROPERTY)

INVENTORY
├── Inventory Hub                       [ /dashboard/inventory ]                 (Perm: inventory.view, Scope: PROPERTY)
├── Stock Items                         [ /dashboard/inventory/items ]           (Perm: inventory.view, Scope: PROPERTY)
├── Stock Counts                        [ /dashboard/inventory/counts ]          (Perm: inventory.counts.manage, Scope: PROPERTY)
├── Waste Tracking                      [ /dashboard/inventory/waste ]           (Perm: inventory.waste.record, Scope: PROPERTY)
├── Stock Transfers                     [ /dashboard/inventory/transfers ]       (Perm: inventory.transfers.manage, Scope: ORGANIZATION)
├── Storage Locations                   [ /dashboard/inventory/locations ]       (Perm: inventory.locations.manage, Scope: PROPERTY)
├── Recipes & Costing                   [ /dashboard/inventory/recipes ]         (Perm: inventory.view, Scope: PROPERTY)
└── Purchasing & Suppliers              [ /dashboard/inventory/purchasing ]      (Perm: inventory.view, Scope: ORGANIZATION)

GROWTH & GUESTS
├── Customer Reviews                    [ /dashboard/reviews ]                   (Perm: reviews.respond, Scope: PROPERTY)
├── Reputation & Rankings               [ /dashboard/reputation ]                (Perm: reputation.view, Scope: ORGANIZATION)
└── Loyalty & Rewards [Soon]            [ /dashboard/loyalty ]                   (Perm: loyalty.view, Scope: ORGANIZATION)

SETTINGS
├── Order Security                      [ /dashboard/settings/order-security ]   (Perm: order_security.view, Scope: ORGANIZATION)
└── Payment Methods                     [ /dashboard/settings/payments ]         (Perm: branches.manage, Scope: PROPERTY)

SUPPORT & GUIDANCE
└── Help Center                         [ /dashboard/help ]                      (Perm: None, Scope: MIXED)
```

---

## 2. Secondary & Subnav Route Mapping (Level 3 & Level 4)

- **Access Management Subroutes**:
  - `/dashboard/access/members` (Staff Overrides Listing Tab)
  - `/dashboard/access/members/[membershipId]` (Member Access Inspector)
  - `/dashboard/access/roles/[roleId]` (Custom Role Details Inspector)
- **People & Organization Subroutes**:
  - `/dashboard/people/[membershipId]` (Employee Details Inspector)
- **Menu Subroutes**:
  - `/dashboard/menu/items/new` (Item Creator)
  - `/dashboard/menu/items/[item_id]/modifiers` (Item Modifiers Editor)
- **Inventory & Purchasing Subroutes**:
  - `/dashboard/inventory/items/new`, `/dashboard/inventory/items/[id]`
  - `/dashboard/inventory/counts/new`, `/dashboard/inventory/counts/[id]`
  - `/dashboard/inventory/recipes/new`, `/dashboard/inventory/recipes/[id]`
  - `/dashboard/inventory/suppliers`, `/dashboard/inventory/suppliers/[id]`
  - `/dashboard/inventory/purchasing/new`, `/dashboard/inventory/purchasing/[id]`
  - `/dashboard/inventory/receiving`
  - `/dashboard/inventory/production`
  - `/dashboard/inventory/settings`
- **Tables & Dining Subroutes**:
  - `/dashboard/tables`, `/dashboard/areas`, `/dashboard/tables/areas`, `/dashboard/tables/bulk`, `/dashboard/tables/new`, `/dashboard/tables/qr`
- **Support & Help Subroutes**:
  - `/dashboard/help/troubleshooting`, `/dashboard/help/category/[category]`, `/dashboard/help/[slug]`

---

## 3. Persona Navigation Filtering Principles

1. **Business Owner**: Complete unhindered visibility across all modules and setup items.
2. **Branch Manager**: High visibility scoped to assigned property; restricted from Owner-only settings (`business.settings.manage`, `branches.manage`, `order_security.view`, `scope-grants`).
3. **Cashier**: Focused on `Dashboard`, `Menu Overview`, `Menu Items`, `Cashier POS`, `Help Center`.
4. **Kitchen Staff**: Focused on `Dashboard`, `Kitchen Queue`, `Menu Items`, `Waste Tracking`, `Recipes & Costing`, `Batch Production`, `Help Center`.
5. **Waiter**: Focused on `Dashboard`, `Waiter Assistance`, `Waiter Menu`, `Waiter Order Entry`, `Help Center`.

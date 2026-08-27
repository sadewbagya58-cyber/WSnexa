# Phase 37 Step 3: Dashboard Simplification & Quick Actions
**Architecture & UX Documentation**

---

## 1. Current Dashboard Audit
Prior to Phase 37 Step 3, the `/dashboard` landing view functioned more like an enterprise module directory and system administration dashboard than a daily operational command center for hospitality owners and managers.

### Previous First-View Composition:
1. **Header**: Displayed business name, branch name, and raw timezone string (`Timezone: Asia/Colombo`).
2. **Subscription Banner**: Displayed subscription lifecycle state.
3. **Three Giant Terminal Hero Cards**: Full-width gradient cards for Cashier POS, Kitchen Display, and Waiter Terminal dominating the top viewport.
4. **Module-Count Quick Stats**: 6 cards showing static catalog counts:
   - Categories (Total Count)
   - Menu Items (Active Count)
   - Service Areas (Total Count)
   - Dining Tables (Status Counts)
   - Stock Items (Total Inventory Count)
   - RBAC & Scope V2 (Access Control Hub link)
5. **Hospitality Setup Progress**: 4-step checklist permanently occupying 2 grid columns even for long-established venues.
6. **Bloated Quick Actions**: 10 stacked action buttons (QR export, bulk tables, service area create, category add, item add, inventory count, purchase order, reports, reviews, access control).
7. **Recent System Activity**: Audit log table listing raw internal database events (`staff.login`, `role.assign`, etc.).

---

## 2. UX Problems Identified
- **Information Overload**: A small café owner was confronted with raw RBAC governance cards, technical audit logs, and catalog item counters rather than answers to "How is my business doing today?".
- **Terminal Card Dominance**: Three large operational hero cards took up over 50% of the initial screen height for owners/managers who do not operate terminals full-time.
- **Action Fatigue**: Quick actions presented 10 items duplicating almost every sidebar menu item instead of focusing on high-frequency daily tasks.
- **Permanent Onboarding Banner**: Setup progress occupied major real estate on established venues with hundreds of orders.
- **Lack of Real-Time Operational Signals**: No direct visibility on today's placed orders, active kitchen/POS queue depth, today's revenue, or pending reservations.
- **Restricted Custom Role Dead-Ends**: Previously, users assigned restricted custom roles without `orders.view` hit a 403 Access Denied block on `/dashboard` because the route guard had hardcoded `orders.view`.

---

## 3. Element Classification Matrix

| Element | Previous State | Step 3 Decision | Rationale |
|---|---|---|---|
| **Page Header** | Welcome + Timezone | **SIMPLIFY** | De-emphasize technical timezone; focus on business & branch identity |
| **Subscription Lifecycle** | Owner Banner | **KEEP** | Essential for billing transparency, trial expiration & grace period warnings |
| **RBAC & Scope V2 Card** | First View Hero Card | **REMOVE FROM FIRST VIEW** | Technical governance remains under `/dashboard/team` & `/dashboard/access` |
| **Audit Logs Table** | First View Activity | **REMOVE FROM FIRST VIEW** | Raw system events belong in dedicated audit/security screens |
| **Categories Count Card** | First View Metric | **REMOVE FROM FIRST VIEW** | Catalog setup count is not a daily operational KPI |
| **Menu Items Count Card** | First View Metric | **REMOVE FROM FIRST VIEW** | Static item count does not provide daily actionable insight |
| **Service Areas Count Card**| First View Metric | **REMOVE FROM FIRST VIEW** | Structural setup count; accessible via Dining workspace |
| **Stock Items Total Card** | First View Metric | **SIMPLIFY → LOW STOCK** | Replace total inventory count with actionable low-stock warning |
| **Cashier/Kitchen/Waiter** | 3 Giant Hero Cards | **SIMPLIFY → SHORTCUTS BAR**| Compact 3-chip horizontal bar for quick terminal jumping |
| **Orders Today** | Missing | **ADD** | Answers "What is happening today?" immediately |
| **Active Queue Depth** | Missing | **ADD** | Real-time live indicator of pending tickets |
| **Revenue Today** | Missing | **ADD (Permission-Gated)** | Key financial KPI for authorized owners/managers (`reports.financial.view`) |
| **Reservations Today** | Missing | **ADD (Permission-Gated)** | Immediate visibility into scheduled guest bookings (`reservations.view`) |
| **Needs Attention** | Missing | **ADD (Conditional)** | Surfacing pending bookings, low stock, and waiter calls only when active |
| **Quick Actions** | 10 Buttons | **SIMPLIFY (Max 4)** | Top 4 high-frequency tasks (+ Add Item, View Orders, Manage Dining, Invite Staff) |
| **Setup Progress** | Permanent Checklist | **CONDITIONAL** | Automatically disappears once menu and tables are configured |
| **Restricted Role Landing**| Access Denied | **ADD (Generic Fallback)** | Renders dynamic "Your Workspace" cards derived from canonical nav resolver |

---

## 4. Final Dashboard Structure

The simplified dashboard follows a strict, mobile-first visual hierarchy:

```
┌────────────────────────────────────────────────────────┐
│ 1. Header: Welcome to [Business] • Branch [Name]       │
│    Primary CTA [Open POS / Dining]  Secondary [+ Item] │
├────────────────────────────────────────────────────────┤
│ 2. Subscription Lifecycle Banner (Trial/Grace/Warning) │
├────────────────────────────────────────────────────────┤
│ 3. Needs Attention (Conditional — hidden if empty)     │
│    [⚠️ 3 Pending Reservations] [⚠️ 2 Items Low Stock] │
├────────────────────────────────────────────────────────┤
│ 4. Today's Performance (Key Numbers)                  │
│    [Orders Today] [Active Queue] [Revenue] [Bookings]  │
├────────────────────────────────────────────────────────┤
│ 5. Live Operational Terminals (Compact Chip Bar)       │
│    [💳 Cashier POS]   [👨‍🍳 Kitchen Queue]   [📋 Waiter]  │
├────────────────────────────────────────────────────────┤
│ 6. Quick Actions (Max 4 High-Frequency Actions)        │
│    [+ Add Menu Item] [📋 View Orders] [🍽️ Dining] [...] │
├────────────────────────────────────────────────────────┤
│ 7. Hospitality Setup Progress (Only if setup pending) │
└────────────────────────────────────────────────────────┘
```

For restricted / non-operational roles, sections 3–7 are replaced by:
```
┌────────────────────────────────────────────────────────┐
│ Your Workspace(s)                                      │
│ [⚙️ Settings & Business Details] [Open Business →]    │
└────────────────────────────────────────────────────────┘
```

---

## 5. Today Metrics Specification

| Metric | Source Table / RPC | Gating Permission | Empty State Text |
|---|---|---|---|
| **Orders Today** | `orders` (`created_at >= today_utc`, `status != 'cancelled'`) | `orders.view` \|\| `cashier.access` \|\| Owner \|\| Manager | "No orders yet today" |
| **Active Queue** | `orders` (`status IN ('pending', 'confirmed', 'preparing', 'ready')`) | `orders.view` \|\| `cashier.access` \|\| Owner \|\| Manager | "0" ("Clear") |
| **Revenue Today** | `get_branch_sales_summary` RPC (`paid_revenue_cents`) | `reports.financial.view` \|\| Owner | Formatted Currency (`$0.00`) |
| **Reservations Today** | `reservations` (`reservation_date = today_local`, `status NOT IN ('CANCELLED', 'DECLINED')`) | `reservations.view` \|\| Owner \|\| Manager | "No reservations today" |
| **Floor Tables** | `dining_tables` (`status = 'available' / 'occupied' / 'reserved'`) | `tables.view` \|\| `tables.manage` \|\| Owner \|\| Manager | "No tables configured" |
| **Low Stock** | `inventory_items` JOIN `inventory_balances` (`stock <= min_stock_level`) | `inventory.view` \|\| `inventory.items.manage` \|\| Owner \|\| Manager | Card hidden if 0 |

---

## 6. Needs Attention Section Specification

- **Non-Alarmist Behavior**: The entire section returns `null` if there are no pending attention items.
- **Trigger Conditions**:
  1. `pendingReservationsCount > 0` → "N Pending Reservations — Guest bookings awaiting staff confirmation."
  2. `lowStockCount > 0` → "N Items Low in Stock — Inventory items below minimum reorder threshold."
  3. `pendingWaiterCount > 0` → "N Table Calls Active — Guests waiting for waiter assistance on dining floor."
  4. `!setupComplete` (for Owners/Managers) → "Initial Venue Setup Incomplete — Finish setting up: [Menu Items, Dining Tables]."

---

## 7. Quick Actions Specification
Capped at **maximum 4 high-frequency items** derived from effective permissions:
1. `+ Add Menu Item` (`/dashboard/menu/items`) — Requires `menu.items.create`, `menu.manage` or Owner
2. `📋 View Orders` (`/dashboard/orders`) — Requires `orders.view`, `cashier.access`, Owner, or Manager
3. `🍽️ Manage Dining` (`/dashboard/dining`) — Requires `tables.manage`, Owner, or Manager
4. `👥 Invite Staff` (`/dashboard/team/invites`) — Requires `staff.invite`, `staff.manage`, or Owner
5. `📈 View Reports` (`/dashboard/reports`) — Fallback for analytics-focused roles lacking operational mutations

---

## 8. Operational Shortcuts
Compact, 3-column chip row with direct links to live operational workspaces:
- `[💳 Cashier POS]` → `/dashboard/cashier`
- `[👨‍🍳 Kitchen Queue]` → `/dashboard/kitchen`
- `[📋 Waiter Service]` → `/dashboard/waiter`

Each chip evaluates role capability permissions independently and remains hidden if the user lacks access.

---

## 9. Setup Progress Behavior
- Evaluates: `categoriesCount > 0 && menuItemsCount > 0 && serviceAreasCount > 0 && tablesCount > 0`.
- If `setupComplete === true`: Disappears completely from the dashboard, saving critical viewport space for live business operations.
- If `setupComplete === false`: Renders a 4-step card highlighting missing components with direct setup buttons.

---

## 10. Subscription Banner Behavior
- Preserves `OwnerSubscriptionLifecycleBanner` component.
- Visible only to Business Owners.
- Displays appropriate alerts for Trial period countdown, Grace period payment warnings, Suspended recovery actions, and Platform suspension notices.

---

## 11. Role-Aware Dashboard & Navigation Behavior

| Role | Today Numbers | Needs Attention | Terminals Bar | Quick Actions | Setup Checklist | Landing UX |
|---|---|---|---|---|---|---|
| **Business Owner** | Orders, Queue, Revenue, Bookings, Tables | All alerts | POS, Kitchen, Waiter | 4 items | Yes (if incomplete) | Full Dashboard Overview |
| **Branch Manager** | Orders, Queue, Bookings, Tables (No Revenue unless financial permitted) | Operational alerts | Permitted terminals | 4 items | Yes (if incomplete) | Full Dashboard Overview |
| **Cashier** | Lands on `/dashboard/cashier` | N/A | N/A | N/A | N/A | Cashier POS Terminal |
| **Kitchen Staff** | Lands on `/dashboard/kitchen` | N/A | N/A | N/A | N/A | Kitchen Display Queue |
| **Waiter** | Lands on `/dashboard/waiter` | N/A | N/A | N/A | N/A | Waiter Service Terminal |
| **Custom (business.view)** | None | None | None | None | No | "Your Workspace" → `/dashboard/business` |
| **Custom (areas.view)** | None | None | None | None | No | "Your Workspace" → `/dashboard/areas` |
| **Custom (menu.view)** | None | None | None | None | No | "Your Workspace" → `/dashboard/menu` |
| **Custom (zero perms)** | None | None | None | None | No | "No Workspace Access" empty state |

---

## 12. Restricted Custom-Role Architecture & Route Security Hotfix
In the Phase 37 Step 3 Restricted Custom Role Hotfix:
1. **Route Guard Generalization**:
   - `ROUTE_PERMISSION_MAP` and `RoutePermissionConfig` now accept `PermissionKey | PermissionKey[]`.
   - `requireRoutePermission(pathname)` evaluates candidate arrays in a loop using the server-resolved authoritative `ResourceScope`.
   - `/dashboard` root route has no restrictive route guard (returns `null`), allowing all authenticated business members to load their workspace.
2. **Dynamic Navigation Href Resolution**:
   - `resolveDashboardNavigation(authContext)` dynamically resolves the target URL for restricted users (e.g. `Settings` resolves to `/dashboard/business` if the user has `business.view`, and `Dining & QR` resolves to `/dashboard/areas` if the user has `areas.view`).
3. **Parent Hub Collapse Invariant**:
   - Parent navigation hubs remain visible if the user possesses ANY permitted child capability.
4. **Read-Only Mode Enforcement**:
   - Subroutes like `/dashboard/areas` verify route permissions via `requireRoutePermission('/dashboard/areas')` and enforce `canManage: false` when the user only has view permissions, cleanly disabling mutation CTAs.

---

## 13. Mobile Behavior
- **Zero Horizontal Overflow**: All grids use responsive Tailwind classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- **Touch Targets**: All interactive links and buttons enforce `min-h-[44px]` (or `min-h-[48px]`) with `touch-manipulation`.
- **Vertical Hierarchy**: Priority ordered: Header → Banner → Attention → Today Metrics → Shortcuts → Quick Actions.

---

## 14. Security & RBAC Invariants
- **No Service Role in Frontend**: Queries are executed strictly server-side in Server Components.
- **Strict Server Gating**: Metric queries only execute if the user's evaluated `model` flag is `true` (preventing unauthorized DB queries).
- **Server Guard Intact**: `requireRoutePermission` protects every operational and administrative subroute.
- **Direct ResourceScope**: Authorization queries pass authoritative `ResourceScope` objects without redundant database roundtrips.

---

## 15. Manual QA Checklist

### A. Business Owner Desktop
- [ ] Log in as Business Owner.
- [ ] Verify Header shows "Welcome to [Business]" and "Active Branch: [Branch]".
- [ ] Confirm timezone string is removed from page header description.
- [ ] Confirm "Today's Performance" displays Orders Today, Active Queue, Revenue Today, Reservations, and Floor Tables.
- [ ] Verify "RBAC & Scope V2" and "Access Control Hub" cards are NOT on the dashboard.
- [ ] Verify "Recent System Activity" (audit log) is NOT on the dashboard.
- [ ] Verify Live Operational Terminals renders as a compact 3-chip bar (POS, Kitchen, Waiter).
- [ ] Verify Quick Actions contains at most 4 high-frequency action buttons.

### B. Small Café Owner (Setup Complete)
- [ ] Create/use a venue with at least 1 menu item and 1 table.
- [ ] Confirm "Hospitality Setup Progress" is hidden from the dashboard.
- [ ] Confirm dashboard feels clean, simple, and uncluttered.

### C. Branch Manager (No Financial Permission)
- [ ] Log in as Branch Manager without `reports.financial.view`.
- [ ] Confirm "Revenue Today" card is hidden.
- [ ] Confirm "Orders Today", "Active Queue", and "Floor Tables" are visible.

### D. Custom Restricted Role (business.view only)
- [ ] Log in as custom role with only `business.view` (base role `cashier`).
- [ ] Confirm `/dashboard` loads successfully without 403 "You don't have permission to access this area."
- [ ] Confirm header badge displays the actual custom role name, NOT "Cashier".
- [ ] Confirm sidebar shows "Settings" linking to `/dashboard/business`.
- [ ] Confirm "Your Workspace" card displays Business Details with direct "Open Business Details →" button.

### E. Custom Restricted Role (areas.view only)
- [ ] Log in as custom role with only `areas.view`.
- [ ] Confirm `/dashboard` loads successfully and shows "Dining & QR" workspace.
- [ ] Click "Open Dining & QR →" or navigate to `/dashboard/areas`.
- [ ] Confirm Service Areas page renders in read-only mode (no "+ Create Area", no Edit/Delete buttons, ordering mode read-only).

### F. Operational Terminals Direct Experience
- [ ] Log in as built-in Cashier → confirm direct redirect to `/dashboard/cashier`.
- [ ] Log in as built-in Kitchen Staff → confirm direct redirect to `/dashboard/kitchen`.
- [ ] Log in as built-in Waiter → confirm direct redirect to `/dashboard/waiter`.

### G. Mobile Layout
- [ ] View `/dashboard` in mobile viewport (375px - 428px).
- [ ] Confirm cards stack 1-column with zero horizontal scrolling.
- [ ] Confirm all action chips and buttons are easily tappable (min 44px height).

---

## 16. Risks & Known Limitations
- **Intra-Day Revenue Currency**: The Revenue Today card queries the branch sales summary and formats according to the business's default currency. Multi-currency reporting remains available in the full Reports workspace.
- **Point-in-Time Low Stock**: Low stock calculations compare current inventory balances against `min_stock_level`. If minimum stock levels are not configured, items will not trigger low stock warnings.

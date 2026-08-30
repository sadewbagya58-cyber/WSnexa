# WSNexa Performance Root Causes Analysis

## 1. Deep Root Cause Categorization

### Root Cause 1: Unconditional Multi-Query Auth Waterfall
- **Location**: `src/server/auth/authorization-context.ts`
- **Mechanism**: The resolver queried 10 database tables concurrently (`branches`, `branch_assignments`, `staff_assignments`, `staff_area_assignments`, `role_permissions`, `member_permission_overrides`, `permission_scope_grants`, `role_scope_presets`, `organization_departments`, `organization_units`).
- **Failure Mode**: For a `business_owner`, all role permission overrides, scope grants, staff assignments, and presets are bypassed by policy definition (`ALLOWED_OWNER`), yet they were fetched over the network on every server action and page navigation.

### Root Cause 2: Full-Tree RSC Refresh on Local Operational Mutations
- **Location**: `src/components/waiter/waiter-request-center.tsx` & `src/components/kitchen/kitchen-order-queue.tsx`
- **Mechanism**: When operational buttons (e.g., "Accept Request", "Start Preparing") were tapped, components triggered `router.refresh()`.
- **Failure Mode**: This forced Next.js to re-execute the entire server layout and page tree, fetching fresh authorization context and re-querying all database entities over the network, rather than relying on the active Supabase Postgres realtime sync channel.

### Root Cause 3: Unbounded Historical Querying in Cashier Services
- **Location**: `src/server/services/payment.service.ts` (`getCashierOrders`)
- **Mechanism**: Queried all orders ever placed in the branch without a status filter, date range bound, or record limit.
- **Failure Mode**: The query payload grew linearly with store transaction history, pulling deep nested joins (`order_items`, `order_item_modifiers`, `dining_tables`) across settled orders from months prior.

### Root Cause 4: Main-Thread Blocking in Low-End Mobile QR Menu
- **Location**: `src/components/qr/public-guest-menu.tsx` & `src/components/menu/menu-item-card.tsx`
- **Mechanism**: The menu item catalog was unmemoized. Adding an item to the cart re-rendered all 50+ item cards.
- **Failure Mode**: Images lacked explicit dimensions and asynchronous decoding flags, triggering synchronous decoding and layout recalculation on the mobile browser main thread.

### Root Cause 5: Missing Database Composite Indexes
- **Location**: Database Schema (`public.staff_assignments`, `public.orders`, `public.waiter_requests`)
- **Mechanism**: Query filters on composite columns (`branch_id + status + created_at DESC`, `business_membership_id + status`) relied on single-column indexes or sequential index scans.

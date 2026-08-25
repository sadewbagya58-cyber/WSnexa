# WSNexa V1 Core Notification System — Technical Architecture & Operating Manual

---

## 1. Purpose & Scope

The **WSNexa V1 Core Notification System** provides a lightweight, clean, and reliable in-app operational notification system for authenticated restaurant and hotel staff members. 

It is designed to keep staff informed of critical domain events (new orders, waiter assistance requests, bill requests, reservation bookings, and reservation cancellations) in realtime across all authorized branches without requiring constant manual branch-switching or active page navigation.

---

## 2. Core Architecture

The system consists of 6 primary layers:

```
┌───────────────────────────────┐
│     Domain Event Hooks        │ (Order, Waiter Request, Reservation Services)
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│     NotificationService       │ Capability-Based Recipient Resolution & Idempotency
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│     public.notifications      │ Per-User Persisted DB Rows (read_at IS NULL = Unread)
└───────────────┬───────────────┘
                │
                ├───────────────────────────────────────┐
                ▼                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│  Supabase Realtime            │       │  NotificationBell Component   │
│  recipient_user_id=eq.${id}   │       │  Header Bell 🔔 & Popover     │
└───────────────────────────────┘       └───────────────────────────────┘
```

### Key Architectural Invariants:
1. **Per-User Ownership (`recipient_user_id NOT NULL`)**:
   Every notification row belongs strictly to an individual recipient user. Shared role-targeted notification rows are eliminated to prevent read state conflicts between staff members.
2. **Capability-Based Resolution**:
   Recipient selection is performed server-side using WSNexa RBAC v2 canonical capabilities (`orders.view`, `kitchen.orders.view`, `waiter.requests.view`, `cashier.access`, `reservations.view`) and active branch scope grants. Staff role string checks are prohibited.
3. **Server-Level Idempotency (`dedupe_key`)**:
   Each notification enforces a deterministic unique `dedupe_key` formatted as `<notificationType>:<entityId>:<recipientUserId>`. Batch insertion executes via `ON CONFLICT (dedupe_key) DO NOTHING` to guarantee zero duplicate rows on retries or concurrent events.
4. **Single Source of Truth for Read State**:
   `read_at IS NULL` represents unread status. `read_at IS NOT NULL` (storing timestamp) represents read status. Redundant `is_read` boolean columns are excluded.
5. **Strict RLS Security**:
   Direct client mutations (`INSERT`, `UPDATE`, `DELETE`) are revoked from client users. Insertion is strictly server-side via `service_role`. Row selection is guarded by `recipient_user_id = auth.uid()`. Read state updates are executed via server actions enforcing user ownership.
6. **Multi-Branch Cross-Reach**:
   User-centric Realtime subscriptions (`recipient_user_id=eq.${userId}`) deliver notifications from all authorized properties into a single header bell. Each notification carries `branch_id` and `branchName` resolved dynamically.

---

## 3. Supported V1 Events

| Event Type | Priority | Triggering Location | Canonical Required Permission | Default Action URL |
| :--- | :--- | :--- | :--- | :--- |
| `ORDER_CREATED` | `high` | `OrderService.createGuestOrder` / `createStaffOrder` | `orders.view` / `kitchen.orders.view` | `/dashboard/kitchen` |
| `WAITER_REQUEST_CREATED` | `high` | `WaiterService.createWaiterRequest` | `waiter.requests.view` | `/dashboard/waiter` |
| `BILL_REQUESTED` | `urgent` | `WaiterService.createWaiterRequest` (`need_bill`) | `cashier.access` | `/dashboard/cashier` |
| `RESERVATION_CREATED` | `high` | `ReservationService.createReservation` | `reservations.view` | `/dashboard/reservations` |
| `RESERVATION_CANCELLED` | `high` | `ReservationService.cancelReservation` | `reservations.view` | `/dashboard/reservations` |

---

## 4. Recipient Resolution & Fan-Out Rules

Recipient resolution is executed conservatively by `NotificationService.createNotificationsForCapability`:

1. Queries active business memberships (`membership_status = 'active'`) for the target `business_id`.
2. Resolves each member's `AuthorizationContext` and verifies authorized branch reach (`authorizedBranchIds`).
3. Evaluates capability permission via `can({ context, permission, resource: { type: 'branch', id: branchId } })`.
4. **Area-Aware Waiter Targeting**: For `WAITER_REQUEST_CREATED` on tables assigned to a `service_area_id`, the system checks `staff_invitation_areas` and prioritizes staff assigned to that specific service area.
5. Constructs deterministic `dedupe_key` values and executes batch insert.

---

## 5. User Experience & Header Bell Component

- **Location**: Top header bar of [`DashboardShell`](file:///c:/Users/x/.antigravity/wsnexa/src/components/layout/dashboard-shell.tsx).
- **Unread Badge**: Displays a red unread count badge (`🔴 3`) on the bell icon when `unreadCount > 0`.
- **Dropdown Popover**: Opens a responsive panel showing recent 20 notifications with:
  - Notification title & message
  - Property display tag (`🏢 Main Branch`)
  - Relative timestamp (`2m ago`, `Just now`)
  - Unread blue dot indicator (`readAt === null`)
  - **"Mark all read"** control in popover header
- **Click Navigation**: Clicking a notification marks it as read, closes the popover, and navigates to its internal `actionUrl`.
- **URL Sanitization**: `sanitizeInternalUrl()` strictly enforces internal dashboard/customer paths (`/dashboard/*`, `/customer/*`). External URLs (`http://`, `https://`, `javascript:`) are rejected.

---

## 6. Reservation Outbox Separation

- **`reservation_outbox_notifications`**: Dedicated 100% to external guest SMS/Email outbound queueing.
- **`public.notifications`**: Dedicated 100% to authenticated staff in-app notifications.
- **Isolation**: The Phase 35 reservation outbox remains completely untouched and independent.

---

## 7. Explicitly Deferred Functionality (Post-V1)

The following features are **explicitly excluded** from V1.0 to prevent scope creep:

1. External SMS provider SDK integrations (Twilio, AWS SNS).
2. WhatsApp Business API messaging.
3. Automated marketing/promotional customer campaigns.
4. Native mobile push notification tokens (APNs, FCM).
5. Multi-step automated escalation workflows.
6. AI-generated notification summaries.
7. External supplier PO delivery delay notifications.

---

## 8. Verification & Test Suite

The notification system is verified via [`scripts/verify-v1-notifications.ts`](file:///c:/Users/x/.antigravity/wsnexa/scripts/verify-v1-notifications.ts) (`npm run verify:v1-notifications`), covering:
- Schema, index, and RLS security validation.
- `NotificationService` API, deduplication idempotency, and capability filtering.
- Server action user context resolution.
- Domain event hook integration across orders, waiter requests, and reservations.
- Preservation of existing KDS, Waiter, Cashier, and Reservation outbox systems.
- Step 2 Realtime hook, `actionUrl` sanitization, and `DashboardShell` header bell integration.

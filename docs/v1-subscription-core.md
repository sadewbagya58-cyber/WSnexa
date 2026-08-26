# WSNexa V1 Subscription Core — Architecture & Operational Documentation

## Overview
WSNexa V1 Subscription Core implements a commercial SaaS subscription engine for multi-tenant hotel, restaurant, and hospitality venues. It establishes plan definitions, resource quotas, lifecycle state calculations, server-side operational enforcement, real-time UX propagation, and Super Admin management.

---

## 1. Commercial Pricing & Plan Tiers

### Starter
- **Price:** LKR 4,499 / month
- **Quotas:**
  - 1 Branch / Property
  - 10 Active Staff Members
  - 50 Dining Tables
  - 250 Menu Items
  - 3 Custom Roles

### Growth
- **Price:** LKR 8,999 / month
- **Quotas:**
  - 3 Branches / Properties
  - 40 Active Staff Members
  - 150 Dining Tables
  - 1,000 Menu Items
  - 10 Custom Roles

### Enterprise
- **Price:** Custom Pricing (Contact Sales)
- **Quotas:**
  - Unlimited Branches (`null`)
  - Unlimited Active Staff (`null`)
  - Unlimited Dining Tables (`null`)
  - Unlimited Menu Items (`null`)
  - Unlimited Custom Roles (`null`)
- **Finite Custom Overrides:** Super Admin can specify custom integer overrides for any resource (`max_branches_override`, `max_staff_override`, `max_tables_override`, `max_menu_items_override`, `max_custom_roles_override`). Zero magic `999999` sentinels are used.

---

## 2. 14-Day Core Product Trial Entitlements Model

New businesses receive a 14-day initial trial upon onboarding completion. Rather than being artificially restricted as a Starter subscription during evaluation, trial accounts receive access to full/core WSNexa product capabilities (POS, Kitchen, Waiter, QR ordering, Reservations, Menu, CRM, Reports, Inventory, Organization, RBAC).

- **Trial Limits Profile (`TRIAL_ENTITLEMENT_LIMITS`)**:
  - 3 Branches
  - 40 Active Staff Members
  - 150 Dining Tables
  - 1,000 Menu Items
  - 10 Custom Roles
- Stored `plan_code` remains `'starter'` (default post-trial plan).

---

## 3. Subscription Lifecycle States

Subscriptions transition through five stored and effective lifecycle states:

1. **`trialing` / `TRIALING`**: 14-day initial trial provisioned automatically during business onboarding. All features operational.
2. **`active` / `ACTIVE`**: Paid/complimentary subscription active through `current_period_ends_at`. All features operational.
3. **`grace_period` / `GRACE_PERIOD`**: 7-day operational grace period following trial or period expiration (`grace_ends_at > now()`). All operational features remain active; top warning banner displayed to business owner.
4. **`suspended` / `SUSPENDED`**: Commercial subscription suspended (`grace_ends_at < now()` or manual Super Admin suspension). Operational modules blocked; staff redirected to `/account/pending-access?reason=subscription_suspended`; business owner allowed access to `/dashboard/settings/subscription` reactivation portal. Public QR ordering & reservations blocked (`Reservations Unavailable` / `Ordering Unavailable`).
5. **`cancelled` / `CANCELLED`**: Subscription explicitly cancelled by Super Admin. All tenant data (branches, staff, orders, menu, inventory, CRM, reservations, reports) remains **100% intact**.

---

## 4. Unified Access State & Server-Side Security Enforcement

### Unified Access Resolver (`resolveUnifiedAccessState`)
Single canonical access state interpreter with strict priority:
1. **Platform Security Ban (`businesses.status === 'suspended'` or `'archived'`)**: Absolute priority (`reason = 'platform_suspended'`).
2. **Commercial Suspension (`effectiveStatus === 'SUSPENDED'`)**: `reason = 'subscription_suspended'`.
3. **Commercial Cancellation (`effectiveStatus === 'CANCELLED'`)**: `reason = 'subscription_cancelled'`.
4. **Operational**: All features enabled.

### Authoritative Operational Guard (`SubscriptionService.assertOperationalSubscription`)
Client realtime and UI redirection are **UX enhancements only**, NOT security boundaries. Every operational mutation (menu, orders, POS, reservations, tables, staff invites, roles, inventory, CRM, organization) invokes `SubscriptionService.assertOperationalSubscription(businessId)` server-side. Restricted subscriptions fail atomically on the server before modifying tenant state.

### Pending-Access Auto-Recovery
`/account/pending-access` re-resolves current DB state on every server render/refresh. When Super Admin reactivates a suspended/cancelled business or subscription, visiting or refreshing `/account/pending-access` automatically redirects the user back to `/dashboard`.

---

## 5. Supabase Realtime UX Propagation

`public.business_subscriptions` and `public.businesses` are registered in the `supabase_realtime` Postgres publication. `SubscriptionRealtimeListener` subscribes to business-scoped updates. Status changes, date changes, and platform status changes immediately trigger client route updates / view refreshes without requiring manual browser reloads.

---

## 6. Super Admin Controls & Audit Logging

Super Admin management at `/admin/businesses/[id]`:
- **Activation Source & Reason**: Manual activations record `activation_source = 'manual_admin'`, while the selected reason (`bank_transfer`, `pilot_account`, `complimentary`, `gateway_issue`, `other`) is logged in event/audit metadata and notes.
- **State-Aware Actions**: Action controls dynamically adapt based on effective status (e.g. `Suspend` and `Cancel` are hidden when already `CANCELLED`).
- **Audit Integration**: Every subscription mutation writes to `business_subscription_events` AND platform `audit_logs`.
- **In-App Notifications**: Owner notifications (`SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_GRACE_STARTED`, `SUBSCRIPTION_SUSPENDED`, `SUBSCRIPTION_REACTIVATED`, `SUBSCRIPTION_CANCELLED`) are persisted with valid `branch_id` references.

---

## 7. Dialog Payment Gateway Boundary

Online subscription payment gateway integration is deferred to post-V1 steps. Owner CTAs on `/dashboard/settings/subscription` display an honest manual activation notice: *"Online subscription payments coming soon. Contact WSNexa support or sales for manual activation."*. Zero fake payment transactions are generated. Pricing is displayed in **LKR** (Starter: LKR 4,499/mo, Growth: LKR 8,999/mo).

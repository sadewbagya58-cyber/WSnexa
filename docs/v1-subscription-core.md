# WSNexa V1 Subscription Core — Architecture & Operational Documentation

## Overview
WSNexa V1 Subscription Core implements a commercial SaaS subscription engine for multi-tenant hotel, restaurant, and hospitality venues. It establishes plan definitions, resource quotas, lifecycle state calculations, access enforcement, and Super Admin management.

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

## 2. Subscription Lifecycle States

Subscriptions transition through five stored and effective lifecycle states:

1. **`trialing` / `TRIALING`**: 14-day initial trial provisioned automatically during business onboarding. All features operational.
2. **`active` / `ACTIVE`**: Paid/complimentary subscription active through `current_period_ends_at`. All features operational.
3. **`grace_period` / `GRACE_PERIOD`**: 7-day operational grace period following trial or period expiration (`grace_ends_at > now()`). All operational features remain active; top warning banner displayed to business owner.
4. **`suspended` / `SUSPENDED`**: Commercial subscription suspended (`grace_ends_at < now()` or manual Super Admin suspension). Operational modules blocked; staff redirected to `/account/pending-access?reason=subscription_suspended`; business owner allowed access to `/dashboard/settings/subscription` reactivation portal. Public QR ordering & reservations blocked (`Reservations Unavailable` / `Ordering Unavailable`).
5. **`cancelled` / `CANCELLED`**: Subscription explicitly cancelled by Super Admin. All tenant data (branches, staff, orders, menu, inventory, CRM, reservations, reports) remains **100% intact**.

---

## 3. Platform vs. Commercial Suspension Precedence

A fundamental invariant of WSNexa security is the strict separation of platform administrative status (`businesses.status`) and commercial subscription status (`business_subscriptions.status`).

- **Platform Security Ban (`businesses.status === 'suspended'` or `'archived'`)**:
  - Always takes **absolute priority** over commercial subscription status.
  - A paid or active subscription row can **NEVER** bypass a platform security ban.
  - All users (owners and staff) are redirected to `/account/pending-access?reason=platform_suspended`.
- **Commercial Subscription Suspension (`business_subscriptions.status === 'suspended'`)**:
  - Affects operational modules only.
  - Business Owner retains access to `/dashboard/settings/subscription`.

---

## 4. Resource Quota & Downgrade Enforcement

Quotas are authoritatively enforced server-side across five creation paths:
1. **Branches**: `BranchService.createBranch`
2. **Staff**: `StaffInvitationService.createInvitation`
3. **Tables**: `createDiningTableAction`
4. **Menu Items**: `createMenuItemAction`
5. **Custom Roles**: `RoleGovernanceService.createCustomRole`

### Downgrade Rules
When a business requests or undergoes a plan downgrade (e.g. Growth $\rightarrow$ Starter), `SubscriptionService.validateDowngradeEligibility` validates current usage against destination plan limits. If usage exceeds target limits, the downgrade is **BLOCKED** and **ALL conflict details are returned** (e.g. Branches: 3/1, Staff: 18/10). WSNexa never automatically deletes tenant data during downgrades.

---

## 5. Super Admin Controls & Fallback Activation

Super Admin management is accessible at `/admin/businesses/[id]`:
- **Manual Activation**: Supports manual commercial activation specifying Plan, Period End (+30d, +90d, +1y), and Reason (`bank_transfer`, `pilot_account`, `complimentary`, `gateway_issue`, `other` + required notes).
- **Trial Extension**: Extends `trial_ends_at` with mandatory reason.
- **Grace Extension**: Extends `grace_ends_at` with mandatory reason.
- **Plan Changes & Enterprise Overrides**: Immediate upgrade / compliant downgrade validation; finite custom overrides for Enterprise.
- **Commercial Suspension & Reactivation**: Commercial suspend/reactivate actions with mandatory audit reasons.
- **Cancellation**: Explicit cancellation preserving all underlying tenant database records.

---

## 6. Audit & History Logging

- **`business_subscription_events`**: Stores commercial subscription lifecycle events (`activated`, `trial_extended`, `grace_extended`, `plan_changed`, `manual_override`, `suspended`, `reactivated`, `cancelled`) with deterministic `dedupe_key` idempotency.
- **`audit_logs`**: System audit trail capturing Super Admin actor, action, and metadata.
- **In-App Notifications**: Emits owner notifications (`SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_GRACE_STARTED`, `SUBSCRIPTION_SUSPENDED`, `SUBSCRIPTION_REACTIVATED`).

---

## 7. Operational vs. Billing Currency

- **Operational Currency**: Configured per venue/branch (e.g. LKR, USD, EUR) for menu items, customer orders, and receipt printing.
- **SaaS Billing Currency**: Fixed in **LKR** (LKR 4,499/mo Starter, LKR 8,999/mo Growth).

---

## 8. Dialog Payment Gateway Boundary

Online subscription payment gateway integration is deferred to post-V1 infrastructure steps. Owner CTAs on `/dashboard/settings/subscription` display an honest manual activation notice: *"Online subscription payments coming soon. Contact WSNexa support or sales for manual activation."*. Zero fake payment transactions are generated.

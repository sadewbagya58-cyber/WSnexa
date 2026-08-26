# Phase 36 — Subscription Payments Foundation & Dialog Readiness Closure Checklist

## Executive Summary
Phase 36 establishes the standalone SaaS subscription billing domain, canonical LKR server-authoritative pricing engine, Enterprise scale configurator, owner checkout flow, provider-neutral gateway architecture, owner billing history, Super Admin payment management console, and settlement security boundaries.

---

## Production QA Checklist

### Automated Verification Suites (PASS)
- [x] **Starter Pricing**: LKR 4,499 / month
- [x] **Growth Pricing**: LKR 8,999 / month
- [x] **Enterprise Pricing Formula**: Base LKR 24,999 + LKR 3,000/extra branch + LKR 2,000/extra 25-staff block
- [x] **Enterprise Staff Block Ceiling**: Exact values 75 (0 blocks), 76 (1 block), 100 (1 block), 101 (2 blocks), 200 (5 blocks), 201 (6 blocks)
- [x] **Server-Authoritative Pricing**: Client estimates overridden by server calculation
- [x] **Immutable Pricing Snapshots**: Persisted in `business_subscription_payments`
- [x] **Payment Purpose Classification**: `new_subscription`, `upgrade`, `downgrade`, `renewal`, `reactivation`
- [x] **Payment State Machine**: Legal transitions enforced (`pending` $\rightarrow$ `processing`/`paid`/`failed`/`cancelled`/`expired`, `paid` $\rightarrow$ `refunded`)
- [x] **Illegal State Transitions**: Blocked securely with `INVALID_PAYMENT_TRANSITION`
- [x] **Idempotency Keying**: Prevents duplicate pending payment intent creation
- [x] **Owner Checkout Authorization**: Owner-only access; staff denied
- [x] **Owner Billing Tenant Isolation**: Business Owners query own business payments only
- [x] **Owner PENDING Intent Cancellation**: Owner cancels own pending intent without admin reason (`admin_reason = null`)
- [x] **Owner Cancellation Audit Attribution**: `payment.cancelled_by_owner` records authenticated owner `actor_id`
- [x] **Super Admin Cancellation Reason**: `payment.cancelled_by_admin` strictly requires administrative reason string
- [x] **Super Admin Cancellation Audit Attribution**: Records authenticated Super Admin `actor_id`
- [x] **Super Admin Expiration Audit Attribution**: `payment.expired_by_admin` records authenticated Super Admin `actor_id`
- [x] **Super Admin Route Authorization**: `/admin/subscription-payments` requires `requireSuperAdmin()`
- [x] **Canonical Admin Shell**: `/admin/subscription-payments` inherits `AdminLayout` and `AdminNavbar`
- [x] **Dual-Role User Behavior**: Displays Business Owner shell on `/dashboard/*` and Platform Admin shell on `/admin/*`
- [x] **Short Payment Reference Search**: Searches displayed 8-char ref (e.g. `55edde45` or `#55edde45`) via `id_text` generated column
- [x] **Malformed Search Handling**: Returns clean empty state without server exception or page crash
- [x] **Combined Filters**: Status, Provider, Purpose, Plan, Search combine seamlessly
- [x] **Pagination & Count**: 10 records/page (Owner), 20 records/page (Admin)
- [x] **Provider Registry**: `onepay`, `dialog`, `payhere` all default to `enabled: false`
- [x] **Return & Webhook Boundaries**: Reject disabled/unconfigured providers safely
- [x] **Settlement Verification**: Amount match, currency match (`LKR`), provider transaction ID uniqueness
- [x] **Platform Suspension Protection**: Suspended businesses cannot be reactivated via payment settlement
- [x] **Manual Activation Separation**: Super Admin manual activation operates on subscription lifecycle without fabricating fake `paid` payment rows
- [x] **Customer Order Domain Isolation**: Venue guest orders and cashier POS remain 100% separate

---

## Pending Production Manual Confirmation
- [ ] Correct actor attribution display in `/admin/audit` log for newly triggered owner/admin payment events.
- [ ] Non-Super-Admin direct route rejection verification on deployed environment.

---

## Current Step 5 Status
**READY FOR FINAL MANUAL QA**

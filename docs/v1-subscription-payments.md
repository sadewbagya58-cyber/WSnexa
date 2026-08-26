# WSNexa V1 Subscription Payments — Architecture & Pricing Documentation

## Overview
WSNexa V1 Subscription Payments establishes a dedicated, production-safe commercial SaaS payment domain, canonical server-side pricing engine, checkout review flow, provider-neutral payment gateway architecture, owner billing history, and Super Admin payment management for WSNexa venue subscription billing (Business Owner $\rightarrow$ WSNexa merchant account).

---

## 1. Domain Separation

A strict boundary is enforced between WSNexa SaaS subscription billing and venue customer order processing:

- **SaaS Subscription Billing Domain (`public.business_subscription_payments`)**:
  - Payer: Business Owner / Venue Operator
  - Payee: WSNexa Platform Merchant Account
  - Purpose: SaaS tier subscription payments, plan upgrades, and renewals.
- **Customer Order Payment Domain (`public.payments`, `branch_payment_settings`)**:
  - Payer: Restaurant / Hotel Guest
  - Payee: Individual Venue Merchant Account
  - Purpose: Food, beverage, room service, and hospitality bill settlements.

These two payment domains operate independently and never share tables or schemas.

---

## 2. Canonical Pricing Model (LKR Billing)

All WSNexa SaaS subscription prices are calculated in **LKR** (Lankan Rupee). Subscription billing currency is independent of the venue's operational or menu currency.

### Plan Prices
- **Starter**: LKR 4,499 / month (Includes 1 branch, 10 active staff, 50 tables, 250 menu items, 3 custom roles)
- **Growth**: LKR 8,999 / month (Includes 3 branches, 40 active staff, 200 tables, 1,000 menu items, 15 custom roles)
- **Enterprise**: Base LKR 24,999 / month (Includes 5 branches, 75 active staff, unlimited tables/menu items/roles)

---

## 3. Enterprise Pricing Formula & Configurator

Enterprise scale pricing is dynamically calculated on top of the base plan:

- **Base Enterprise Price**: LKR 24,999 / month (includes 5 branches / 75 staff)
- **Extra Branch Charge**: + LKR 3,000 / month per branch above 5.
- **Extra Staff Charge**: + LKR 2,000 / month per ceiling block of 25 staff above 75.

### Staff Ceiling Block Calculation
Extra staff blocks are calculated using ceiling logic (`Math.ceil((staff - 75) / 25)`):

$$\text{Extra Staff Blocks} = \left\lceil \frac{\max(0, \text{Staff} - 75)}{25} \right\rceil$$

| Requested Branches | Requested Staff | Extra Branches | Extra Staff Blocks | Calculation | Total Monthly Price (LKR) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | 75 | 0 | 0 | Base Enterprise | LKR 24,999 |
| 10 | 200 | 5 | 5 | 24,999 + (5 * 3,000) + (5 * 2,000) | LKR 49,999 |
| 10 | 201 | 5 | 6 | 24,999 + (5 * 3,000) + (6 * 2,000) | LKR 51,999 |

---

## 4. Checkout Intent & Idempotency (`subscription-checkout.ts`)

- **Server-Authoritative Pricing**: Quotes are recalculated server-side; client payload estimates are never trusted.
- **Downgrade Protection**: Checkout blocks downgrades if current active branches, staff, tables, or menu items exceed destination plan ceilings (`validateDowngradeEligibility`).
- **Idempotency Keying**: Payment intent creation uses stable idempotency keys (`sub_intent_${businessId}_${planCode}_${attemptId}`) preventing duplicate intent rows on network retry.

---

## 5. Provider-Neutral Architecture & Verification Boundaries

### Provider Registry & Availability Model
- Candidate providers: **OnePay**, **Dialog**, **PayHere**.
- Centralized configuration (`SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG`) controls provider enablement.
- **Current Production Status**: All providers default to `enabled: false`. Unknown, disabled, or unconfigured providers are rejected cleanly by `getSubscriptionPaymentProvider(code)`.

### Payment State Machine (`payment-state-machine.ts`)
Strict legal payment transitions:
- `pending` $\rightarrow$ `processing`, `paid`, `failed`, `cancelled`, `expired`
- `processing` $\rightarrow$ `paid`, `failed`, `cancelled`
- `paid` $\rightarrow$ `refunded`
- Illegal transitions (e.g. `paid` $\rightarrow$ `pending`, `failed` $\rightarrow$ `paid`) throw `PaymentProviderError('INVALID_PAYMENT_TRANSITION')`.

### Verified Payment Settlement Boundary (`SubscriptionPaymentSettlementService`)
- Server-side settlement boundary executing upon verified return/webhook:
  1. Locates payment intent record.
  2. Idempotency Check: If already `paid`, returns existing settlement result without duplicate execution.
  3. Exact Amount & Currency Match: Verified `amountLkr` MUST equal `paymentIntent.amount_lkr`, `currency` MUST equal `'LKR'`. Mismatches reject settlement.
  4. Provider Transaction Uniqueness: Ensures no single provider transaction ID can settle multiple payment intents (`idx_sub_payments_provider_tx_unique`).
  5. Platform Suspension Precedence: Platform workspace suspension (`businesses.status === 'suspended'`) strictly blocks commercial payment settlement (`PLATFORM_SUSPENDED_SETTLEMENT_BLOCKED`).
  6. Subscription Core Activation: Invokes `SubscriptionService.activateSubscriptionFromVerifiedPayment` to update lifecycle status, audit logs, and owner notifications.

---

## 6. Owner Billing & Payment History

- Route: `/dashboard/settings/subscription`
- **Tenant Isolation**: Owners inspect payment records for their own business only. Non-owner staff are denied access.
- **Visual Status Badges**: High-contrast badges for `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`, and `REFUNDED`.
- **Payment Detail Modal**: Displays intent reference, plan, purpose, billing interval, provider metadata, full timestamps, and Enterprise scale snapshot.
- **Safe Owner Actions**: Owners can cancel their own pending payment intents (`cancelOwnerPendingPaymentIntentAction`). Requires no administrative reason.

---

## 7. Super Admin Subscription Payment Management

- Route: `/admin/subscription-payments` (inherits Platform Admin shell `AdminLayout`)
- **Platform-Wide Table & Search**: Paginated list with filters (`Status`, `Provider`, `Purpose`, `Plan`) and safe text search by 8-char short ref (via generated `id_text`), full UUID, transaction ID, or provider reference.
- **Business Level Link**: Integrated into `/admin/businesses/[id]` for direct venue payment history inspection.
- **Safe Administrative Actions**:
  - `Cancel Pending Intent` (`payment.cancelled_by_admin` audit entry)
  - `Expire Pending Intent` (`payment.expired_by_admin` audit entry)
  - Requires mandatory administrative reason string.
- **Manual Activation Separation**: Super Admin manual subscription activation operates on subscription lifecycle and does NOT fabricate fake `paid` payment rows.

---

## 8. Gateway Integration Handoff Procedure

When merchant approval and API credentials for a real provider (OnePay, Dialog, or PayHere) are received:

1. **Implement Provider Adapter**:
   - Implement `SubscriptionPaymentProvider` interface in `src/server/payments/subscriptions/providers/[provider].provider.ts`.
   - Implement `initiatePayment()`, `verifyPaymentReturn()`, `verifyWebhook()`, `parseWebhookPayload()`, and `cancelPayment()`.
2. **Configure Provider Registry**:
   - Update `SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG` in `src/server/payments/subscriptions/provider-registry.ts`:
     Set `enabled: true` and map environment variables for merchant keys/secrets.
3. **Environment Credentials**:
   - Add server-only environment variables (e.g. `ONEPAY_MERCHANT_ID`, `ONEPAY_SECRET_KEY`) to production environment. NEVER expose keys under `NEXT_PUBLIC_*`.
4. **Handoff Contract**:
   - Do NOT modify `SubscriptionPricingService`, `business_subscription_payments` schema, or `SubscriptionPaymentSettlementService`. Provider adapter will invoke `SubscriptionPaymentSettlementService.settleVerifiedPayment` upon cryptographically verified webhook delivery.

---

## 9. Audit Actor Attribution & Phase 36 Closure State

- **Actor Attribution**: Payment audit events explicitly record authenticated user IDs:
  - `payment.cancelled_by_owner` $\rightarrow$ `actor_id = authContext.userId`
  - `payment.cancelled_by_admin` $\rightarrow$ `actor_id = adminContext.user.id`
  - `payment.expired_by_admin` $\rightarrow$ `actor_id = adminContext.user.id`
- **Current Disabled Provider Status**:
  - `onepay`: `enabled = false`
  - `dialog`: `enabled = false`
  - `payhere`: `enabled = false`

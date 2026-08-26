# WSNexa V1 Subscription Payments — Architecture & Pricing Documentation

## Overview
WSNexa V1 Subscription Payments establishes a dedicated, production-safe commercial SaaS payment domain, canonical server-side pricing engine, checkout review flow, and provider-neutral payment gateway architecture for WSNexa venue subscription billing (Business Owner $\rightarrow$ WSNexa merchant account).

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
| **5** | **75** | 0 | 0 | Base 24,999 + 0 + 0 | **LKR 24,999** |
| **6** | **75** | 1 | 0 | Base 24,999 + (1 × 3,000) + 0 | **LKR 27,999** |
| **10** | **75** | 5 | 0 | Base 24,999 + (5 × 3,000) + 0 | **LKR 39,999** |
| **5** | **76** | 0 | 1 | Base 24,999 + 0 + (1 × 2,000) | **LKR 26,999** |
| **5** | **100** | 0 | 1 | Base 24,999 + 0 + (1 × 2,000) | **LKR 26,999** |
| **5** | **101** | 0 | 2 | Base 24,999 + 0 + (2 × 2,000) | **LKR 28,999** |
| **10** | **200** | 5 | 5 | Base 24,999 + (5 × 3,000) + (5 × 2,000) | **LKR 49,999** |
| **10** | **201** | 5 | 6 | Base 24,999 + (5 × 3,000) + (6 × 2,000) | **LKR 51,999** |

---

## 4. Server-Authoritative Pricing & Security

- **Server-Authoritative**: The client browser is **never** permitted to specify or override the payment amount. When checkout requests or payment intents are initiated (`createSubscriptionPaymentIntentAction`), the server recalculates the total from canonical plan configurations.
- **Integer LKR Currency Math**: All monetary values are represented as integer LKR amounts to eliminate floating-point precision errors.

---

## 5. Provider-Neutral Gateway Architecture (Phase 36 Step 3)

WSNexa utilizes a provider-neutral gateway architecture separating core subscription billing logic from external gateway adapters.

### Provider Contract (`SubscriptionPaymentProvider`)
All payment provider adapters must implement the canonical interface [`src/server/payments/subscriptions/subscription-payment-provider.ts`](file:///c:/Users/x/.antigravity/wsnexa/src/server/payments/subscriptions/subscription-payment-provider.ts):
- `createCheckout(input: CreateCheckoutInput)`: Returns normalized `CreateCheckoutResult` (`provider`, `checkoutId`, `redirectUrl`).
- `verifyReturn(input)`: Verifies browser callback parameters.
- `verifyWebhook(payload, headers)`: Verifies webhook payload and cryptographic signature.
- `getPaymentStatus?(providerTransactionId)`: Directly queries provider transaction status.

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

### Callback & Webhook Routes
- Return Route: `/api/subscription-payments/[provider]/return` (Browser redirect query params are NEVER trusted without server-side verification).
- Webhook Route: `/api/subscription-payments/[provider]/webhook` (Raw body preservation, cryptographic signature verification, duplicate webhook delivery safety).

---

## 6. Future Provider Integration Workflow

Connecting a new gateway (e.g. OnePay, Dialog, PayHere) requires only:
1. Creating a provider adapter class implementing `SubscriptionPaymentProvider`.
2. Registering the adapter via `registerSubscriptionPaymentProvider(adapter)`.
3. Setting `SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG[providerCode] = { enabled: true, environment, hasCredentials: true }`.
4. Adding server-side environment credentials (never exposed via `NEXT_PUBLIC_*` or database text).

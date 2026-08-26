# WSNexa V1 Subscription Payments — Architecture & Pricing Documentation

## Overview
WSNexa V1 Subscription Payments establishes a dedicated, production-safe commercial SaaS payment domain and canonical server-side pricing engine for WSNexa venue subscription billing (Business Owner $\rightarrow$ WSNexa merchant account).

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

## 3. Enterprise Pricing Formula & Ceiling Block Logic

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

---

## 4. Server-Authoritative Pricing & Security

- **Server-Authoritative**: The client browser is **never** permitted to specify or override the payment amount. When checkout requests are initiated, the server recalculates the total from canonical plan configurations.
- **Integer LKR Currency Math**: All monetary values are represented as integer LKR amounts to eliminate floating-point precision errors.

---

## 5. Pricing Snapshot JSONB

Every payment record preserves an immutable `pricing_snapshot` JSONB object capturing the exact pricing calculation result at payment creation time (`pricingEngineVersion: "v1"`).

---

## 6. Payment Status Lifecycle

SaaS subscription payment records transition through seven canonical statuses:
1. `pending`: Checkout session initialized.
2. `processing`: Payment submission undergoing gateway processing.
3. `paid`: Payment verified and completed.
4. `failed`: Payment attempt rejected or failed.
5. `cancelled`: Payment checkout session cancelled by user.
6. `expired`: Payment checkout session expired before completion.
7. `refunded`: Payment refunded post-completion.

---

## 7. Idempotency & Retries

- `idempotency_key`: `VARCHAR(255) UNIQUE NOT NULL` on `public.business_subscription_payments`.
- Prevents duplicate payment creation on network retries or concurrent checkout requests.

---

## 8. Manual Activation Separation

Super Admin manual subscription activations (`manualActivateSubscription`) do **NOT** create payment gateway records. Manual activations are logged in `business_subscription_events` and platform `audit_logs` only. `business_subscription_payments` is reserved for commercial gateway payment attempts.

---

## 9. Dialog Gateway Integration Boundary

Phase 36 Step 1 establishes database schemas, types, and server-side pricing calculation. Direct Dialog payment gateway SDKs, merchant IDs, hash generation, webhooks, and checkout URLs are deferred to subsequent Phase 36 steps.

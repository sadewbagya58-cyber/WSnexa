# WSNexa — Phase 33 Step 1 Architecture & Documentation
## Guest Data Foundation & Unified Customer Profile

---

### 1. Objective
Establish a trustworthy, privacy-safe, tenant-isolated guest and customer identity foundation for WSNexa. This step provides unified profile resolution across registered accounts, known guests, and anonymous QR/walk-in orders, aggregating activity, spend, loyalty, reviews, and auditable marketing consents without exposing sensitive PII to unauthorized users or leaking data across property boundaries.

---

### 2. Customer Data Inventory & Schema Audit

| Entity / Source | Primary Key | Identity Source | Tenant Scope | Duplicate & Snapshot Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **`auth.users`** | `id` | Supabase Auth User ID | Global / Auth | Primary user authentication identity. Holds verified email & phone. |
| **`user_profiles`** | `id` (FK `auth.users`) | Platform User Profile | Global / Auth | Holds `first_name`, `last_name`, `phone`, `account_status`, `onboarding_intent`. |
| **`customer_profiles`** | `user_id` (FK `auth.users`) | Customer Portal Profile | Global / Auth | Holds `display_name`, `avatar_url`, `phone`. |
| **`orders`** | `id` | Order Record | Business / Branch | Holds `customer_user_id` (nullable), `guest_name`, `guest_phone`, `guest_email`, `crm_customer_id` (nullable). `guest_name` and `guest_phone` act as order-time historical snapshots. |
| **`customer_loyalty_accounts`** | `id` | Loyalty Ledger | Business / Auth User | Holds `points_balance`, `lifetime_points_earned`, `lifetime_points_redeemed`, `current_tier_id`. Keyed by `customer_user_id` + `business_id`. |
| **`venue_reviews`** | `id` | Customer Review | Business / Auth User | Holds `user_id`, `order_id`, `rating`, `review_text`, `owner_response`. |
| **`crm_customers`** | `id` | Unified CRM Entity | Business / Org | Canonical business-level customer entity linking `auth_user_id`, `email_normalized`, `phone_normalized`, and `identity_type`. |
| **`crm_customer_identities`** | `id` | Identity Audit Log | Business / Org | Audit trail mapping `AUTH_USER`, `EMAIL`, and `PHONE` identifiers to `crm_customers`. |
| **`crm_consent_records`** | `id` | Marketing Consent State | Business / Org | Stores explicit consent state (`GRANTED`, `DENIED`, `OPTED_OUT`, `UNKNOWN`) per channel. |
| **`crm_consent_events`** | `id` | Consent Audit Event | Business / Org | Immutable audit log recording every consent change, action source, and timestamp. |

---

### 3. Identity Levels & Resolution Rules

#### Identity Levels
1. **`REGISTERED`**: Verified customer account linked to `auth.users.id`.
2. **`KNOWN_GUEST`**: Non-registered customer with a stable contact identifier (`email_normalized` or `phone_normalized`).
3. **`ANONYMOUS`**: Walk-in or table order with no stable contact info provided. Anonymous orders remain un-merged (`orders.crm_customer_id = NULL`).

#### Deterministic Resolution Priority
1. **Priority 1**: Exact match on `auth_user_id`.
2. **Priority 2**: Exact match on `email_normalized` (`business_id` + `email_normalized`), excluding conflicting registered auth users.
3. **Priority 3**: Exact match on `phone_normalized` (`business_id` + `phone_normalized`), excluding conflicting registered auth users.
4. **Priority 4**: Create a new `REGISTERED` or `KNOWN_GUEST` `crm_customers` record.
5. **Priority 5**: Fully anonymous orders return `null`, keeping `orders.crm_customer_id = NULL` without generating persistent database bloat.

> [!IMPORTANT]
> Zero fuzzy matching or name-only merges are permitted. Customer records are never merged automatically based on matching display names.

---

### 4. Shared-Contact & Registered Account Identity Conflict Invariant

- **Locked Identity Invariant**: A normalized EMAIL or PHONE is a unique CRM identity claim within one business. Shared contact information may be supplied by another registered account, but it must not cause automatic merging or allow that second customer to claim an already-owned CRM identity.
- **Registered User Conflict Protection**: Two different registered auth users (`User A` with `auth_user_id = A`, `phone = X` and `User B` with `auth_user_id = B`, `phone = X`) must **NEVER** be silently merged simply because they present identical contact data.
- **Conflict Handling**:
  - `User A` and `User B` get separate `crm_customers` rows because `auth_user_id` is authoritative.
  - Conflicting phone/email (`X`) is NOT inserted into `User B`'s canonical identity ledger (`crm_customer_identities`), nor does it overwrite `User A`'s ownership.
  - Conflicting convenience field on `User B` (`phone_normalized`) remains `NULL`.
  - Resolution returns status `'IDENTITY_CONFLICT'` internally.
  - Order creation succeeds authoritatively for `User B`.
  - No PII leak across accounts occurs.

---

### 5. Canonical Identity Source & Atomicity Model

- **Canonical Identity Ledger**: `crm_customer_identities` is the canonical append-only audit ledger recording every verified `AUTH_USER`, `EMAIL`, and `PHONE` identifier mapped to a customer entity.
- **Convenience Denormalization**: `crm_customers.email_normalized` and `phone_normalized` are denormalized lookup fields on the primary customer entity used for fast index-based queries.
- **True Database Atomicity**: Resolution and creation are executed in PostgreSQL via a server-only RPC `public.resolve_or_create_crm_customer_identity`.
- **RPC Privileges**:
  - `SECURITY DEFINER`
  - `SET search_path = public, pg_temp`
  - `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`
  - `GRANT EXECUTE TO service_role ONLY`
- **Concurrency Protection**: Simultaneous requests (concurrent `Promise.all` calls using identical `auth_user_id`, `email`, or `phone`) are handled atomically in PL/pgSQL using row locks and `ON CONFLICT` clauses. Zero duplicate canonical customer rows or orphan identity records are produced.

---

### 6. Fully Anonymous Order Behavior

- **Zero Database Bloat**: Orders placed without an `auth_user_id`, `guest_email`, or `guest_phone` return `null` from identity resolution.
- **Nullable CRM Link**: `orders.crm_customer_id` remains `NULL` for fully anonymous table/QR orders. Persistent `crm_customers` rows are created exclusively for `REGISTERED` accounts and `KNOWN_GUEST` orders with stable contact information.

---

### 7. Built-in Contact Permission Decision

- **Privacy-Minimizing Defaults**:
  - `business_owner`: `customers.view`, `customers.manage`, `customers.contact_view`
  - `branch_manager`: `customers.view` (high-risk `customers.contact_view` is **excluded** from default branch manager preset to enforce least privilege).
- **Capability-Based Policy Engine**: All runtime authorization checks evaluate capabilities via `can({ context: authContext, permission: 'customers.contact_view' })`. Zero role-name hardcoding exists.

---

### 8. Consent & Event Channel Constraints

- **Consent Principle**: Contact availability $\neq$ marketing consent. Having a customer's email or phone from an order does **NOT** grant marketing permission.
- **Default Consent State**: All marketing channels default to `UNKNOWN` / `DENIED` until explicitly granted.
- **Enforced Channel Vocabulary**: Database migration enforces a `CHECK` constraint on `crm_consent_events.channel IN ('TRANSACTIONAL_CONTACT', 'MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_WHATSAPP', 'PROFILE_PERSONALIZATION')`. Invalid channel names are rejected at schema level.

---

### 9. Production Migration Status

- **Migration File**: `supabase/migrations/20260824000000_phase33_crm_guest_foundation.sql`
- **State**: **PRODUCTION APPLIED — CONFIRMED**.
- **Properties**: Fully additive, enables RLS, revokes direct client access (`PUBLIC`, `anon`, `authenticated`), grants `service_role` server-only access, includes nullable `orders.crm_customer_id` FK, `crm_consent_events` channel CHECK constraint, and atomic `resolve_or_create_crm_customer_identity` RPC. Manually executed and validated in production Supabase SQL Editor.

---

### 10. Verification Results

`npm run verify:phase33-guest-foundation` $\rightarrow$ **51 / 51 PASSED**.

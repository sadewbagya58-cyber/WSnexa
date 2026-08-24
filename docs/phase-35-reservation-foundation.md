# WSNexa — Phase 35 Step 1 Reservation Foundation Specification

## 1. Architectural Scope & Core Invariants

Phase 35 Step 1 establishes the production-grade, multi-tenant, multi-property reservation foundation for WSNexa restaurant and dining table reservations.

### Baseline Invariants:
- **Canonical RBAC Scopes**: `ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`. No new custom scope names (such as `REGION`, `RESERVATION_SCOPE`, or `TABLE_SCOPE`) are introduced. Reservations are business/property-scoped resources (`business_id`, `branch_id`).
- **Server-Authoritative RBAC**: All runtime authorization decisions evaluate permissions and property-scope reach through `AuthorizationContext` (`can` and `requireBusinessPermission`). Zero hardcoded built-in role names in runtime logic.
- **Provider-Free & Safety Guarantees**: Zero external notification provider SDKs (Twilio/SendGrid/WhatsApp) and zero external LLM SDKs (OpenAI/Gemini/Claude) added.
- **Strict Exclusions**:
  - NO table auto-allocation or floor plan seating logic (deferred to Step 2).
  - NO waitlist management (deferred to future steps).
  - NO hotel room booking or PMS integrations (dining/restaurant table reservations only).
  - NO payment deposits or dynamic pricing.

---

## 2. Database Schema & Migration Architecture

**Migration File**: `supabase/migrations/20260824200000_phase35_reservation_foundation.sql`

### A. `reservations` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Reservation surrogate key |
| `business_id` | `UUID` | `NOT NULL`, `REFERENCES businesses(id)` | Multi-tenant isolation key |
| `branch_id` | `UUID` | `NOT NULL`, `REFERENCES branches(id)` | Property scope isolation key |
| `crm_customer_id` | `UUID` | `NULL`, `REFERENCES crm_customers(id)` | Linked CRM customer profile |
| `created_by_user_id` | `UUID` | `NULL`, `REFERENCES auth.users(id)` | Staff or customer user creator |
| `created_by_source` | `TEXT` | `NOT NULL` | Creation source (`PUBLIC_WEB`, `STAFF`, etc.) |
| `guest_name` | `TEXT` | `NOT NULL` | Historical guest snapshot name |
| `guest_email` | `TEXT` | `NULL` | Historical guest snapshot email |
| `guest_phone` | `TEXT` | `NULL` | Historical guest snapshot phone |
| `reservation_date` | `DATE` | `NOT NULL` | Branch local date of reservation |
| `reservation_start_at` | `TIMESTAMPTZ` | `NOT NULL` | Absolute start timestamp |
| `reservation_end_at` | `TIMESTAMPTZ` | `NOT NULL`, `CHECK (end > start)` | Absolute end timestamp |
| `party_size` | `INTEGER` | `NOT NULL`, `CHECK (party_size > 0)` | Number of dining guests |
| `status` | `TEXT` | `NOT NULL`, `CHECK (status IN (...))` | Reservation lifecycle status |
| `special_requests` | `TEXT` | `NULL` | Guest operational notes |
| `internal_notes` | `TEXT` | `NULL` | Staff-only private notes |
| `occasion` | `TEXT` | `NULL` | Dining occasion (`Birthday`, etc.) |
| `source` | `TEXT` | `NOT NULL`, `CHECK (source IN (...))` | Booking channel source |
| `confirmation_code` | `TEXT` | `NOT NULL` | Alphanumeric confirmation code |
| `cancelled_at` | `TIMESTAMPTZ` | `NULL` | Cancellation timestamp |
| `cancelled_by_user_id` | `UUID` | `NULL`, `REFERENCES auth.users(id)` | User who cancelled |
| `cancellation_reason` | `TEXT` | `NULL` | Reason for cancellation |
| `arrived_at` | `TIMESTAMPTZ` | `NULL` | Guest arrival timestamp |
| `seated_at` | `TIMESTAMPTZ` | `NULL` | Seating timestamp |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Meal completion timestamp |
| `no_show_at` | `TIMESTAMPTZ` | `NULL` | No-show timestamp |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Record modification timestamp |

### B. `reservation_status_events` Table (Append-Only Audit Log)
Records full status transition history (`from_status` $\rightarrow$ `to_status`), actor ID, actor type (`STAFF`, `CUSTOMER`, `SYSTEM`), and reason.

### C. `reservation_settings` Table (Branch Rules)
Per-branch operational settings: `reservations_enabled`, `default_duration_minutes` (default 90), `minimum_party_size` (1), `maximum_party_size` (20), `minimum_advance_minutes` (30), `maximum_advance_days` (90), `allow_same_day` (true), `require_guest_phone`, `require_guest_email`, `auto_confirm`.

### D. RLS & Database Security
- RLS enabled on `reservations`, `reservation_status_events`, and `reservation_settings`.
- Direct table access (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) **REVOKED** from `PUBLIC`, `anon`, and `authenticated`.
- Privileges **GRANTED** strictly to `service_role`.

---

## 3. Status Lifecycle State Machine

`ReservationLifecycleService` enforces strict legal status transitions:

```
[ PENDING ]  ───►  CONFIRMED  ───►  ARRIVED  ───►  SEATED  ───►  COMPLETED
     │                  │              │
     ├──► CANCELLED     ├──► CANCELLED └──► CANCELLED
     │                  │
     └──► DECLINED      └──► NO_SHOW
```

- **Illegal Transitions Blocked**: Direct leaps such as `COMPLETED` $\rightarrow$ `PENDING`, `CANCELLED` $\rightarrow$ `SEATED`, or `NO_SHOW` $\rightarrow$ `ARRIVED` throw an explicit error.

---

## 4. Permission Catalog & Built-In Role Defaults

### Permission Keys Registered:
- `reservations.view`: View reservation lists, details, and status history.
- `reservations.create`: Create staff or internal reservations.
- `reservations.manage`: Confirm, mark arrived, seat, complete, or update branch reservation settings.
- `reservations.cancel`: Cancel active reservations.

### Built-In Role Presets Mapping:
- **Business Owner**: `reservations.view`, `reservations.create`, `reservations.manage`, `reservations.cancel`
- **Branch Manager**: `reservations.view`, `reservations.create`, `reservations.manage`, `reservations.cancel`
- **Cashier**: `reservations.view`, `reservations.create`
- **Kitchen Staff**: `reservations.view`
- **Waiter**: `reservations.view`, `reservations.create`

---

## 5. Security, Contact Privacy & Guest Identity

- **Public Reservation Creation Security**: Public requests execute via `createPublicReservationAction`. Business tenancy (`business_id`) is resolved on the server from the trusted branch record to prevent client parameter tampering. Status defaults to `PENDING` (or `CONFIRMED` if `auto_confirm` is enabled). Internal notes cannot be submitted by public callers. Returns safe `PublicReservationDTO`.
- **CRM Customer Identity Integration**: Reservations link to `crm_customer_id` using `CustomerIdentityService.resolveOrCreateCustomerIdentity`. Registered account identity conflict protection is strictly preserved (distinct `auth_user_id` accounts are never auto-merged).
- **Guest Snapshot Protection**: `guest_name`, `guest_email`, `guest_phone` supplied at booking time are preserved on the `reservations` table and are not retroactively mutated by later CRM updates.
- **Contact Privacy & Masking**: Reservation email and phone are masked by default (`maskEmail`, `maskPhone`). Unmasked contact details are exposed strictly when the caller possesses `customers.contact_view`.

---

## 6. Verification Suite

**Automated Verifier**: `scripts/verify-phase35-reservation-foundation.ts`
- Verifier coverage: **32 / 32 PASSED**

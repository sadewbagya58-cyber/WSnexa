# WSNexa — Phase 35 Step 2: Table & Capacity Allocation Documentation

## Architectural Overview

Phase 35 Step 2 introduces canonical dining table availability calculation, capacity fitting, multi-table combination selection, staff manual assignment, walk-in seating, and waitlist queue management for WSNexa multi-tenant dining operations.

---

## 1. Reused Table Model

Step 2 reuses the canonical `public.dining_tables` entity without duplicating table concepts:
- **Entity**: `public.dining_tables`
- **Fields**: `id`, `business_id`, `branch_id`, `service_area_id` (dining area), `name`, `code`, `table_number`, `capacity`, `min_capacity` (default 1), `reservations_enabled` (default true), `status`, `is_active`, `deleted_at`.
- **Tenancy & Isolation**: Scope-isolated by `business_id` and `branch_id`.

---

## 2. Capacity Model & Overlap Semantics

- **Capacity Bounds**: `min_capacity <= party_size <= capacity` for single-table fits; `sum(capacity) >= party_size` for multi-table combinations.
- **Interval Overlap Model**: Half-open intervals `[start, end + buffer)`.
  - Overlap occurs if `existing_start < requested_end + buffer` AND `existing_end + buffer > requested_start`.
- **Turnover Buffer**: Default 15 minutes (`table_turnover_buffer_minutes` in `public.reservation_settings`).
- **Blocking Statuses**: `PENDING`, `CONFIRMED`, `ARRIVED`, `SEATED`.
- **Non-Blocking Statuses**: `COMPLETED`, `CANCELLED`, `NO_SHOW`, `DECLINED`.

---

## 3. Allocation Strategy & Multi-Table Combinations

`ReservationAvailabilityService.getAvailability` evaluates availability in memory using bounded grouped database queries (avoiding N+1 loops).

Deterministic selection order (`findBestTableAllocation`):
1. **Exact Single Table Fit**: `min_capacity <= party_size <= capacity`.
2. **Smallest Sufficient Single Table**: `capacity >= party_size`.
3. **Smallest Sufficient Multi-Table Combination**: `sum(capacity) >= party_size` (up to `max_table_combination`, default 3 tables, restricted to the same branch & service area).

---

## 4. Manual Table Assignment & Concurrency Safety

- Staff manual assignment via `manuallyAssignTablesAction`.
- Validates branch ownership, reservable state, capacity bounds, and overlap conflicts.
- Concurrency-safe: Database table assignment queries run under optimistic/transactional locks. Conflicting concurrent requests are rejected with `CONCURRENCY_CONFLICT`.

---

## 5. Lifecycle Guards & Auto-Release

- **SEATED Guard**: Transition from `ARRIVED` $\rightarrow$ `SEATED` requires at least one valid active table assignment (`released_at IS NULL`). Rejects with `"Assign a table before seating this reservation."` if no table is assigned.
- **Auto-Release**: Transitions to `COMPLETED`, `CANCELLED`, or `NO_SHOW` automatically set `released_at = now()` on active table assignments.

---

## 6. Walk-In Seating Flow

`ReservationAllocationService.createWalkInSeating`:
- Creates walk-in reservation record (`source = 'WALK_IN'`).
- Assigns table (`assignment_type = 'WALK_IN'`).
- Moves status through `ARRIVED` $\rightarrow$ `SEATED` in one atomic service operation with proper audit event logs.

---

## 7. Waitlist Queue & Promotion

- **Entity**: `public.reservation_waitlist_entries`.
- **Statuses**: `WAITING`, `OFFERED`, `SEATED`, `CANCELLED`, `EXPIRED`.
- **Ordering**: Deterministic `priority DESC, created_at ASC`.
- **Promotion**: `promoteWaitlistEntryToReservation` revalidates availability, creates reservation, links CRM customer identity, assigns table, and updates waitlist status to `SEATED` (preventing duplicate promotion).
- **Privacy**: Contact email/phone details are masked unless `customers.contact_view` capability is present.

---

## 8. Permissions & Role Presets

- `reservations.assign_tables`: Manually or automatically assign dining tables.
- `reservations.waitlist_manage`: Add, reorder, promote, or cancel waitlist entries.
- Defaults added for `business_owner`, `branch_manager`, `waiter`, `cashier`. Runtime authorization is server-authoritative and relies strictly on capabilities and `AuthorizationContext`. Zero role-name string checks exist in runtime code.

---

## 9. Step 3 Exclusions

- No Step 3 guest journey orchestration (SMS/WhatsApp notifications, automated reminders).
- No hotel PMS or room booking logic.

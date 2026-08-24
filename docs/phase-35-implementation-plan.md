# WSNexa — Phase 35 Master Implementation Plan
## Reservations / Table Booking & Guest Journey

### Roadmap Overview

| Step | Title | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | **Reservation Foundation** | Core Schema, Status Lifecycle, Settings, Guest/CRM Linkage, Permission Catalog | **IN PROGRESS** |
| **Step 2** | **Table Allocation & Seating Engine** | Table Assignment, Area Allocation, Floor Plan Integration, Turn Times | **NOT STARTED** |
| **Step 3** | **Guest Journey & Arrival Experience** | Arrival Queue, Seating Flow, Order/Session Linkage, Real-time Guest Status | **NOT STARTED** |
| **Step 4** | **Reservation Dashboard, Public Booking & Phase 35 Closure** | Management UI, Public Booking Widget, Security Audits, Full System Regressions | **NOT STARTED** |

---

### Step 1 Detailed Architecture & Verification
- **Status**: **IN PROGRESS**
- **Goal**: Establish the production-grade multi-tenant, multi-property reservation foundation for WSNexa dining table reservations.
- **Key Deliverables**:
  1. `supabase/migrations/20260824200000_phase35_reservation_foundation.sql`: Database schema for `reservations`, `reservation_status_events`, `reservation_settings`, indexes, RLS, and role permission default grants.
  2. `src/lib/validation/permission.ts`: Registration of permission keys (`reservations.view`, `reservations.create`, `reservations.manage`, `reservations.cancel`).
  3. `src/lib/reservations/reservation-types.ts`: DTOs, interfaces, and enums (`ReservationStatus`, `ReservationSource`).
  4. `src/lib/validation/reservation.ts`: Zod validation schemas.
  5. `src/server/reservations/`:
     - `reservation-lifecycle.service.ts`: State machine validator (`PENDING` $\rightarrow$ `CONFIRMED`, `CANCELLED`, `DECLINED`; `CONFIRMED` $\rightarrow$ `ARRIVED`, `CANCELLED`, `NO_SHOW`; `ARRIVED` $\rightarrow$ `SEATED`, `CANCELLED`; `SEATED` $\rightarrow$ `COMPLETED`).
     - `reservation-validation.service.ts`: Input, lead-time, duration, and party size validator.
     - `reservation-settings.service.ts`: Per-branch configuration settings reader/upserter.
     - `reservation-query.service.ts`: Paginated list/search service with property reach filtering and contact masking.
     - `reservation.service.ts`: Authoritative CRUD, guest snapshot recording, CRM customer identity linkage (`CustomerIdentityService`), status audit trail creation.
  6. `src/server/actions/reservation.ts`: Server actions for staff & public reservation requests with capability authorization (`resolveAuthorizationContext`, `can`).
  7. `scripts/verify-phase35-reservation-foundation.ts`: Automated verifier suite.
  8. `docs/phase-35-reservation-foundation.md`: Architectural documentation.

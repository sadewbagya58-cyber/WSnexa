# Phase 30 Step 8 — Acting Authority, Secondments & Temporary Access Lifecycle Hardening

## Overview
Phase 30 Step 8 hardens and standardizes the temporary authorization reach mechanisms in WSNexa (acting assignments, secondments, temporary assignments, and multi-assignment reach union), guaranteeing that temporary assignments expand **WHERE** (reach/scope) without ever inventing or mutating **WHAT** (capabilities/roles).

---

## Key Invariants Enforced & Verified

1. **WHERE vs WHAT Separation**:
   - `ROLE / PERMISSION` = WHAT the user may do.
   - `ASSIGNMENT / SCOPE` = WHERE the user may do it.
   - `POSITION / JOB TITLE` = ORGANIZATIONAL IDENTITY.
   - `ACTING / SECONDMENT` = TEMPORARY WHERE expansion.
   - Acting or secondment NEVER grants permissions not present in the user's substantive role/overrides.

2. **Centralized Temporal Validity Engine**:
   - Centralized in `src/server/auth/temporary-assignment.ts` via `isTemporaryAssignmentEffective()`.
   - Strict boundary evaluation: `starts_at <= referenceTime <= ends_at` (inclusive).
   - Only assignments with `status === 'active'` contribute reach.
   - Open-ended assignments (`ends_at === null`) remain active until explicitly transitioned or ended.

3. **Immediate Expiry & Revocation**:
   - When an assignment ends or passes `ends_at`, reach is immediately dropped on the next authorization evaluation with zero caching/zombie permission leakage.

4. **Multi-Assignment Union Semantics**:
   - Primary branch + host secondment branch + primary/acting department + additional assignments form an additive reach union.
   - Expiration or termination of one source of reach does not impact reach granted by another active source.

5. **Explicit DENY Absolute Precedence**:
   - Explicit `deny` override on a user/permission/scope unconditionally beats active acting/secondment reach.

6. **Custom Role Archival Revocation**:
   - Archiving a custom role immediately revokes permissions during active secondment or acting.

7. **Row-Level Security (RLS) Protection**:
   - `staff_assignments`, `organization_assignment_history`, and `organization_assignment_absences` are strictly SELECT-only for authenticated non-privileged clients.
   - Direct INSERT, UPDATE, DELETE by regular clients is DENIED by Supabase RLS.

8. **Auditability & Provenance**:
   - Structured diagnostic trace with `explainTemporaryAuthority(context)` detailing all active acting and secondment sources with validity timestamps.
   - Append-only audit logs captured for `acting_started`, `acting_ended`, `secondment_started`, `secondment_ended`, and `extended`.

---

## Deliverables & Files

- `src/server/auth/temporary-assignment.ts`: Centralized temporal validity checks and provenance tracing.
- `src/server/auth/authorization-context.ts`: Active acting and secondment scope ingestion with strict temporal validity filtering.
- `src/server/auth/policy-engine.ts`: Secondment unit/department matching and manager reach isolation.
- `src/lib/validation/organization.ts`: Added `extendSecondmentSchema` and input types.
- `src/server/services/organization.service.ts`: Implemented `OrganizationService.extendSecondment` with date validation and audit logging.
- `src/server/actions/organization.ts`: `extendSecondmentAction` server action guarded with `people.manage`.
- `supabase/migrations/20260821010000_phase30_step8_org_assignment_rls_hardening.sql`: RLS hardening migration.
- `scripts/verify-rbac-v2-temporary-authority.ts`: Comprehensive 13-section verification test suite (63 assertions).
- `package.json`: Added script `"verify:rbac-v2-temporary-authority"`.

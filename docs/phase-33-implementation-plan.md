# WSNexa — Phase 33 Master Implementation Plan
## Guest CRM, Behavioral Segmentation & Retention System

### Roadmap Overview

| Step | Title | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | **Guest Data Foundation & Unified Customer Profile** | Unified Identity Resolution, Profile Aggregation, Contact Masking, Consent Model | **COMPLETED / CHECKPOINTED** |
| **Step 2** | **Segmentation & Customer Intelligence** | Deterministic Customer Segments, Recency/Frequency/Monetary Rules, Retention Risk | **NOT STARTED** |
| **Step 3** | **CRM Actions, Retention & Guest Engagement** | Targeted Retention Offers, Win-back Promos, Feedback Recovery, Guest Communication | **NOT STARTED** |
| **Step 4** | **CRM Dashboard, Security, Full Regression & Phase 33 Closure** | Guest Directory UI, Customer Profile View, RBAC Audits, System-wide Regressions | **NOT STARTED** |

---

### Step 1 Detailed Architecture & Verification
- **Status**: **COMPLETED / CHECKPOINTED**
- **Production Migration**: `20260824000000_phase33_crm_guest_foundation.sql` $\rightarrow$ **PRODUCTION APPLIED — CONFIRMED**
- **Unified Identity Resolution**: Deterministic algorithm matching `auth_user_id`, `email_normalized`, `phone_normalized` (`CustomerIdentityService`). Zero name-only or fuzzy automatic merges.
- **Identity Conflict & Shared Contact**: Unique contact invariant locked per business. Registered user identity conflict protection prevents silent auto-merging across distinct `auth_user_id` accounts.
- **Atomic PostgreSQL RPC**: Server-only function `resolve_or_create_crm_customer_identity` with `SECURITY DEFINER`, fixed `search_path = public, pg_temp`, execution granted strictly to `service_role`.
- **Profile Aggregation Service**: Batched concurrent profile DTO generator (`CustomerProfileService`) with property reach filtering and canonical sales status formulas.
- **Contact Privacy & Masking**: Masking utilities (`maskEmail`, `maskPhone`) enforcing `customers.contact_view` capability check for unmasked data access.
- **Auditable Consent Engine**: `crm_consent_records` and `crm_consent_events` recording channel preferences with safe defaults (`UNKNOWN` / `DENIED`) and schema-enforced channel `CHECK` constraint.
- **Security & RLS**: Capability authorization (`customers.view`, `customers.manage`, `customers.contact_view`), RLS revocation of direct client table access, and server-only `service_role` privilege execution.
- **Verification Suite**: `verify:phase33-guest-foundation` $\rightarrow$ **51 / 51 PASSED**.

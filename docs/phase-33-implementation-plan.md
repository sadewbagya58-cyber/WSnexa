# WSNexa — Phase 33 Master Implementation Plan
## Guest CRM, Behavioral Segmentation & Retention System

### Roadmap Overview

| Step | Title | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | **Guest Data Foundation & Unified Customer Profile** | Unified Identity Resolution, Profile Aggregation, Contact Masking, Consent Model | **COMPLETED / CHECKPOINTED** |
| **Step 2** | **Segmentation & Customer Intelligence** | Deterministic Customer Segments, Recency/Frequency/Monetary Rules, Retention Risk | **COMPLETED / CHECKPOINTED** |
| **Step 3** | **CRM Actions, Retention & Guest Engagement** | Targeted Retention Offers, Win-back Promos, Feedback Recovery, Guest Communication | **COMPLETED / CHECKPOINTED** |
| **Step 4** | **CRM Dashboard, Security, Full Regression & Phase 33 Closure** | Guest Directory UI, Customer Profile View, RBAC Audits, System-wide Regressions | **COMPLETED / CHECKPOINTED** |

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

---

### Step 2 Detailed Architecture & Verification
- **Status**: **COMPLETED / CHECKPOINTED**
- **Production Migration**: `20260824120000_phase33_crm_segmentation.sql` $\rightarrow$ **PRODUCTION APPLIED — CONFIRMED**
- **Deterministic RFM Engine**: Mathematical 1-5 scoring for Recency, Frequency, and Monetary metrics (`CustomerSegmentationService`). Zero machine learning or external LLM dependencies.
- **Retention Risk Heuristics**: Deterministic risk score (0-100) and risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) calculated from visit interval decay ratio ($r = \text{recency} / \text{avgInterval}$).
- **Sample-Size Safety**: Insufficient history (0 or 1 order) evaluated with safe fallbacks (`retentionRiskScore <= 15`, `riskLevel = LOW` for 0 orders) to prevent misleading risk confidence.
- **Financial Semantics Alignment**: RFM monetary score reuses canonical realized sales rules (completed/served/delivered orders only, canonical business currency, zero cross-currency assumptions).
- **Property Scope Reach Isolation**: Segmentation computations accept optional `branchIds` filter, strictly restricting total orders, spend, RFM score, risk, and segment breakdown to authorized property reach without leaking unauthorized branch activity.
- **Performance & Batching**: `getSegmentBreakdown` uses 2 grouped queries (`crm_customers` + `orders.in(customer_ids)`) with zero per-customer N+1 DB calls.
- **Server-Only RLS Security**: `crm_segments` and `crm_customer_segments` RLS enabled, direct client access REVOKED, execution GRANTED strictly to `service_role`.
- **Verification Suite**: `verify:phase33-segmentation` $\rightarrow$ **33 / 33 PASSED**.

---

### Step 3 Detailed Architecture & Verification
- **Status**: **COMPLETED / CHECKPOINTED**
- **Production Migration**: `20260824180000_phase33_crm_actions_retention.sql` $\rightarrow$ **PRODUCTION APPLIED — CONFIRMED**
- **Action Taxonomy**: Canonical deterministic action types (`FOLLOW_UP`, `RETENTION_REVIEW`, `LOYALTY_REVIEW`, `SERVICE_RECOVERY`, `VIP_RECOGNITION`, `REVIEW_RESPONSE`, `PROFILE_REVIEW`, `MANUAL_OUTREACH`).
- **Status Transitions**: Validated state machine (`OPEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SNOOZED` $\rightarrow$ `COMPLETED` / `DISMISSED`). Bounded snooze date horizon (max 90 days).
- **Consent Safety**: `EngagementEligibilityService` evaluates purpose (`MARKETING` vs `TRANSACTIONAL`) and channel consent (`MARKETING_EMAIL`, `MARKETING_SMS`). `UNKNOWN` or `DENIED` marketing consent strictly blocks marketing eligibility.
- **Contact Privacy**: Contact details masked by default (`maskEmail`, `maskPhone`). Unmasked strictly when `customers.contact_view` permission is present.
- **Customer Notes & Tags**: `CustomerNotesService` (sanitized plain text, max 2000 chars) & `CustomerTagService` (operational tags, protected category sensitive attribute validation).
- **Retention Opportunity Engine**: Deterministic rules (`LAPSED_REGULAR`, `HIGH_RISK_REPEAT_GUEST`, `VIP_REENGAGEMENT`, `SERVICE_RECOVERY`, `LOYALTY_REDEMPTION_OPPORTUNITY`, `VIP_RECOGNITION`) with sample-size guards and cooldown definitions.
- **Concurrency-Safe Deduplication**: Partial unique index `idx_crm_actions_open_dedupe` on active actions (`OPEN`, `IN_PROGRESS`, `SNOOZED`).
- **Server-Only RLS Security**: RLS enabled on `crm_customer_notes`, `crm_tags`, `crm_customer_tags`, `crm_actions`, `crm_action_events`. Direct client access REVOKED, execution GRANTED strictly to `service_role`.
- **Verification Suite**: `verify:phase33-crm-actions` $\rightarrow$ **48 / 48 PASSED**.

---

### Step 4 Detailed Architecture & Verification
- **Status**: **COMPLETED / CHECKPOINTED**
- **Production Migration**: **NONE** *(Pure UI & server service orchestration)*
- **Primary Route & IA**: `/dashboard/customers` registered in navigation under `GROWTH & GUESTS`, gated by `customers.view`.
- **Customer Directory UI**: Server-side paginated, searchable, filterable directory list with masked contact details by default.
- **Customer Profile UI**: `/dashboard/customers/[customerId]` with KPI summary cards, RFM breakdown, order history, loyalty summary, reviews, staff notes, operational tags, and active retention actions.
- **Contact Privacy UX**: Controlled "Reveal full contact" button calling server action requiring `customers.contact_view` permission. Contact search disabled for non-holders of `customers.contact_view` to prevent enumeration side-channels.
- **Staff Notes & Tags**: Notes UI with 2000-char plain text limit, delete confirmation, and sensitive PII warning banner. Operational tags UI with sensitive category validation.
- **Retention Action Queue**: Filterable action list with `Start`, `Snooze` (max 90 days date selector), `Complete`, and `Dismiss` transition controls.
- **Hardened Property-Scope Assignment**: Branch-specific actions validate assignee property reach across primary branch, active staff assignments, active secondments, or active acting assignments. Server-scoped assignee query (`CustomerActionService.getEligibleAssignees`) returns only eligible assignees.
- **Master Closure Verification**: `verify:phase33-closure` $\rightarrow$ **74 / 74 PASSED**.

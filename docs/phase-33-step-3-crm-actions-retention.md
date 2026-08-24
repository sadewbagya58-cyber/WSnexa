# Phase 33 Step 3 — CRM Actions, Retention & Guest Engagement
## Status: COMPLETED / CHECKPOINTED
## Migration Status: 20260824180000_phase33_crm_actions_retention.sql → PRODUCTION APPLIED — CONFIRMED

## Overview
Phase 33 Step 3 introduces controlled, auditable, consent-safe CRM hospitality actions. It converts CRM intelligence (from Phase 33 Step 1 unified profiles & Step 2 segmentation) into actionable, auditable staff work items without automatic external message sending or AI dependencies.

---

## 1. CRM Action Taxonomy & Status Model

### Action Types (`CRMActionType`)
- **`FOLLOW_UP`**: General operational check-in for repeat or at-risk guests.
- **`RETENTION_REVIEW`**: Staff review for lapsed repeat or VIP guests.
- **`LOYALTY_REVIEW`**: Staff review for high points balance or tier milestone opportunities.
- **`SERVICE_RECOVERY`**: Critical response for low rating feedback or service incidents.
- **`VIP_RECOGNITION`**: Hospitality prep and acknowledgment for active top-tier VIPs.
- **`REVIEW_RESPONSE`**: Follow-up protocol for public/private guest feedback.
- **`PROFILE_REVIEW`**: Administrative verification of guest contact/profile details.
- **`MANUAL_OUTREACH`**: Staff-initiated direct outreach for eligible guests.

### Status Transitions (`CRMActionStatus`)
- **Active States**: `OPEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `SNOOZED`
- **Terminal States**: `COMPLETED` | `DISMISSED`
- *Transition Rules*: Terminal states (`COMPLETED`, `DISMISSED`) cannot transition back without explicit reopen handling. Past or multi-decade snooze dates are strictly rejected (bounded to max 90 days).

---

## 2. Priority & Cooldown Model

### Deterministic Priority (`CRMActionPriority`)
- **`CRITICAL`**: Low review rating ($\le 2.0$ stars) / immediate service recovery.
- **`HIGH`**: Lapsed regular guests, high-risk repeat guest visit decay, VIP recency decay.
- **`MEDIUM`**: Loyalty redemption opportunities, VIP recognition prep.
- **`LOW`**: Routine profile cleanup and general administrative tasks.

### Cooldowns & Concurrency-Safe Deduplication
- **Partial Unique Index**: `idx_crm_actions_open_dedupe ON crm_actions (business_id, crm_customer_id, reason_code) WHERE status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED')`.
- Concurrency-safe: Simultaneous evaluations reuse existing active actions rather than duplicating work items.
- Cooldown horizon: 30 days for lapsed follow-ups, 14 days for service recovery incidents.

---

## 3. Engagement Eligibility & Purpose Separation

### Purposes (`EngagementPurpose`)
1. **`MARKETING`**: Requires explicit `GRANTED` opt-in consent (`MARKETING_EMAIL`, `MARKETING_SMS`). `UNKNOWN` or `DENIED` status strictly blocks marketing channels. Contact availability alone NEVER enables marketing.
2. **`TRANSACTIONAL` / `SERVICE_RECOVERY`**: Operational communication allowed if contact details are registered and user has not explicitly opted out.
3. **`LOYALTY` / `MANUAL_GENERAL`**: Operational loyalty and staff check-ins.

### Contact Masking (`customers.contact_view`)
- Action list DTOs default to masked email (`j***e@example.com`) and phone (`+94 ******1234`).
- Full contact details unmasked strictly when the acting staff member holds `customers.contact_view` permission.

---

## 4. Operational Notes & Tags

### Staff Internal Notes (`crm_customer_notes`)
- Restricted to internal staff.
- Plain text only (HTML/script tags stripped). Maximum length: 2000 characters.
- Property-scoped filtering (`branch_id`). Soft-delete support.

### Operational CRM Tags (`crm_tags` & `crm_customer_tags`)
- Manual operational tags (`VIP_MANUAL`, `CORPORATE_GUEST`, `NEEDS_FOLLOW_UP`).
- **Sensitive Attribute Prevention**: Tags referencing religion, ethnicity, health, medical, political, or sexual orientation are strictly rejected by `CustomerTagService`.

---

## 5. Security, Scope & Persistence Architecture

### Database Schema (`20260824180000_phase33_crm_actions_retention.sql`)
- `public.crm_customer_notes`
- `public.crm_tags`
- `public.crm_customer_tags`
- `public.crm_actions`
- `public.crm_action_events`

### Security Baseline
- RLS enabled on all 5 tables. Direct client access (`PUBLIC`, `anon`, `authenticated`) revoked.
- Server-only DB access via `service_role`.
- Server Actions (`src/server/actions/crm.ts`) execute Policy Engine authorization (`resolveAuthorizationContext` + `can({ context, permission })`).
- Permissions used: `customers.view`, `customers.manage`, `customers.contact_view`. Zero built-in role name hardcoding.

---

## 6. Verification Results

- `verify:phase33-crm-actions` $\rightarrow$ **48 / 48 PASSED**
- `verify:phase33-segmentation` $\rightarrow$ **33 / 33 PASSED**
- `verify:phase33-guest-foundation` $\rightarrow$ **51 / 51 PASSED**
- `verify:phase32-closure` $\rightarrow$ **60 / 60 PASSED**
- `verify:phase31-closure` $\rightarrow$ **46 / 46 PASSED**
- `verify:rbac-v2-management-ui` $\rightarrow$ **72 / 72 PASSED**
- `verify:orders` $\rightarrow$ **17 / 17 PASSED**
- `verify:customer-orders` $\rightarrow$ **20 / 20 PASSED**
- TypeScript: `npx tsc --noEmit` $\rightarrow$ **0 ERRORS**
- ESLint: `npm run lint` $\rightarrow$ **0 ERRORS (42 warnings)**
- Production Build: `npm run build` $\rightarrow$ **174 / 174 ROUTES COMPILED SUCCESSFULLY**

---

## 7. Migration Status

- SQL File: `supabase/migrations/20260824180000_phase33_crm_actions_retention.sql`
- Status: **PRODUCTION APPLIED — CONFIRMED**

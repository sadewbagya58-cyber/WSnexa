# WSNexa — Onboarding Security & Threat Model

> **Version:** 1.0.0 (Phase 4)  

---

## 1. Threat Mitigation Matrix

| Threat Vector | Mitigation Strategy |
| :--- | :--- |
| **Double Submission** | RPC checks if `auth.uid()` already holds an active `business_owner` membership and throws error. |
| **Draft Cross-Read** | RLS policy `user_id = auth.uid()` on `onboarding_drafts` prevents User B from viewing User A's draft. |
| **Logo File Exploit** | Storage bucket restricts uploads to MIME types `image/png`, `image/jpeg`, `image/webp` with 2MB size limit. Path bound to `logos/{user_id}/*`. |
| **Atomic Failure / Partial State** | `complete_business_onboarding` RPC runs in an explicit PostgreSQL transaction block. Any failure triggers total rollback. |

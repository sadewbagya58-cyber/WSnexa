# WSNexa — Business Owner Onboarding Architecture

> **Version:** 4.0.0 (Phase 4 Business Owner Onboarding)  
> **Status:** Active Specification  

---

## 1. Onboarding Wizard Workflow & Routes

The onboarding wizard guides new business owners through a 5-step interactive process:

1. **Step 1 — Business Profile (`/onboarding/business`):** Name, Business Type (`restaurant`, `hotel`, `cafe`, `resort`, `villa`, `food_court`, `other`), Description, Country, Currency, Timezone.
2. **Step 2 — Contact & Primary Location (`/onboarding/location`):** Contact Email, Phone, Website, Address, Branch Name, Branch Code.
3. **Step 3 — Operating Hours (`/onboarding/hours`):** 7-Day operating schedule per day (`opensAt`, `closesAt`, `isClosed`).
4. **Step 4 — Branding & Logo (`/onboarding/branding`):** PNG/JPG/WEBP Logo Upload (max 2MB) stored in Supabase Storage bucket `business-assets`.
5. **Step 5 — Review & Confirm (`/onboarding/review`):** Full payload review, step editing, and atomic final submission (`/onboarding/complete`).

---

## 2. Server-Side Draft Persistence

Draft state is stored server-side in `public.onboarding_drafts` mapped to `auth.uid()`.
Progress survives browser refreshes and device changes:

```typescript
export async function saveOnboardingDraftAction(step: string, payload: Record<string, unknown>);
export async function getOnboardingDraftAction();
```

---

## 3. Atomic Onboarding Completion RPC

Final onboarding execution calls PostgreSQL RPC `complete_business_onboarding`:
- Atomically provisions `businesses` row, default branch (`is_default = true`, `code = 'MAIN'`), owner membership (`role = 'business_owner'`, `status = 'active'`), 7 operating hours, audit log entry, and updates `user_profiles.onboarding_status = 'completed'`.
- Deletes the temporary onboarding draft.

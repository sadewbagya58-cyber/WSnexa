# WSNexa — Architecture Overview

> **Version:** 1.0.0 (Phase 1 Foundation)  
> **Target Audience:** Core Engineering Team & Architects  

---

## 1. System Vision

WSNexa is built as an enterprise-grade, multi-tenant Hospitality Operating System. It handles real-time QR ordering, Kitchen Display Systems (KDS), Waiter service calls, Cashier POS settlement, catalog management, and platform administrative control.

---

## 2. Technology Stack & Key Libraries

- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript (Strict Mode Enabled)
- **Styling:** Tailwind CSS (Neutral Monochrome Design Tokens)
- **Backend & Database:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Authentication & SSR SDKs:** `@supabase/supabase-js` and `@supabase/ssr`
- **Validation:** Zod Schema Validation
- **Hosting Target:** Vercel

---

## 3. Supabase Client Responsibilities

WSNexa uses three distinct Supabase clients to satisfy security boundaries:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WSNexa Architecture                            │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
 ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
 │ Browser Client│         │ Server Client │         │ Admin Client  │
 ├───────────────┤         ├───────────────┤         ├───────────────┤
 │ src/lib/      │         │ src/lib/      │         │ src/lib/      │
 │ supabase/     │         │ supabase/     │         │ supabase/     │
 │ client.ts     │         │ server.ts     │         │ admin.ts      │
 ├───────────────┤         ├───────────────┤         ├───────────────┤
 │ @supabase/ssr │         │ @supabase/ssr │         │ @supabase/js  │
 │ Browser RLS   │         │ Server Cookies│         │ Service-Role  │
 └───────────────┘         └───────────────┘         └───────────────┘
                                                       (Server-Only)
```

1. **Browser Client (`src/lib/supabase/client.ts`):**
   - Instantiated via `createBrowserClient` from `@supabase/ssr`.
   - Used inside Client Components (`'use client'`).
   - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Server Client (`src/lib/supabase/server.ts`):**
   - Instantiated via `createServerClient` from `@supabase/ssr` using `next/headers` `cookies()`.
   - Used in Server Components, Route Handlers (`/api`), and Server Actions.
   - Enforces user session context & RLS automatically via session cookie token.

3. **Admin Client (`src/lib/supabase/admin.ts`):**
   - Instantiated via `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`.
   - Protected by `import 'server-only'` to prevent bundling into client JavaScript.
   - Used exclusively for system level operations (e.g. initial tenant bootstrap, webhook event processing).

---

## 4. Multi-Tenant Security & Isolation Model

- **Database-Level Isolation:** Every tenant table contains a `business_id` (and optionally `branch_id`).
- **PostgreSQL Row Level Security (RLS):** All tables have RLS enabled with security-definer helper functions:
  - `auth_has_business_access(business_id)`
  - `auth_has_branch_role(branch_id, allowed_roles[])`
- **Zero Frontend Trust:** Frontend requests never supply raw `business_id` to override context. Business context is strictly derived from the authenticated session's `business_memberships`.
- **Secure QR Tokens:** Public customer requests use cryptographic tokens (`qr_codes.token`) mapping to tables. Raw database IDs are never exposed in public QR URLs.

---

## 5. Order & Payment Lifecycle Decoupling

The order lifecycle and payment status operate as two independent state machines:

```
[Order Workflow]:
Pending → Accepted → Preparing → Ready → Served → Completed
                                                ↗
                         Rejected / Cancelled ──┘

[Payment Workflow]:
Pending → Paid / Failed / Refunded
```

An order can be in `preparing` state while its payment status is `pending` (e.g., Pay at Cashier). Order settlement is completed by cashiers through explicit POS payment confirmation.

# WSNexa — Authentication Architecture

> **Version:** 2.0.0 (Phase 2 Authentication & Profile System)  
> **Status:** Active Specification  

---

## 1. Overview

WSNexa uses **Supabase Auth** integrated with `@supabase/ssr` and the **Next.js App Router**. Session state is maintained via secure, HTTP-only cookie-based tokens refreshed automatically via Next.js Middleware.

---

## 2. Core Authentication Workflows

### 2.1 Registration Flow
```
User (Browser) ──> POST /register (signUpAction)
                        │
                        ▼
            Validate Zod registerSchema
                        │
                        ▼
      Supabase Auth.signUp({ email, password, meta: { first_name, last_name } })
                        │
                        ▼
       PostgreSQL Trigger (on_auth_user_created)
       └─> Automatically inserts row into public.user_profiles
                        │
                        ▼
           Redirect to /verify-email or /dashboard
```

### 2.2 Login & Session Exchange
1. User submits credentials to `signInAction`.
2. Supabase Auth validates password and returns JWT session cookies (`sb-access-token`, `sb-refresh-token`).
3. Next.js Middleware (`src/middleware.ts`) intercepts requests, refreshes expired sessions via `supabase.auth.getUser()`, and enforces route access rules.
4. Authenticated users requesting `/login` or `/register` are redirected to `/dashboard`. Unauthenticated users requesting `/dashboard` are redirected to `/login?redirectTo=/dashboard`.

### 2.3 Password Recovery
1. User requests reset link via `forgotPasswordAction`.
2. Supabase sends recovery email with callback URL `${origin}/auth/callback?next=/reset-password`.
3. Action returns generic success message regardless of email existence to prevent **Account Enumeration**.
4. User clicks link → `/auth/callback` exchanges recovery code for temporary session and redirects safely to `/reset-password`.

---

## 3. Database Schema & RLS Policies

### `public.user_profiles`
- `id` (UUID, Primary Key, Foreign Key -> `auth.users.id` ON DELETE CASCADE)
- `first_name` (TEXT, NOT NULL, 1–100 chars)
- `last_name` (TEXT, NULLABLE, max 100 chars)
- `phone` (TEXT, NULLABLE, max 30 chars)
- `avatar_url` (TEXT, NULLABLE, max 500 chars)
- `preferred_language` (TEXT, NOT NULL, DEFAULT 'en')
- `account_status` (TEXT, NOT NULL, DEFAULT 'active', ENUM: 'active', 'suspended', 'deactivated')
- `onboarding_status` (TEXT, NOT NULL, DEFAULT 'not_started', ENUM: 'not_started', 'in_progress', 'completed')
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### Row Level Security (RLS)
- **Select Policy:** `auth.uid() = id` (Users can only read their own profile).
- **Update Policy:** `auth.uid() = id` (Users can only update their own profile).
- **Field Whitelisting Guard:** `updateProfileAction` restricts updates to `first_name`, `last_name`, `phone`, `avatar_url`, `preferred_language`. Protected fields (`account_status`, `onboarding_status`) cannot be modified through self-service actions.

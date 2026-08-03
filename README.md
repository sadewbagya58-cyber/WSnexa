# WSNexa — Smart Hospitality. Simplified.

WSNexa is an enterprise-grade, cloud-based multi-tenant Hospitality Operating System designed for restaurants, cafes, hotels, resorts, villas, food courts, and food-service businesses.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites

- Node.js 20+ installed
- npm / pnpm / yarn / bun

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd wsnexa
npm install
```

### 2. Environment Variables Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Migration Setup

Apply the Phase 2 & Phase 3 migrations to your Supabase PostgreSQL database:

```bash
# Apply in Supabase SQL Editor:
# 1. supabase/migrations/20260803163000_create_user_profiles.sql
# 2. supabase/migrations/20260803171500_create_multi_tenant_schema.sql
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Essential Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server |
| `npm run lint` | Runs ESLint validation checks |
| `npm run typecheck` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm run verify:auth` | Runs automated authentication & security verification suite |
| `npm run verify:tenant` | Runs automated multi-tenant isolation & security integration suite |
| `npm run build` | Builds production bundle |
| `npm run start` | Runs production server |

---

## 📁 Project Architecture & Folder Structure

```text
src/
  app/                 # Next.js App Router (Pages, Layouts, API Routes)
    (dashboard)/       # Tenant & Admin Dashboard Route Group
      dashboard/
        business/      # Active Business Profile Placeholder
        branches/      # Active Branch Management Placeholder
        team/          # Team & Memberships Placeholder
    api/               # Server-Side API Handlers (logout, webhooks)
    auth/callback/     # Supabase Auth Code Exchange Route Handler
  components/          # Reusable React UI & Layout Components
    ui/                # Base Atomic Components (Button, Badge, Card)
    layout/            # Shared Layout Elements (Header, Footer)
    profile/           # Personal Profile Management Form
    tenant/            # Business Creation Modal
  features/            # Business Domain Feature Modules
  lib/                 # Core Utilities, Supabase Clients, Validation
    supabase/          # Browser, Server, & Admin Supabase Clients
    tenant/            # Slug Generator & Context Utilities
    validation/        # Zod Schemas for Auth, Profile, Tenant & Env Validator
    utils/             # Shared Helper Utilities
  server/              # Server Actions & Server-Only Services
    actions/           # Server Actions (auth, tenant)
    tenant/            # Server Tenant Resolver & Security Guards
  types/               # Global TypeScript Types & Database Interfaces
  styles/              # Global CSS & Tailwind Design Tokens
docs/                  # Architecture, Security & Development Standard Docs
supabase/              # Migrations (user_profiles, multi-tenant DDL & RLS) & Security Tests
```

---

## 🛡️ Key Security & Architecture Policies

1. **Supabase Auth SSR:** Secure cookie-based authentication managed by `@supabase/ssr` and Next.js middleware.
2. **Atomic Business Transaction:** Business creation executes atomically via PostgreSQL RPC `create_business_with_default_branch`.
3. **Multi-Tenant Security:** All tenant data access strictly enforces Row Level Security (RLS) using security helper functions (`auth_has_business_access`, `auth_has_branch_access`, `auth_is_business_owner`).
4. **Server-Only Code Guard:** Admin Supabase client relies on `import 'server-only'` to prevent leaking service keys.

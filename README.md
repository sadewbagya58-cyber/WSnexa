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

Apply migrations to your Supabase PostgreSQL database:

```bash
# Apply in Supabase SQL Editor:
# 1. supabase/migrations/20260803163000_create_user_profiles.sql
# 2. supabase/migrations/20260803171500_create_multi_tenant_schema.sql
# 3. supabase/migrations/20260804070000_create_onboarding_schema.sql
# 4. supabase/migrations/20260804071500_create_menu_schema.sql
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
| `npm run verify:onboarding` | Runs automated business onboarding verification suite |
| `npm run verify:menu` | Runs automated menu catalog management verification suite |
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
        menu/          # Menu Catalog Management (Categories, Items, New Item)
    onboarding/        # 5-Step Business Owner Onboarding Wizard
    api/               # Server-Side API Handlers (logout, webhooks)
    auth/callback/     # Supabase Auth Code Exchange Route Handler
  components/          # Reusable React UI & Layout Components
    ui/                # Base Atomic Components (Button, Badge, Card)
    layout/            # Shared Layout Elements (Header, Footer)
    profile/           # Personal Profile Management Form
    tenant/            # Business Creation Modal
    onboarding/        # Onboarding Wizard Steps & Form Components
    menu/              # Category Manager, Item List, & Item Forms
  features/            # Business Domain Feature Modules
  lib/                 # Core Utilities, Supabase Clients, Validation
    supabase/          # Browser, Server, & Admin Supabase Clients
    tenant/            # Slug Generator & Context Utilities
    validation/        # Zod Schemas for Auth, Profile, Tenant, Onboarding, Menu & Env
    utils/             # Shared Helper Utilities
  server/              # Server Actions & Server-Only Services
    actions/           # Server Actions (auth, tenant, onboarding, menu)
    tenant/            # Server Tenant Resolver & Security Guards
  types/               # Global TypeScript Types & Database Interfaces
  styles/              # Global CSS & Tailwind Design Tokens
docs/                  # Architecture, Security & Development Standard Docs
supabase/              # Migrations (user_profiles, multi-tenant DDL, onboarding, menu schema)
```

---

## 🛡️ Key Security & Architecture Policies

1. **Supabase Auth SSR:** Secure cookie-based authentication managed by `@supabase/ssr` and Next.js middleware.
2. **Integer Price Storage:** Prices stored in smallest currency unit (`price_cents` BIGINT) to prevent floating-point calculation errors.
3. **Database Integrity Triggers:** `trg_check_menu_item_category` trigger guarantees category-branch alignment and prevents adding items to archived categories.
4. **Multi-Tenant Security:** RLS policies restrict menu mutations strictly to `business_owner` or assigned `branch_manager`.

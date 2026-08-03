# WSNexa — Development Standards & Conventions

> **Version:** 1.0.0 (Phase 1 Foundation)  
> **Status:** Active Standard  

---

## 1. General Principles

1. **Strict TypeScript:** No `any` types allowed unless explicitly wrapped and documented. Always specify parameters and return types.
2. **Server-First Mindset:** Keep components as Server Components by default. Add `'use client'` only when interactive state, browser APIs, or React hooks are required.
3. **Zero Security Shortcuts:** Never expose private environment keys (`SUPABASE_SERVICE_ROLE_KEY`) to client components or public bundles. Enforce `import 'server-only'` on admin modules.
4. **Clean Design Tokens:** Use defined Tailwind design system tokens (`bg-background`, `text-foreground`, `bg-primary`, `bg-warning-bg`, `text-destructive`). Avoid ad-hoc inline color codes.

---

## 2. Server vs Client Component Rules

- **Server Components (Default):**
  - Data fetching directly via Server Supabase client (`src/lib/supabase/server.ts`).
  - Rendering static or SEO-sensitive UI.
  - Passing lightweight serializable props to client components.
- **Client Components (`'use client'`):**
  - UI requiring `useState`, `useEffect`, or custom React hooks.
  - Interactive event handlers (`onClick`, `onChange`, form submissions).
  - WebSockets / Supabase Realtime event subscriptions.

---

## 3. Environment & Validation Rules

- All environment variables are validated at app startup via Zod in `src/lib/validation/env.ts`.
- Missing required environment variables throw a descriptive build error before deployment.
- Public variables start with `NEXT_PUBLIC_`. Private server variables must NOT start with `NEXT_PUBLIC_`.

---

## 4. Code Quality & Pre-Commit Verification

Before submitting code or declaring a phase complete, engineers must run:

```bash
# 1. ESLint Check
npm run lint

# 2. TypeScript Typecheck
npm run typecheck

# 3. Production Build Validation
npm run build
```

Every command must return `0` errors.

---

## 5. Security & Multi-Tenancy Rules

- **Never trust client prices:** When an order is placed, the backend API recalculates subtotal, taxes, service charges, and grand total directly from database item records.
- **Isolate tenant data:** Always use Row Level Security policies or explicit tenant filter guards (`WHERE business_id = ...`) derived from session authentication.

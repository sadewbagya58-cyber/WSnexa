# WSNexa — Phase 32 Step 3 Architecture & Operational Insights Report
## Operational Insights & AI-Ready Hospitality Intelligence (Provider-Free Implementation)

---

### 1. Objective & Provider-Free Architectural Decision
Phase 32 Step 3 establishes a deterministic operational insight engine and a provider-free AI context architecture for WSNexa.
- **Provider-Free Decision**: Zero external AI SDK dependencies (`openai`, `@google/generative-ai`, `@anthropic-ai/sdk`) are installed or imported. No external LLM network calls are made.
- **Deterministic Intelligence**: Operational insights (e.g. kitchen prep speed delays, sales decline, stockouts, customer rating changes) are derived 100% deterministically from canonical Step 1 & Step 2 analytics DTOs (`ExecutiveOverviewDTO`).

---

### 2. Architecture & Data Flow

```
Operational Data → Canonical Analytics Engine → ExecutiveOverviewDTO
                                                       ↓
                                             InsightEngine.evaluate()
                                                       ↓
                                            OperationalInsightDTO[]
                                           /                       \
                            ReportsDashboard (UI)            AnalyticsContextBuilder
                            - Key Insights Overview          - Sanitized AIContextSnapshot
                            - Operational Insights Tab               ↓
                                                            HospitalityAIService
                                                            (NullAIProvider Fallback)
```

---

### 3. Key Operational Rules & Thresholds (`src/lib/insights/insight-thresholds.ts`)
- **Sales Rules**:
  - `sales.decline`: Triggered when period sales contract $\ge 10\%$ ($\ge 20\%$ for `CRITICAL`).
  - `sales.growth`: Triggered when period sales grow $\ge 10\%$ (`SUCCESS`).
  - `sales.aov_decline`: Triggered when AOV contracts $\ge 8\%$.
- **Operations Rules**:
  - `ops.prep_time_deterioration`: Triggered when avg kitchen prep time $\ge 20\text{ min}$ (or $\ge 30\text{ min}$ for `CRITICAL`). Enforces minimum sample size of 10 placed orders.
  - `ops.low_completion_rate`: Triggered when completion rate $\le 90\%$ ($\le 80\%$ for `CRITICAL`).
  - `ops.high_pending_queue`: Triggered when pending order backlog $\ge 15$ orders.
- **Menu Rules**:
  - `menu.top_performer`: Highlights leading item volume when sales $\ge 5$ units.
- **Inventory Rules**:
  - `inventory.out_of_stock_critical`: `CRITICAL` alert when $\ge 1$ active item is depleted.
  - `inventory.low_stock_warning`: `WARNING` when $\ge 5$ items cross below minimum reorder thresholds.
  - `inventory.high_waste`: `WARNING` when waste cost is recorded (server-gated by `reports.financial.view`).
- **Reputation Rules**:
  - `reputation.rating_decline`: Triggered when avg rating $\le 4.0\star$ ($\le 3.5\star$ for `CRITICAL`). Enforces minimum sample size of 5 reviews.
  - `reputation.unresponded_reviews`: Triggered when $\ge 5$ customer reviews remain unresponded.
- **Branch Rules**:
  - `branch.performance_variance`: Compares top vs bottom gross sales branches for multi-branch authorized users.

---

### 4. Security, Scoping & Permission Boundaries
- **Financial Redaction**: Users lacking `reports.financial.view` do NOT receive financial insights (gross/net sales, AOV, waste cost, branch revenue).
- **Tenant & Branch Isolation**: Scoped to `authContext.businessId` and authorized branch reach.
- **No Role Hardcoding**: Evaluates Policy Engine capabilities (`reports.view`, `reports.financial.view`).

---

### 5. Persistence & Dismissal UX
- Forward migration `supabase/migrations/20260823193000_phase32_insight_states.sql` creates `public.analytics_insight_states` table with RLS tenant isolation.
- Server actions `dismissInsightAction` and `restoreInsightAction` update dismissal state per fingerprint.

---

### 6. AI-Ready Context & Sanitization (`src/lib/ai/ai-types.ts`, `src/server/ai/analytics-context-builder.ts`)
- `AnalyticsContextBuilder.buildSnapshot()` builds an `AIContextSnapshot` containing sanitized metrics, period bounds, and active insights.
- **Privacy Minimization**: Zero PII (staff/customer emails, phone numbers, raw payment tokens, authentication secrets).
- **Service Skeleton**: `HospitalityAIService` delegates to `NullAIProvider`, returning a controlled exception (`AI_PROVIDER_NOT_CONFIGURED`) without making external API calls.

---

### 7. Verification & Quality Gate Summary

| Suite / Quality Gate | Result |
| :--- | :--- |
| `npm run verify:phase32-operational-insights` | **62 / 62 PASSED** |
| `npm run verify:phase32-executive-analytics` | **51 / 51 PASSED** |
| `npm run verify:phase32-analytics-foundation` | **43 / 43 PASSED** |
| `npm run verify:phase31-closure` | **46 / 46 PASSED** |
| `npx tsc --noEmit` | **PASSED (0 errors)** |
| `npm run lint` | **PASSED (0 errors, 37 warnings)** |
| `npm run build` | **PASSED (174/174 static & dynamic routes compiled)** |

---

### 8. Manual Production Test Plan (Pending Database Migration & Deployment)

- [ ] **TEST A — DATABASE MIGRATION EXECUTION**: Execute `supabase/migrations/20260823193000_phase32_insight_states.sql` and forward security migration `supabase/migrations/20260823213500_fix_insight_states_server_only_rls.sql` in production SQL Editor.
- [ ] **TEST B — OWNER INSIGHTS**: Open `/dashboard/reports` $\rightarrow$ `Operational Insights` tab. Verify rule titles, WHAT HAPPENED & EVIDENCE, RECOMMENDED NEXT CHECK.
- [ ] **TEST C — SALES CHANGE**: Select period with prior period data. Verify sales growth/decline triggers.
- [ ] **TEST D — OPERATIONS**: Test kitchen prep time deterioration ($\ge 20\text{ min}$) & completion rate alerts ($\le 90\%$).
- [ ] **TEST E — FINANCIAL RESTRICTION**: Log in as user without `reports.financial.view`. Verify zero gross sales, AOV, or waste cost insights leak.
- [ ] **TEST F — SINGLE BRANCH**: Select single branch. Verify cross-branch comparison insights are omitted.
- [ ] **TEST G — MULTI-BRANCH**: Select all branches as owner. Verify branch variance insights display top vs bottom locations.
- [ ] **TEST H — DISMISS & RESTORE**: Dismiss an active insight and toggle "Show Dismissed Insights" to restore.
- [ ] **TEST I — MOBILE 390px**: Verify cards, evidence grid, and dismiss buttons stack cleanly.
- [ ] **TEST J — NO AI PROVIDER**: Verify zero network calls to OpenAI/Gemini/Claude; deterministic insights run provider-free.



# WSNexa — Phase 33 Step 2 Architecture & Documentation
## Behavioral Segmentation & Customer Intelligence Engine

---

### 1. Objective
Establish a deterministic, provider-free behavioral segmentation and customer intelligence engine for WSNexa CRM. This step categorizes customers into actionable RFM (Recency, Frequency, Monetary) segments, computes retention risk scores to identify churn risk before guests are lost, and aggregates property-bounded segment distributions for multi-branch operations.

---

### 2. Segment Catalog & Classification Rules (V1 Semantics)

| Segment Code | Segment Name | Color | Classification Criteria | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **`VIP`** | VIP / High Value | `#8B5CF6` | Total Spend $\ge \$300$ (30,000 cents) AND (Frequency Score $\ge 4$ OR Recency Score $\ge 4$) | 1 |
| **`AT_RISK`** | At Risk of Churn | `#F59E0B` | Total Orders $\ge 2$ AND Risk Level is `HIGH` or `CRITICAL` AND Recency $\le 90$ days | 2 |
| **`LAPSED`** | Lapsed / Inactive | `#EF4444` | Days since last completed order $> 90$ | 3 |
| **`REGULAR`** | Regular Guests | `#3B82F6` | Frequency Score $\ge 3$ AND Recency Score $\ge 3$ (and not VIP) | 4 |
| **`NEW_GUEST`** | New Guests | `#10B981` | First order / joined within last 30 days AND Total Orders $\le 2$ | 5 |
| **`ONE_TIME`** | One-Time Visitors | `#6B7280` | Exactly 1 total order placed $> 30$ days ago | 6 |

---

### 3. RFM Scoring Engine (`CustomerSegmentationService`)

#### Recency Score (R)
- **Score 5**: Recency $\le 7$ days
- **Score 4**: Recency $\le 14$ days
- **Score 3**: Recency $\le 30$ days
- **Score 2**: Recency $\le 90$ days
- **Score 1**: Recency $> 90$ days

#### Frequency Score (F)
- **Score 5**: Orders in last 90d $\ge 10$ OR Total Orders $\ge 15$
- **Score 4**: Orders in last 90d $\ge 5$ OR Total Orders $\ge 8$
- **Score 3**: Orders in last 90d $\ge 3$ OR Total Orders $\ge 4$
- **Score 2**: Orders in last 90d $\ge 2$ OR Total Orders $\ge 2$
- **Score 1**: Total Orders $= 1$

#### Monetary Score (M)
- **Score 5**: Total Spend $\ge \$500$ (50,000 cents) OR AOV $\ge \$50$ (5,000 cents)
- **Score 4**: Total Spend $\ge \$250$ (25,000 cents) OR AOV $\ge \$30$ (3,000 cents)
- **Score 3**: Total Spend $\ge \$100$ (10,000 cents) OR AOV $\ge \$20$ (2,000 cents)
- **Score 2**: Total Spend $\ge \$40$ (4,000 cents)
- **Score 1**: Total Spend $< \$40$

---

### 4. Retention Risk Algorithm & Wording Definition

> [!NOTE]
> Retention Risk is a **DETERMINISTIC HEURISTIC INTELLIGENCE** metric. It is **NOT** an AI prediction, machine learning churn model, or statistical probability curve.

$$\text{Average Visit Interval} = \max\left(3, \frac{\text{Date of Last Order} - \text{Date of First Order}}{\text{Total Orders} - 1}\right)$$

$$\text{Decay Ratio} = \frac{\text{Days Since Last Order}}{\text{Average Visit Interval}}$$

- **Risk Levels**:
  - `CRITICAL` (Score 75–99%): Decay Ratio $\ge 3.0$ or Recency $> 90$ days.
  - `HIGH` (Score 55–84%): Decay Ratio $\ge 2.0$.
  - `MEDIUM` (Score 30–54%): Decay Ratio $\ge 1.3$.
  - `LOW` (Score 0–29%): Decay Ratio $< 1.3$.

---

### 5. Sample-Size & Insufficient History Safety

- **0 Completed Orders**: `retentionRiskScore = 0`, `riskLevel = LOW`. Prevents fabricating churn risk when zero order history exists.
- **1 Completed Order Recent ($\le 21$d)**: `retentionRiskScore = 10`, `riskLevel = LOW`.
- **1 Completed Order Inactive ($> 45$d)**: `retentionRiskScore = 65`, `riskLevel = HIGH`, classified as `ONE_TIME` / `LAPSED`.

---

### 6. Realized Sales & Currency Financial Semantics

- **Order Status Rules**: Reuses Phase 32 canonical sales rules (`status IN ('completed', 'served', 'delivered')`). Excludes cancelled, draft, or pending orders.
- **Currency Isolation**: All spend and AOV totals use the business's `default_currency` (e.g. `LKR`). Zero cross-currency summation.

---

### 7. Property Scope Reach Isolation

- **Property Scope Reach**: When a user is authorized for a subset of branches (e.g., `branchIds = ['Branch A']`), `getCustomerSegmentation` and `getSegmentBreakdown` filter `orders` strictly by `branch_id IN (authorizedBranchIds)`.
- **Zero Leakage**: Total orders, total spend, RFM score, primary segment, retention risk, and segment breakdown reflect ONLY activity within authorized reach. No facts about unauthorized branches (e.g. Branch B) leak to restricted users.

---

### 8. Persistence & Stale Membership Model

- **Tables**: `crm_segments` and `crm_customer_segments`.
- **Idempotent Evaluation**: `evaluateAndPersistCustomerSegments` replaces existing segment records for the target customer atomically (`DELETE WHERE customer_id = X` followed by `INSERT`). No duplicate segment rows are produced.

---

### 9. Performance & Query Complexity Architecture

- **Bounded DB Queries**: `getSegmentBreakdown` fetches customer entities and orders in **2 grouped queries** (`crm_customers` + `orders.in(customer_ids)`).
- **Zero N+1 DB Calls**: Never iterates `customers.map(async ...)` to issue per-customer database calls. Server aggregation runs in $O(N)$ memory time.

---

### 10. Database Migration & Server-Only Security

- **Migration File**: `supabase/migrations/20260824120000_phase33_crm_segmentation.sql`
- **State**: **PRODUCTION APPLIED — CONFIRMED** (Manually executed in production Supabase SQL Editor).
- **Security & RLS**:
  - Direct client access (`PUBLIC`, `anon`, `authenticated`) is REVOKED.
  - Access is GRANTED strictly to `service_role`.

---

### 11. Provider-Free Architecture Guarantee

- **Zero LLM / AI Dependency**: Segmentation logic relies 100% on deterministic mathematical rules.
- **SDK Isolation**: Zero external AI SDK packages (`openai`, `@google/generative-ai`, `@anthropic-ai/sdk`) are used or required.

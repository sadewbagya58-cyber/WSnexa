# WSNexa — Phase 33 Step 2 Architecture & Documentation
## Behavioral Segmentation & Customer Intelligence Engine

---

### 1. Objective
Establish a deterministic, provider-free behavioral segmentation and customer intelligence engine for WSNexa CRM. This step categorizes customers into actionable RFM (Recency, Frequency, Monetary) segments, computes retention risk scores to identify churn risk before guests are lost, and aggregates property-bounded segment distributions for multi-branch operations.

---

### 2. Segment Catalog & Classification Rules (Hardened V1 Semantics)

| Segment Code | Segment Name | Color | Classification Criteria | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **`VIP`** | VIP / High Value | `#8B5CF6` | Monetary Score $\ge 4$ AND (Frequency Score $\ge 4$ OR Recency Score $\ge 4$) | 1 |
| **`AT_RISK`** | At Risk of Churn | `#F59E0B` | Total Orders $\ge 2$ AND Risk Level is `HIGH` or `CRITICAL` AND Recency $\le 90$ days | 2 |
| **`LAPSED`** | Lapsed / Inactive | `#EF4444` | Days since last completed order $> 90$ (totalOrders $\ge 1$) | 3 |
| **`REGULAR`** | Regular Guests | `#3B82F6` | Frequency Score $\ge 3$ AND Recency Score $\ge 3$ (and not VIP) | 4 |
| **`NEW_GUEST`** | New Guests | `#10B981` | First order placed within last 30 days AND Total Orders $\le 2$ | 5 |
| **`ONE_TIME`** | One-Time Visitors | `#6B7280` | Exactly 1 total completed order placed 31 to 90 days ago | 6 |

#### Explicit Boundary Rules:
- **`NEW_GUEST`**: `completedOrders <= 2` AND `recency <= 30` days.
- **`ONE_TIME`**: `completedOrders === 1` AND `31 <= recency <= 90` days.
- **`LAPSED`**: `completedOrders >= 1` AND `recency >= 91` days.

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

#### Currency-Independent Monetary Score (M)
Monetary scoring uses **relative population quantile ranking** instead of hardcoded USD thresholds. This operates identically across LKR, AUD, GBP, EUR, USD, and JPY without FX service dependencies:
- **Score 5**: Top 20% ($\ge 80\text{th}$ percentile)
- **Score 4**: $60\text{th}$ to $80\text{th}$ percentile
- **Score 3**: $40\text{th}$ to $60\text{th}$ percentile
- **Score 2**: $20\text{th}$ to $40\text{th}$ percentile
- **Score 1**: Bottom 20% ($< 20\text{th}$ percentile)

#### Small Cohort Fallbacks:
- $N = 0$: `Monetary 1`
- $N = 1$: `Monetary 3` (neutral baseline for single customer)
- $N = 2$: Lower spend = `Monetary 2`, Higher spend = `Monetary 4`
- $N = 3 \text{ or } 4$: Bottom spend = `Monetary 1`, Middle = `Monetary 3`, Top = `Monetary 5`

---

### 4. Retention Risk Algorithm & Exact Non-Overlapping Ranges

> [!NOTE]
> Retention Risk is a **DETERMINISTIC HEURISTIC INTELLIGENCE** metric. It is **NOT** an AI prediction, machine learning churn model, or statistical probability curve.

$$\text{Average Visit Interval} = \max\left(3, \frac{\text{Date of Last Order} - \text{Date of First Order}}{\text{Total Orders} - 1}\right)$$

$$\text{Decay Ratio} = \frac{\text{Days Since Last Order}}{\text{Average Visit Interval}}$$

#### Locked Non-Overlapping Risk Level Ranges:
- **`LOW`** (Score 0–29): Normal visit pattern ($r < 1.3$).
- **`MEDIUM`** (Score 30–54): Moderate visit delay ($1.3 \le r < 2.0$).
- **`HIGH`** (Score 55–74): Significant interval expansion ($2.0 \le r < 3.0$).
- **`CRITICAL`** (Score 75–100): Severe visit decay ($r \ge 3.0$ or Recency $> 90$ days).

#### Boundary Mappings:
- $29 \rightarrow$ `LOW`
- $30 \rightarrow$ `MEDIUM`
- $54 \rightarrow$ `MEDIUM`
- $55 \rightarrow$ `HIGH`
- $74 \rightarrow$ `HIGH`
- $75 \rightarrow$ `CRITICAL`
- $100 \rightarrow$ `CRITICAL`

---

### 5. Sample-Size & Insufficient History Safety

- **0 Completed Orders**: `retentionRiskScore = 0`, `riskLevel = LOW`. Prevents fabricating churn risk when zero order history exists.
- **1 Completed Order Recent ($\le 21$d)**: `retentionRiskScore = 10`, `riskLevel = LOW`.
- **1 Completed Order Medium Inactive ($22–45$d)**: `retentionRiskScore = 40`, `riskLevel = MEDIUM`.
- **1 Completed Order High Inactive ($46–90$d)**: `retentionRiskScore = 65`, `riskLevel = HIGH`, classified as `ONE_TIME`.
- **1 Completed Order Lapsed ($> 90$d)**: `retentionRiskScore = 80`, `riskLevel = CRITICAL`, classified as `LAPSED`.

---

### 6. Realized Sales & Currency Financial Semantics

- **Order Status Rules**: Reuses Phase 32 canonical sales rules (`status IN ('completed', 'served', 'delivered')`). Excludes cancelled, draft, or pending orders.
- **Currency Isolation**: All spend and AOV totals use the business's `default_currency` (e.g. `LKR`). Zero cross-currency summation.

---

### 7. Property Scope Cohort Isolation

- **Property Scope Reach**: When a user is authorized for a subset of branches (e.g., `branchIds = ['Branch A']`), `getCustomerSegmentation` and `getSegmentBreakdown` filter `orders` strictly by `branch_id IN (authorizedBranchIds)`.
- **Cohort Scoring Isolation**: Quantile percentile ranks for Monetary score are calculated strictly against the customer population within the authorized property reach.
- **Zero Leakage**: Total orders, total spend, RFM score, primary segment, retention risk, and segment breakdown reflect ONLY activity within authorized reach. No facts about unauthorized branches (e.g. Branch B) leak to restricted users.

---

### 8. Persisted vs Dynamically Scoped Segment Model

- **Persisted Truth (`crm_customer_segments`)**: Stores business-wide segment records (evaluated across all branches in the business).
- **Dynamically Scoped Reach (`getCustomerSegmentation`)**: For property-restricted requests, the service dynamically computes segmentation bounded strictly by `branchIds` without exposing un-scoped business-wide persisted facts that would leak Branch B activity.

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

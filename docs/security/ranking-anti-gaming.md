# WSNexa Ranking Anti-Gaming Threat Model & Security Controls

## 1. Threat Matrix & Countermeasures

| Threat Vector | Description | Prevention Control |
|---|---|---|
| **Fake Reviews** | Business posts fake 5-star reviews to inflate score | Server enforces `is_verified_visit = true` linking review to completed `order_id`. Unverified reviews count 0. |
| **Review Spam** | Repeated reviews on single order | DB unique constraint `unique (order_id)` rejects duplicate reviews. |
| **Self-Order Inflation** | Business places fake orders to boost popularity | Unique customer counting ($U_{\text{cust}}$) caps per-user volume weight. Cancelled/unsettled orders count 0. |
| **1-Review Outlier** | New venue gets one 5-star review and outranks top venues | Bayesian confidence adjustment ($\frac{C \cdot M + N \cdot R}{C + N}$) anchors score to baseline mean ($M=4.0, C=5$). |
| **Favorite Spam** | Accounts spam favorites | Scoped to authenticated users; unique `(user_id, venue_profile_id)` DB constraint. |
| **Unpublished Gaming** | Draft venue appears in discovery | Ranking queries enforce `is_published = true`. Unpublished venues disappear instantly. |

---

## 2. Verification Test Coverage
Automated test suite `scripts/verify-ranking.ts` validates all 24 security and mathematical constraints.

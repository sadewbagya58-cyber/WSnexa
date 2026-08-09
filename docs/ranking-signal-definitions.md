# WSNexa Ranking Signal Definitions & Mathematical Formulas

## 1. Allowed & Excluded Signals

| Signal | Source Table | Criteria | Allowed in Ranking |
|---|---|---|---|
| Verified Review Rating | `venue_reviews` | `status = 'published' AND is_verified_visit = true` | ✅ YES |
| Unverified Review | `venue_reviews` | `is_verified_visit = false OR status != 'published'` | ❌ NO (0 weight) |
| Completed Orders | `orders` | `status = 'completed'` | ✅ YES |
| Cancelled Orders | `orders` | `status = 'cancelled'` | ❌ NO (0 weight) |
| Customer Favorites | `customer_favorite_venues` | Active saved venue records | ✅ YES |
| Repeat Customers | `orders` | Customers with $\ge 2$ completed orders | ✅ YES |

---

## 2. Mathematical Formulas

### A. Top Rated (Bayesian Confidence Adjustment)
$$\text{Top Rated Score} = \frac{C \cdot M + N \cdot R}{C + N}$$
Where $C = 5$ (prior confidence), $M = 4.0$ (platform prior mean rating), $N$ = count of verified reviews, $R$ = average verified rating.

### B. Trending Now (Recency Decay)
$$\text{Trending Score} = (O_{7} \times 1.0 + O_{8..30} \times 0.4) \times 1.5 + (F_{30} \times 3.0) + (N_{30} \times 2.5)$$
Where $O_7$ = orders in last 7 days, $O_{8..30}$ = orders in days 8 to 30, $F_{30}$ = 30-day favorites, $N_{30}$ = 30-day verified reviews.

### C. Popularity Score
$$\text{Popularity Score} = (O_{\text{comp}} \times 1.0) + (U_{\text{cust}} \times 2.0) + (F \times 3.0) + (N \times 2.5)$$

### D. Repeat Customer Rate (RCR)
$$\text{RCR} = \frac{\text{Count of unique customers with } \ge 2 \text{ completed visits}}{\text{Count of unique completed customers}}$$

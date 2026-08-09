# WSNexa Ranking & Recommendation Architecture

## 1. Overview
WSNexa Phase 18 implements a transparent, explainable, and anti-gaming ranking and recommendation engine. It computes venue scores strictly from verified production data signals (published verified reviews, completed orders, unique repeat customers, and saved favorites).

---

## 2. Core Components

```
+-----------------------------------------------------------------------------------+
|                              Public Discovery / Explore                           |
|  (/explore, /customer dashboard, /venues/[slug], B2B /dashboard/reputation)      |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                               VenueRankingService                                 |
|  - getTopRatedVenues()       (Bayesian confidence weighting)                     |
|  - getTrendingVenues()       (7-day 100% + 30-day 40% recency decay)             |
|  - getPopularVenues()        (Orders + Unique Diners + Favorites volume)          |
|  - getMostLovedVenues()      (Repeat Customer Rate + Favorites intensity)         |
|  - getHiddenGems()           (High rating >=4.2, low volume <=150)                |
|  - getPersonalizedRecommendations() (Category/city preference vector for auth.uid) |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              Verified Data Store                                  |
|  - venue_public_profiles (is_published = true)                                    |
|  - venue_reviews (status = 'published', is_verified_visit = true)                 |
|  - orders (status = 'completed')                                                  |
|  - customer_favorite_venues                                                       |
+-----------------------------------------------------------------------------------+
```

---

## 3. Scaling & Refresh Strategy
- **Query-Time Calculation**: Dynamic ranking engine calculates scores directly from DB state for accuracy during MVP.
- **Materialization Roadmap**: For high-scale multi-region deployment, metrics can be cached in Redis or a `venue_ranking_cache` table refreshed every 15 minutes via Supabase pg_cron.

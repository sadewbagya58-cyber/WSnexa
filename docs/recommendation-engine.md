# WSNexa Recommendation Engine Documentation

## 1. Customer Personalization Architecture
The recommendation engine provides explainable personalized discovery for authenticated customers (`auth.uid()`) based strictly on their own visit history and saved favorites.

## 2. Recommendation Logic
1. **User Visit Profile**:
   - Queries `orders` table for `customer_user_id = auth.uid()` where `status = 'completed'`.
   - Queries `customer_favorite_venues` for saved venue IDs.
2. **Category & Location Preference Vector**:
   - Computes customer's top visited `venue_type` (e.g. `cafe`, `restaurant`, `hotel`).
   - Computes customer's most visited `city`.
3. **Scoring Candidate Venues**:
   - Category Match Boost: $+30$ points.
   - City Match Boost: $+25$ points.
   - Saved Favorite Boost: $+20$ points.
   - Base Bayesian Quality: $+(\text{BayesianRating} \times 5)$.
4. **Human-Readable Explanation**:
   - Each recommended venue includes a clear explanation (e.g. *"Because you often visit cafes"*, *"Popular in Colombo"*, *"Similar to venues you saved"*).

## 3. Privacy & Anti-Profiling Guarantees
- Zero health, political, religious, or sensitive demographic inferences.
- Queries are strictly scoped to `auth.uid()`. Customer A recommendations never expose or inspect Customer B history.

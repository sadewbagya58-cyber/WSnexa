# Verified Review System Specification

## Review Eligibility Rules
To prevent fake reviews, review submission requires:
1. Authenticated customer user.
2. Verified ownership of a claimed order for the venue (`orders.customer_user_id = auth.uid()`).
3. Order status MUST be `completed`.
4. Order has not been previously reviewed.

## Anti-Forgery Mechanism
- `is_verified_visit = true` is derived strictly server-side by checking the database `orders` table.
- Clients CANNOT submit or toggle `is_verified_visit`.
- `business_id` and `venue_profile_id` are derived server-side from the verified order.

## Aggregated Rating Calculation
Rating average and count are computed on demand via indexed DB aggregate queries (`AVG(rating)`, `COUNT(*)` WHERE `status = 'published'`).

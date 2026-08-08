# Venue Discovery Security & Threat Model

## Threat Matrix & Safeguards

| Threat Vector | Mitigation Strategy |
|---|---|
| **Unpublished Profile Leakage** | Database RLS policy `Public select published profiles` restricts `is_published = true` for unauthenticated requests. |
| **Review Forgery / Fake Reviews** | Server-side verification confirms user owns a `completed` claimed order before inserting review. `is_verified_visit` is server-enforced. |
| **Cross-Tenant Data Exposure** | Search & venue profile queries return public safe columns only. Financial data, internal notes, and staff details are excluded. |
| **Cross-Customer Review Overwrite** | RLS policy `Customers update own reviews` ensures `auth.uid() = user_id`. |
| **Unauthorized Manager Response** | `respondToReviewAction` verifies `reviews.respond` permission and business membership. |
| **Table PIN Security Bypass** | Ordering links route to `/m/[token]`, which maintains mandatory PIN and table selection verification. |

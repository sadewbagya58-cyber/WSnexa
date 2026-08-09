# WSNexa Phase 19 — Loyalty System Architecture

## Architectural Principles
1. **Multi-Tenant Isolation**: Every business configures and runs its own isolated loyalty program (`loyalty_program_settings`). Points balances (`customer_loyalty_accounts`) are strictly scoped to `(customer_user_id, business_id)`.
2. **Immutable Transaction Ledger**: All point additions, redemptions, expirations, and manual staff adjustments record an entry in `loyalty_points_ledger`. Mutating balances without a ledger entry is forbidden.
3. **Zero Fake Data**: The system displays clean empty states when no real loyalty data exists.
4. **Idempotent Automatic Earning**: Points are awarded server-side ONLY when an order is `completed` + `paid` and owned by a customer (`customer_user_id`). A partial unique index prevents duplicate earning on the same order.
5. **100% Account-Free Anonymous QR Ordering**: Guest checkout operates without any login requirement. Anonymous orders claimed later by an authenticated customer user automatically calculate and award points retroactively.

# WSNexa Loyalty Security & Anti-Abuse Threat Model

## Addressed Vulnerabilities
1. **Duplicate Point Earning**: Prevented by database unique index `idx_loyalty_ledger_order_earn`.
2. **Double Spending**: Prevented by atomic `.gte('points_balance', pointsRequired)` query filter.
3. **Cross-Tenant Balance Leakage**: Prevented by strict composite unique key `(customer_user_id, business_id)` and RLS policies.
4. **Client-Side Balance Forgery**: Server actions calculate all points earned and deducted server-side; browser payloads are ignored for valuations.
5. **Staff Adjustment Abuse**: Protected by `loyalty.points.adjust` permission, mandatory reason log, and immutable audit logs.

# WSNexa Loyalty Points Ledger & Auditability

## Transaction Types
- `earn`: Points awarded automatically from qualifying completed & paid orders.
- `redeem`: Points deducted for reward redemptions.
- `expire`: Points expired after business-configured expiration period.
- `refund_adjustment`: Points reversed when an order or payment is refunded/voided.
- `manual_adjustment`: Points manually added or deducted by authorized staff (`loyalty.points.adjust`).

## Immutability & Anti-Gaming Constraints
- `idx_loyalty_ledger_order_earn`: Partial unique index on `(order_id)` WHERE `transaction_type = 'earn'` ensures an order can NEVER generate points twice.
- Every manual adjustment requires a non-empty `reason` string and staff `created_by` identity logged to `audit_logs`.

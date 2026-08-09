# WSNexa Loyalty Reward Redemption Workflow

## Redemption Protocol
1. **Server-Side Validation**:
   - Customer must be authenticated (`auth.uid()`).
   - Reward must belong to `business_id` and be `is_active = true`.
   - Customer's current `points_balance` must be $\ge$ `reward.points_required`.
2. **Atomic Spend Execution**:
   - Updates `customer_loyalty_accounts` with `.gte('points_balance', reward.points_required)` guard to prevent double-spending under concurrent requests.
   - Inserts negative transaction record into `loyalty_points_ledger`.
   - Records redemption in `loyalty_reward_redemptions`.

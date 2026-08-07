# WSNexa Analytics Metric Definitions

## 1. Core Financial Metrics

- **Gross Sales**:
  `SUM(orders.total_cents)` for non-cancelled orders created within date bounds.
- **Net Paid Revenue**:
  `SUM(payments.amount_cents)` for completed payment records within date bounds minus valid refunds. Unpaid orders do NOT count as paid revenue.
- **Outstanding Balance**:
  `GREATEST(0, Gross Sales - Net Paid Revenue)`.
- **Average Order Value (AOV)**:
  `Gross Sales / Completed Order Count`.

## 2. Operational Metrics

- **Average Kitchen Preparation Time**:
  Calculated from `order_status_history` timestamp difference between `preparing` status transition and `ready` status transition.
- **Confirmation Time**:
  Calculated from timestamp difference between `pending` status transition and `confirmed` status transition.
- **Peak Kitchen Hour**:
  Hour slot (0-23) with maximum order volume within date range.

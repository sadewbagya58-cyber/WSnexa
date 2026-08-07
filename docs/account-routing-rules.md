# Account Routing Rules

## Server-Side Resolution Matrix

| User State | Verified Membership | Target Route |
| :--- | :--- | :--- |
| Business Owner | `business_owner` (active) | `/dashboard` |
| Branch Manager | `branch_manager` (active) | `/dashboard` |
| Cashier | `cashier` (active) | `/dashboard/cashier` |
| Kitchen Staff | `kitchen_staff` (active) | `/dashboard/kitchen` |
| Waiter | `waiter` (active) | `/dashboard/waiter` |
| Unverified Manager Intent | `NULL` | `/account/pending-access` |
| Unverified Staff Intent | `NULL` | `/account/pending-access` |
| Customer Account | `NULL` | `/customer` |
| Unverified Owner Intent | `NULL` | `/onboarding` |
| Unclassified Account | `NULL` | `/onboarding/account-type` |

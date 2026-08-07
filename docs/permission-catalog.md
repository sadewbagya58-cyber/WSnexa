# WSNexa Machine-Readable Permission Catalog

| Permission Key | Display Name | Category | Risk Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| `orders.view` | View Orders | Orders | Low | View active and historical guest orders |
| `orders.update_status` | Update Order Status | Orders | Medium | Update order progress |
| `orders.cancel` | Cancel Orders | Orders | High | Cancel active orders |
| `kitchen.access` | Access Kitchen Display | Kitchen | Low | Access kitchen display queue |
| `kitchen.update` | Update Kitchen Ticket | Kitchen | Medium | Mark items preparing/ready |
| `cashier.access` | Access Cashier POS | Cashier & Payments | Medium | Access billing terminal |
| `payments.record` | Record Payments | Cashier & Payments | High | Confirm payments and mark paid |
| `payments.view` | View Payment Logs | Cashier & Payments | Medium | View payment history |
| `receipts.print` | Print Receipts | Cashier & Payments | Low | Generate guest receipts |
| `waiter.requests.view` | View Waiter Requests | Waiter | Low | View guest table calls |
| `waiter.requests.manage` | Manage Waiter Requests | Waiter | Low | Acknowledge waiter requests |
| `menu.view` | View Menu Catalog | Menu & Modifiers | Low | View menu items and categories |
| `menu.manage` | Manage Menu Catalog | Menu & Modifiers | Medium | Add/edit menu items and categories |
| `tables.view` | View Dining Tables | Dining & Tables | Low | View tables and service areas |
| `tables.manage` | Manage Dining Tables | Dining & Tables | Medium | Add/edit dining tables and areas |
| `qr.manage` | Manage QR Codes | Dining & Tables | Medium | Generate table QR codes |
| `staff.view` | View Staff Members | Staff & Team | Low | View staff directory |
| `staff.manage` | Manage Staff Members | Staff & Team | High | Assign roles and overrides |
| `invitations.manage` | Manage Staff Invitations | Staff & Team | High | Generate staff invitation codes |
| `reports.view` | View Sales Reports | Reports & Analytics | Medium | View sales analytics |
| `reports.export` | Export Reports | Reports & Analytics | High | Export sales data to CSV/PDF |
| `branches.manage` | Manage Branches | Branches | Critical | Add/edit business branches |
| `business.settings.manage` | Manage Business Settings | Business Settings | Critical | Edit business settings (Owner only) |
| `owner.transfer` | Transfer Ownership | Business Settings | Critical | Transfer business ownership (Owner only) |

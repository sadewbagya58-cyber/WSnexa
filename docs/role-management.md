# WSNexa Role & Permission Management Guide

## 1. Built-in Role Templates
- **Business Owner**: Complete un-deniable control over all business modules, security settings, and branch locations.
- **Branch Manager**: Branch-scoped management template for active branch operations.
- **Cashier**: Billing terminal access, order tracking, payment recording, and receipt printing.
- **Kitchen Staff**: Kitchen display queue and preparation status updates.
- **Waiter**: Guest table service requests and assistance management.

---

## 2. Custom Role Creation
Business Owners can create business-scoped custom roles (e.g. Supervisor, Bar Staff, Floor Manager, Accountant) at `/dashboard/team/roles`.
Custom roles combine built-in role compatibility with custom permission selections configured via an interactive Permission Matrix.

---

## 3. Per-Member Overrides
Owners can configure explicit `allow` or `deny` overrides for individual staff members in `/dashboard/team`.
An explicit `deny` override revokes a specific permission key even if granted by the member's base role.

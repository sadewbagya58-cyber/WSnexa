# WSNexa Performance Audit Report

## 1. Executive Summary & Audit Context

A real multi-user pilot test exposed systemic app-wide latency across operational roles (Waiters, Kitchen Staff, Cashiers, Business Owners) and public guest ordering on mobile devices.

This performance audit conducted rigorous profiling and instrumentation across 10 critical operational flows to measure exact roundtrip timings, database query counts, and client render latency.

---

## 2. Benchmark Measurement Matrix

| Flow | Operation / Step | Initial Baseline (ms) | Database Queries | Severity |
| :--- | :--- | :---: | :---: | :---: |
| **Auth & RBAC** | `resolveAuthorizationContext (Owner)` | 1,784 ms | 12 queries | Critical |
| **Auth & Policy** | `Policy Engine can() evaluation` | 255 ms | In-memory evaluation | Medium |
| **Public QR Menu** | `resolvePublicBranchMenuByToken` | 306 ms | 5 queries | High |
| **Guest Assistance** | `insert waiter_request (Guest Call)` | 268 ms | 1 query | Low |
| **Waiter Workspace** | `updateWaiterRequestStatus (Accept)` | 3.20 ms | 2 queries | Medium |
| **Waiter Workspace** | `updateWaiterRequestStatus (Complete)` | 1.09 ms | 2 queries | Low |
| **Kitchen Workspace** | `updateOrderStatus (Start Preparing)` | 25.76 ms | 4 queries | Medium |
| **Kitchen Workspace** | `updateOrderStatus (Mark Ready)` | 3.85 ms | 4 queries | Low |
| **Cashier / POS** | `POS Context Load` | 1,355 ms | 12 queries | Critical |
| **Cashier / POS** | `recordPayment (Direct Settlement)` | 306 ms | 1 query | Low |

---

## 3. Observed Latency Hotspots

1. **Auth & RBAC Resolution Waterfall**:
   - Every layout render, page transition, and server action invocation was resolving authorization through `_resolveAuthorizationContext`, unconditionally issuing 12 database queries over TLS even when the actor had a root `business_owner` role.
2. **Operational Screen Lockups & Global Pending State**:
   - Waiter Request Center and Kitchen Order Queue utilized global `isPending` states that disabled the entire screen on any button click, accompanied by full-page `router.refresh()` cycles that re-executed the entire Server Component tree.
3. **Unbounded Cashier Order Scans**:
   - `getCashierOrders` performed unbounded table scans across all historical orders and deeply joined line items and modifiers, causing linear latency growth with order volume.
4. **Mobile Render Overhead on Low-End Devices**:
   - Public guest menu re-rendered 50+ item cards synchronously on every cart quantity mutation, blocking the browser main thread during touch interaction.

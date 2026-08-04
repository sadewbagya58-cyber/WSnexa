# WSNexa Dining Table & Service Area Architecture

## Overview

Phase 7 introduces multi-tenant dining table management and floor section organization for WSNexa. Every dining table belongs to exactly one service area, one branch, and one business.

```
Business
 └── Branch
      └── Service Area (e.g. Main Hall, Outdoor, VIP, Bar)
           └── Dining Table (e.g. T1, T2, VIP-1)
```

## Key Capabilities

1. **Service Area Management**: Floor sections categorized by environment (Indoor, Outdoor, VIP, Rooftop, Bar).
2. **Dining Table Management**: Individual table creation with capacities (1-50 guests), shapes, statuses (`available`, `occupied`, `reserved`, `cleaning`, `unavailable`), and codes.
3. **Atomic Bulk Generation**: Generates up to 500 numbered tables atomically in a single PostgreSQL RPC call (`bulk_create_dining_tables`).
4. **Integrity Triggers**:
   - `trg_check_dining_table_area`: Guarantees table business/branch matches service area and blocks adding tables to archived areas.
   - `trg_check_service_area_archival`: Blocks archiving a service area if active dining tables exist inside it.
5. **Row-Level Security (RLS)**: Enforces business owner & branch manager access while locking out unauthorized roles (cashiers, waiters, kitchen staff) from mutating layout configurations.

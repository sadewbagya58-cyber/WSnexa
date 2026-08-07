# Account Onboarding Threat Model

## Threat Matrix & Mitigation

### 1. Client Role Self-Selection Escalation
- **Threat**: Attacker selects "Branch Manager" or "Staff Member" during signup hoping to gain dashboard access.
- **Mitigation**: `AccountService.resolveAccountRoute()` checks `business_memberships` table for an active, server-verified row. Unverified manager/staff accounts are routed to `/account/pending-access` with zero access to `/dashboard`.

### 2. Customer Profile Data Leakage
- **Threat**: User A attempts to view or edit User B's customer profile.
- **Mitigation**: `customer_profiles` table has strict Row Level Security (RLS) policies enforcing `auth.uid() = user_id`. Anonymous reads are rejected.

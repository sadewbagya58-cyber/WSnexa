# WSNexa Staff Invitation Architecture

## 1. System Overview
WSNexa implements a cryptographically secure, server-verified invitation model for Branch Managers and Staff Members (Cashiers, Kitchen Staff, Waiters). 

Selecting a manager or staff intent during account onboarding does NOT grant business access. Privileged role assignment occurs strictly server-side upon successful claim of a cryptographically generated invitation token created by an authorized Business Owner.

---

## 2. Token Security Model
- **Raw Token Structure**: High-entropy 12-byte random code generated via Node `crypto.randomBytes()`. Formatted as `WSN-MGR-XXXX-YYYY-ZZZZ` or `WSN-STF-XXXX-YYYY-ZZZZ`.
- **One-Time Plaintext View**: Raw token is shown ONCE to the creator upon generation.
- **SHA-256 Hashing**: Plaintext tokens are NEVER stored in the database. Only a SHA-256 hash (`crypto.createHash('sha256').update(normalized).digest('hex')`) is stored in `staff_invitations.token_hash`.
- **Safe Display Prefix**: A non-sensitive display prefix (e.g., `WSN-MGR-XXXX...`) is stored for management UI lists.

---

## 3. Database Schema (`public.staff_invitations`)
- `id` (UUID PK)
- `business_id` (UUID FK -> public.businesses)
- `branch_id` (UUID FK -> public.branches)
- `invitation_type` ('manager' | 'staff')
- `assigned_role` ('branch_manager' | 'cashier' | 'kitchen_staff' | 'waiter')
- `invited_email` (TEXT Nullable, case-insensitive binding)
- `token_hash` (TEXT UNIQUE)
- `token_prefix` (TEXT)
- `status` ('pending' | 'claimed' | 'expired' | 'revoked')
- `created_by` (UUID FK -> auth.users)
- `claimed_by` (UUID FK -> auth.users Nullable)
- `expires_at` (TIMESTAMPTZ)
- `claimed_at` (TIMESTAMPTZ Nullable)
- `revoked_at` (TIMESTAMPTZ Nullable)
- `revoked_by` (UUID FK -> auth.users Nullable)
- `last_regenerated_at` (TIMESTAMPTZ Nullable)

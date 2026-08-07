# WSNexa Staff Invitation Threat Model & Security Controls

## 1. Threat Mitigation Matrix

| Threat Scenario | Vector | Mitigation Control | Result |
| :--- | :--- | :--- | :--- |
| **Token Brute-Force** | Random guessing of code string | High-entropy 12-byte random code (`crypto.randomBytes`) with base32 formatting. Space size > $2^{60}$. | **Prevented** |
| **Database Compromise Leak** | Attacker reads `staff_invitations` table | Only SHA-256 token hashes stored (`token_hash`). Plaintext code never saved in DB. | **Prevented** |
| **Double-Claim / Race Condition** | Two users submit same code simultaneously | DB query checks `WHERE status = 'pending'` during atomic update. Second claim fails. | **Prevented** |
| **Privilege Escalation / Self-Assignment** | Client calls API to assign manager role | Membership creation restricted to `service_role` via server-side `StaffInvitationService`. | **Prevented** |
| **Owner Downgrade** | Claiming staff invite on Business Owner account | Service verifies existing role; explicitly rejects staff claims on owner accounts. | **Prevented** |
| **Cross-Tenant Access** | Claiming invite from another business | Invites explicitly bound to `business_id` and `branch_id`. Membership created strictly for bound tenant. | **Prevented** |
| **Email Hijacking** | Unintended account claiming specific invite | Optional `invited_email` binding verifies exact matching email string (case-insensitive). | **Prevented** |
| **Expired / Revoked Reuse** | Attempting claim after expiry or revocation | Service enforces strict `expires_at > NOW()` and `status === 'pending'`. | **Prevented** |

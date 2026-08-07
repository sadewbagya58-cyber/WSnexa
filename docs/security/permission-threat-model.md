# WSNexa Permission Threat Model & Security Controls

## 1. Threat Mitigation Matrix

| Threat Scenario | Risk Level | Mitigation Control | Result |
| :--- | :--- | :--- | :--- |
| **Client Role Payload Tampering** | High | Role edits pass through server-side `PermissionService.updateMemberRole()`. Client payload cannot inject unassigned roles. | **Prevented** |
| **Cross-Branch Privilege Escalation** | Critical | Branch boundary verification (`verifyBranchBoundary`) checks `branch_assignments` per request. Manager Branch A blocked from Branch B. | **Prevented** |
| **Owner Authority Revocation / Lockout** | Critical | Service explicitly rejects `deny` overrides for Business Owners. Business Owner authority is hardcoded as un-deniable. | **Prevented** |
| **Delegated Non-Owner Owner-Only Access** | Critical | Owner-only keys (`business.settings.manage`, `owner.transfer`) are filtered out when non-owners attempt custom role creation or overrides. | **Prevented** |
| **Suspended Account Access** | Medium | `PermissionService.hasPermission()` returns `false` immediately if `membership_status !== 'active'`. | **Prevented** |
| **Stale Authorization Cache** | Medium | Permission evaluation runs per request directly against DB without long-lived client caching. Immediate propagation. | **Prevented** |

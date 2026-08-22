# WSNexa Phase 30 Step 10 — Authorization Management UI, Access Diagnostics & Final Phase Closure

## Overview & Architecture Integration
Phase 30 Step 10 delivers the user-facing management layer and diagnostic tools for the **RBAC & Scope V2 Policy Engine**. It translates the underlying security precedence (`Explicit DENY > Explicit ALLOW > Role / Scope Grants > Default DENY`) into interactive administration dashboards, custom role governance, fine-grained scope grant management, explicit member permission override controls, and real-time Policy Engine access diagnostics.

All UI controls are purely presentation layers. Every authorization decision remains enforced server-side through `resolveAuthorizationContext()` and the `PolicyEngine` evaluate pipeline. Client-side identity or scope assertions are never trusted.

---

## 1. Route Structure & Access Control
Access management routes are secured server-side via `requireRoutePermission()`. Navigating to any route under `/dashboard/access` evaluates the user's active `AuthorizationContext` against the registered route permission:

- **`/dashboard/access`**: Access Control Hub Overview (`roles.view`)
- **`/dashboard/access/roles`**: Built-In Role Templates & Custom Tenant Roles Directory (`roles.view`)
- **`/dashboard/access/roles/[roleId]`**: Custom Role Detail & Capability Inspector (`roles.view`)
- **`/dashboard/access/scope-grants`**: Fine-Grained Scope Grant Manager (`roles.view` for read, `roles.manage` for edit)
- **`/dashboard/access/members`**: Staff Access Profile Directory (`roles.view`)
- **`/dashboard/access/members/[membershipId]`**: Staff Member Capability Profile Inspector (`roles.view`)
- **`/dashboard/access/diagnostics`**: Interactive Policy Engine Access Diagnostics (`roles.view`)

---

## 2. Access Control Hub Overview
The Access Control Hub at `/dashboard/access` serves as the administrative entry point for authorization governance:

- **Security Precedence Summary Banner**: Displays the canonical evaluation order (`DENY > ALLOW > Role`), WHAT vs WHERE separation model, and server-side RLS enforcement notice.
- **Tenant Metrics**: Displays active built-in role template count (5 protected templates), active custom tenant roles count, active scope grant count, and active staff members count.
- **Navigation Cards**: Direct links to Built-in & Custom Roles, Staff Member Access & Overrides, Scoped Permission Grants, and Access Diagnostics with clear visual visual indicators and counts.

---

## 3. Built-In Roles UX
System built-in role templates establish standardized baseline permissions across all business tenants:

- **Canonical Templates**:
  1. `business_owner`: Business Owner (System Protected, full un-deniable reach unless scoped DENY applies)
  2. `branch_manager`: Branch Manager (Default Scope: `PROPERTY`, Max Scope: `ORGANIZATION`)
  3. `cashier`: Cashier (Default Scope: `PROPERTY`, Max Scope: `PROPERTY`)
  4. `kitchen_staff`: Kitchen Staff (Default Scope: `PROPERTY`, Max Scope: `PROPERTY`)
  5. `waiter`: Waiter (Default Scope: `PROPERTY`, Max Scope: `PROPERTY`)
- **Read & Inspection**: Administrators can click any built-in template to open the Template Inspector modal, viewing all bundled permission keys, description, and default/max scope ceilings.
- **Cloning UX**: Built-in templates are read-only (`isProtected = true`). Administrators can click "Clone as Custom Role" to seed a new customizable tenant role with the template's bundled permission set.

---

## 4. Custom Role Lifecycle & Governance
Tenant-defined custom roles allow businesses to tailor permission sets to their exact operational needs:

- **Create Role**: Define name, description, default scope, max scope ceiling, and select bundled permissions via the Permission Matrix.
- **Edit Role**: Update custom role capabilities and scope boundaries (`RoleGovernanceService.updateCustomRole`).
- **Clone Role**: Duplicate existing custom roles or built-in templates.
- **Active Member Protection**: Custom roles assigned to active staff members (`activeMembers > 0`) cannot be deleted or archived without explicit reassignment or confirmation.
- **Archive & Restore**: Roles can be archived (`isArchived = true`) to prevent new member assignments while retaining historical audit records. Archived roles can be restored at any time.

---

## 5. Permission Matrix Component
The `PermissionMatrix` (`src/components/access/permission-matrix.tsx`) provides an interactive interface for configuring capability bundles:

- **Domain Grouping**: 100+ permission keys organized logically into domains (Orders, Waiter, Kitchen, Cashier/Payments, Menu Catalog, Tables/Dining, Inventory, Recipes/Purchasing, Organization, Owner Only).
- **Select All / Clear All per Domain**: Quick selection controls per domain category.
- **Owner-Only Guard**: Owner-transfer and business-settings management keys are highlighted and restricted from non-owner assignment.

---

## 6. Canonical Scope UX & Hierarchy
The UI enforces the exact Phase 30 canonical scope model across all selectors, presets, and diagnostics:

```
ORGANIZATION  (Highest Scope Ceiling)
    │
 PROPERTY     (Branch / Property Level)
    │
DEPARTMENT    (Department Level)
    │
AREA_TEAM     (Organization Unit / Service Area Level)
    │
  SELF        (Self Ownership Only)
```

- **Scope Preset Ceiling**: Configures the default reach (`defaultScope`) and maximum allowable scope grant (`maxScope`).
- **AREA_TEAM Target Resolution**: Service areas and organization units (teams) are represented underneath the `AREA_TEAM` scope level without inventing redundant scope types.
- **Canonical Values**: UI submissions strictly send `ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, or `SELF`. `REGION` does NOT exist as an RBAC scope type.

---

## 7. Member Access Management & Capability Profiling
The Member Access Profile inspector (`/dashboard/access/members/[membershipId]`) provides a 360-degree view of a staff member's effective authorization state:

- **Primary & Custom Role**: Displays assigned built-in role or custom role with active status.
- **Effective Permission Breakdown**: Shows calculated permissions from role assignment, explicit scope grants, and member permission overrides.
- **Scope Boundaries**: Highlights assigned primary branch, department, and additional assignment targets.
- **Temporary Authority Indicator**: Displays active acting delegations and secondments without altering permanent role definitions.

---

## 8. Scoped Permission Grants
Scope Grants (`ScopeGrantManager`) allow granting fine-grained permissions targeted at specific organizational locations:

- **Targeted Reach**: Assign `ALLOW` or `DENY` grants to specific branches (`branchId`) or departments (`departmentId`).
- **Scope Ceilings**: Scope grants cannot exceed the role or preset's defined `maxScope` ceiling.
- **Tenant Validation**: Server-side validation guarantees target branches/departments belong strictly to the active business tenant.

---

## 9. Member Permission Overrides
Member Overrides (`MemberOverrideModal`) configure direct member-level exceptions:

- **Explicit ALLOW**: Grants a specific permission key to a member at a designated scope level regardless of their baseline role.
- **Explicit DENY**: Explicitly revokes a permission key for a member at a designated scope level.
- **DENY Precedence**: Explicit `DENY` overrides take precedence over baseline role permissions and explicit `ALLOW` grants when matching scope criteria.
- **Revocation**: Overrides can be deleted at any time to restore default role-based evaluation.

---

## 10. Access Diagnostics Engine ("Why Can / Can't This User?")
The Access Diagnostics Tool (`/dashboard/access/diagnostics`) provides live interactive evaluation against the Policy Engine:

- **Diagnostic Parameters**: Select Target Staff Member, Target Permission Key (WHAT), Resource Type (`organization`, `property`, `department`), and Target Location (Branch/Department).
- **Evaluation Output**:
  - **Decision**: `ACCESS ALLOWED` (Green) or `ACCESS DENIED` (Red).
  - **Natural Language Explanation**: Human-readable breakdown explaining why access was granted or denied.
  - **Decision Reason Code**: Canonical reason (e.g. `OWNER_POLICY`, `EXPLICIT_DENY`, `MEMBER_OVERRIDE_ALLOW`, `SCOPE_GRANT_ALLOW`, `ROLE_PERMISSION_ALLOW`, `DEFAULT_DENY`).
  - **Authority Source**: Provenance indicator (`owner_policy`, `member_override`, `scope_grant`, `role_definition`, `default_deny`).
  - **Matched Scope Level**: `ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, or `SELF`.
  - **Evaluation Duration**: Execution time in milliseconds (typically < 5ms).

---

## 11. Acting & Secondment Visibility
Temporary assignments are integrated transparently into member access profiles:

- **Acting Authority**: Staff acting in a higher position (e.g., Acting Branch Manager) gain the scoped permissions of that position for the active duration.
- **Secondments**: Staff temporarily seconded to another branch/department gain scoped permissions for the target location.
- **Non-Mutation Guarantee**: Baseline permanent role definitions and position assignments remain unchanged. Upon expiry or revocation of the temporary assignment, temporary authority is immediately purged from `AuthorizationContext`.

---

## 12. Role Archive & Reassignment UX
- **Reassignment Workflow**: When archiving or deleting a custom role assigned to staff, the system prompts the administrator to reassign affected members to a baseline built-in role or alternative custom role.
- **Protection**: Reassignment is validated server-side to ensure no staff member is left without an assigned role.

---

## 13. Staff Profile Access Summary Widget
The `StaffAccessSummaryWidget` (`src/components/access/staff-access-summary-widget.tsx`) embeds a compact authorization widget directly into general staff management pages (`/dashboard/people/[membershipId]`):

- Displays active role, scope ceiling, secondment tags, and quick link to inspect the full Access Profile.

---

## 14. Server-Side Security Boundaries
UI components serve exclusively as presentation layers. Server-side security guarantees include:

- **Server-Side Context Resolution**: Every Server Action calls `resolveAuthorizationContext()` using server session tokens. Client-provided business, member, or role IDs are never trusted without server-side validation.
- **Policy Engine Gatekeeping**: All sensitive operations are checked via `can({ context, permission, resource })` or `requireBusinessPermission()`.
- **Tenant Isolation**: Cross-tenant resource IDs are rejected by RLS and server-side boundary checks.

---

## 15. RLS Defense & Database Integrity
Database tables (`business_memberships`, `custom_roles`, `role_permissions`, `permission_scope_grants`, `member_permission_overrides`) are protected by Supabase Row-Level Security (RLS):

- Direct authenticated DB queries from clients cannot bypass tenant boundaries or read unauthorized tenant role definitions.
- Write operations are restricted to authenticated tenant members possessing `roles.manage` or `business_owner` status.

---

## 16. Mobile Behavior & Responsive Layout Audit
All Step 10 Access Management UI screens were audited for responsive performance across target viewport widths (320px, 360px, 375px, 390px, 412px, 430px):

- **Layout Grid**: Flex/grid layouts collapse cleanly to single-column cards on viewports < 640px.
- **Text Wrapping & Typography**: Long permission keys (e.g., `inventory.menu_profitability.view`) use `font-mono text-xs break-all` to eliminate horizontal overflow.
- **Touch Targets**: Buttons, dropdowns, and modal controls maintain minimum 44px touch areas for mobile usability.
- **Modal Overflow**: Modals use `max-h-[85vh] overflow-y-auto` with sticky headers and footers for safe scrolling on small mobile screens.
- **Audit Note**: *"Mobile verification was performed through static responsive code review, not device-level visual testing."*

---

## 17. Verification Results
All automated verification scripts and quality gates passed with 100% success:

- **TypeScript Type Check**: `npx tsc --noEmit` → **0 errors**
- **ESLint Analysis**: `npm run lint` → **✔ No ESLint warnings or errors**
- **Next.js Production Build**: `npm run build` → **Compiled successfully (0 errors, 49/49 static/server pages)**
- **Step 10 Management UI Suite**: `npm run verify:rbac-v2-management-ui` → **PASSED**
- **Role Governance Suite**: `npm run verify:rbac-v2-roles` → **PASSED**
- **Scope Grant Suite**: `npm run verify:rbac-v2-management` → **PASSED**
- **Policy Engine Suite**: `npm run verify:rbac-v2-engine` → **PASSED**
- **Context Engine Suite**: `npm run verify:rbac-v2-context` → **PASSED**
- **Organization Hierarchy Suite**: `npm run verify:organization` → **119/119 PASSED (100% success rate)**

---

## 18. Known Limitations & Architectural Notes
- **Non-Authorization Scope Concepts**: Non-RBAC domain entities (such as geographic delivery regions or kitchen display sub-areas) operate outside the Policy Engine scope model and do not mutate canonical `ScopeType` values.
- **Custom Role Creation Ceiling**: Custom roles are bounded by the `maxScope` defined at creation time and cannot grant organization-wide reach if constrained to `PROPERTY` or `DEPARTMENT`.

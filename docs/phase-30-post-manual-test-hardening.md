# WSNexa — Phase 30 Post-Manual-Test UX, Data Flow, Diagnostics & Performance Hardening Record

## Executive Summary

Following successful implementation and checkpointing of Phase 30 Step 10, manual production testing identified key operational bugs, data-flow inconsistencies, and responsiveness issues across Access Management UI surfaces:

1. **Built-in role cards displaying "0 keys"** on `/dashboard/access/roles`.
2. **Member identity rows defaulting to placeholder/fake data** (`Staff Member` / `staff@wsnexa.internal`).
3. **Access Diagnostics returning `RESOURCE_NOT_FOUND`** when evaluating real branch/property resources with explicit member overrides.
4. **Perceived button unresponsiveness** during async mutation operations.
5. **Technical/internal terminology exposure** in user-facing error banners and diagnostic provenance displays.

This post-manual-test hardening pass addresses all 5 root causes while strictly preserving every Phase 30 security invariant.

---

## SECTION 0 — Preserved Security Invariants

All core security architectures established in Phase 29 & Phase 30 remain 100% intact:

- **Canonical Scope Hierarchy**: `ORGANIZATION` > `PROPERTY` > `DEPARTMENT` > `AREA_TEAM` > `SELF`.
- **RBAC Scope Integrity**: `REGION` is NOT an RBAC scope; `SERVICE_AREA` is a concrete target underneath `AREA_TEAM`.
- **Tenant Isolation**: Multi-tenant database boundary enforced via RLS & server-side `resolveAuthorizationContext`.
- **Policy Engine Authority**: Client input is NEVER trusted; authorization decisions are computed strictly server-side.
- **Explicit DENY Precedence**: Explicit member DENY overrides take immediate precedence over role grants.

---

## SECTION 1 — Built-In Role "0 Keys" Fix

### Root Cause
`RoleGovernanceService.listBuiltInRoleTemplates()` returned template metadata without including the bundled permission keys list on the `BuiltInRoleTemplate` objects. The UI (`BuiltInRolesView`) inspected `tmpl.permissions?.length`, which resulted in `0` for all built-in templates.

### Fix
In `src/server/actions/permission.ts`, updated `listRoleTemplatesAction()` to map canonical permission bundles onto built-in role templates using `getPermissionsForPreset(t.roleKey)` (and `permissionKeyEnum.options` for `business_owner`).

### Verification
- `Branch Manager` built-in card displays **82 keys**.
- `Business Owner` built-in card displays **103 keys** (full set).
- `Inspect` modal displays real permission keys.
- `Clone Role` receives the full inherited permission set.

---

## SECTION 2 — Staff Identity Resolution Fix

### Root Cause
When user profile records lacked `email` or `first_name`/`last_name` in test environments, `PermissionService.listTeamMembers()` fell back to generating a fake internal email string (`staff@wsnexa.internal`).

### Fix
1. Removed `staff@wsnexa.internal` fallback in `PermissionService.listTeamMembers()`.
2. Enhanced email prefix derivation to cleanly capitalize names (e.g. `kasun.perera@gmail.com` -> `Kasun Perera`).
3. Updated UI (`/dashboard/access/members` and `member-access-detail-client.tsx`) to generate two-letter avatar initials (`KP`) and handle missing emails gracefully (`Email not available`) without fabricating addresses.

---

## SECTION 3 — Access Diagnostics `RESOURCE_NOT_FOUND` Fix

### Root Cause
In `diagnoseAccessAction`, the `resource` payload constructed `id: input.resourceId || undefined`. When testing branch resources from the UI, the client submitted `resourceType: 'branch'` and `branchId: '<UUID>'`, but omitted `resourceId`. `resource.id` evaluated to `undefined`, causing `resolveResourceScope` to throw `RESOURCE_NOT_FOUND`.

### Fix
Updated `diagnoseAccessAction` in `src/server/actions/permission.ts` to derive `derivedResourceId` from scope-specific inputs (`input.resourceId || input.branchId || input.departmentId || ...`).

### Verification
Testing `Branch Manager` + `branches.manage` + `PROPERTY` scope + `Main Branch` ID with an explicit member `DENY` override now correctly evaluates to:
- **Decision**: `ACCESS DENIED`
- **Reason**: `EXPLICIT_DENY`
- **Authority Source**: `explicit_override`
- **Matched Scope**: `PROPERTY`

---

## SECTION 4 — Button & Action Responsiveness Hardening

### Improvements
1. **Scope Grant Manager**: Added per-grant `revokingGrantId` state tracking to show `"Revoking…"` on the active item button and disable edit/revoke actions across all grants while an action is pending.
2. **Member Override Modal**: Added `disabled={isSubmitting}` and `"Saving..."` progress indicator.
3. **Role Cloning & Custom Role Forms**: Verified loading spinners and disabled state handling across submit buttons to prevent double-clicks.

---

## SECTION 5 — User-Friendly Error & Diagnostic Explanations

### Improvements
Rewrote technical Policy Engine diagnostic explanations and UI banners into clear, hospitality-oriented language:

| Event | Previous Technical Message | New User-Friendly Explanation |
| :--- | :--- | :--- |
| `EXPLICIT_DENY` | `An explicit DENY member override or scope grant takes absolute precedence...` | `This staff member has been specifically blocked from this action for the selected location. A direct restriction takes priority over their role.` |
| `RESOURCE_NOT_FOUND` | `Target resource could not be found or verified in database.` | `We couldn't verify the selected location or resource. It may have changed or may no longer be available. Refresh the page and try again.` |
| `PERMISSION_MISSING` | `The member's role does not contain permission '...'` | `This staff member's role does not include the '...' capability. Contact your manager to adjust their role if needed.` |
| `OUTSIDE_SCOPE` | `The member holds permission '...', but target resource is outside scope.` | `The staff member has this permission for their assigned location, but the selected location is outside their authorized area.` |

---

## SECTION 6 — Verification Results

| Suite | Status | Metrics |
| :--- | :--- | :--- |
| `npm run verify:rbac-v2-management-ui` | **PASSED** | 61 PASSED, 0 FAILED |
| `npx tsc --noEmit` | **PASSED** | Clean (0 errors) |
| `npm run lint` | **PASSED** | Clean (0 errors) |
| `npm run build` | **PASSED** | Production bundle compiled in 18.5s |

---

## SECTION 7 — Status of Original Manual Test Issues

- **Built-in roles show 0 keys**: **FIXED**
- **Staff member identity placeholder**: **FIXED**
- **Access Diagnostics `RESOURCE_NOT_FOUND`**: **FIXED**
- **Button / action responsiveness**: **FIXED**
- **User-friendly errors & warnings**: **FIXED**

---

**Phase 30 Post-Manual-Test Hardening is READY FOR MANUAL RETEST.**

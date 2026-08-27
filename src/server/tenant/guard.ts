import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { ActiveTenantContext } from '@/types';
import { getRequiredPermissionForRoute } from '@/lib/security/route-permissions';
import { PermissionKey } from '@/lib/validation/permission';

export interface RouteGuardResult {
  allowed: boolean;
  context: ActiveTenantContext;
  requiredPermission: PermissionKey | PermissionKey[] | null;
}

/**
 * Resolves the primary workspace route for a staff member role.
 * When a customRoleId is present the member is not a built-in role staff member —
 * always route to /dashboard so permission-based landing logic applies.
 */
export function resolveDefaultWorkspaceRoute(role?: string, customRoleId?: string | null): string {
  // Custom-role members must never be routed to a built-in operational workspace
  // solely because the underlying compatibility role key happens to match cashier/waiter/etc.
  if (customRoleId) return '/dashboard';

  switch (role) {
    case 'cashier':
      return '/dashboard/cashier';
    case 'kitchen_staff':
      return '/dashboard/kitchen';
    case 'waiter':
      return '/dashboard/waiter';
    default:
      return '/dashboard';
  }
}

/**
 * Server-side route permission guard.
 * Validates authentication, active business context, and permission matching pathname.
 */
export async function requireRoutePermission(pathname: string): Promise<RouteGuardResult> {
  const context = await resolveActiveBusinessContext();

  if (!context || !context.user || !context.business) {
    redirect('/login');
  }

  const requiredPermission = getRequiredPermissionForRoute(pathname);

  if (!requiredPermission) {
    return { allowed: true, context, requiredPermission: null };
  }

  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let allowed = false;
  try {
    const authContext = await resolveAuthorizationContext();
    if (authContext) {
      if (authContext.isBusinessOwner) {
        allowed = true;
      } else {
        const branchResource = authContext.activeBranchId
          ? {
              resourceType: 'branch' as const,
              resourceId: authContext.activeBranchId,
              businessId: authContext.businessId,
              branchId: authContext.activeBranchId,
              departmentId: null,
              organizationUnitId: null,
              serviceAreaId: null,
              ownerUserId: null,
            }
          : undefined;
        const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
        for (const perm of perms) {
          if (await can({ context: authContext, permission: perm, resource: branchResource })) {
            allowed = true;
            break;
          }
        }
      }
    }
  } catch {
    allowed = false;
  }

  return { allowed, context, requiredPermission };
}

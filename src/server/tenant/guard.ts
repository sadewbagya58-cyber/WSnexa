import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { ActiveTenantContext } from '@/types';
import { getRequiredPermissionForRoute } from '@/lib/security/route-permissions';
import { PermissionKey } from '@/lib/validation/permission';

export interface RouteGuardResult {
  allowed: boolean;
  context: ActiveTenantContext;
  requiredPermission: PermissionKey | null;
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
      const branchResource = authContext.activeBranchId
        ? { type: 'branch' as const, id: authContext.activeBranchId }
        : undefined;
      allowed = await can({ context: authContext, permission: requiredPermission, resource: branchResource });
    }
  } catch {
    allowed = false;
  }

  return { allowed, context, requiredPermission };
}

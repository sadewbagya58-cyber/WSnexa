import { redirect } from 'next/navigation';
import { BranchService } from '@/server/services/branch.service';
import { checkBranchQuota } from '@/server/services/branch-limit.service';
import { BranchManager } from '@/components/branch/branch-manager';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth';
import { SettingsSubNav } from '@/components/settings/settings-subnav';
import { resolveSettingsSubNavPermissions } from '@/server/navigation/settings-nav-permissions';

export default async function BranchesPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/branches');

  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }

  if (!tenantContext) {
    redirect('/login');
  }

  const { business, membership } = tenantContext;
  const isOwner = membership.role === 'business_owner';

  let authContext: Awaited<ReturnType<typeof resolveAuthorizationContext>> | null = null;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  const navPermissions = await resolveSettingsSubNavPermissions(
    authContext,
    tenantContext.activeBranch?.id,
    business.id
  );

  // Fetch all branches (including archived)
  const branchesData = await BranchService.getBusinessBranches(business.id, true);
  const quota = await checkBranchQuota(business.id);

  const formattedBranches = branchesData.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    phone: b.phone || null,
    email: b.email || null,
    address_line1: b.address_line_1 || null,
    city: b.city || null,
    timezone: b.timezone,
    currency: (b as unknown as { currency?: string }).currency || business.defaultCurrency,
    isDefault: b.is_default,
    status: b.status,
    require_table_selection: (b as unknown as { require_table_selection?: boolean }).require_table_selection ?? true,
    require_table_pin: (b as unknown as { require_table_pin?: boolean }).require_table_pin ?? false,
    table_pin_length: (b as unknown as { table_pin_length?: number }).table_pin_length ?? 4,
    latitude: (b as unknown as { latitude?: number | null }).latitude ?? null,
    longitude: (b as unknown as { longitude?: number | null }).longitude ?? null,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SettingsSubNav {...navPermissions} />
      <BranchManager
        business={{
          id: business.id,
          name: business.name,
          defaultCurrency: business.defaultCurrency,
          timezone: business.timezone,
        }}
        branches={formattedBranches}
        quota={quota}
        isOwner={isOwner}
      />
    </div>
  );
}

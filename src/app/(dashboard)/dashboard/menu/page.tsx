import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { can, resolveAuthorizationContext } from '@/server/auth';

export default async function MenuDashboardPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/menu');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }
  if (!tenantContext || !tenantContext.activeBranch) redirect('/login');

  const supabase = await createClient();

  // Fetch counts concurrently for the active branch
  const [{ count: categoryCount }, { count: itemCount }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id)
      .is('deleted_at', null),

    supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id)
      .is('deleted_at', null),
  ]);

  let canManageMenu = false;
  try {
    const authContext = await resolveAuthorizationContext();
    const branchResource = {
      resourceType: 'branch' as const,
      resourceId: tenantContext.activeBranch.id,
      businessId: tenantContext.business.id,
      branchId: tenantContext.activeBranch.id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    };
    const hasItemsCreate = await can({ context: authContext, permission: 'menu.items.create', resource: branchResource });
    const hasManage = await can({ context: authContext, permission: 'menu.manage', resource: branchResource });
    canManageMenu = hasItemsCreate || hasManage || authContext.isBusinessOwner;
  } catch {
    canManageMenu = false;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Overview"
        description={`Manage active food and beverage offerings, categories, items, and pricing for ${tenantContext.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Menu Overview' },
        ]}
        helpSlug="creating-menu-categories"
        primaryAction={
          canManageMenu ? (
            <Link
              href="/dashboard/menu/items/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + Add Menu Item
            </Link>
          ) : undefined
        }
        secondaryActions={
          canManageMenu ? (
            <Link
              href="/dashboard/menu/categories"
              className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
            >
              Manage Categories
            </Link>
          ) : undefined
        }
      />

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-zinc-200">
        <Link
          href="/dashboard/menu"
          className="border-b-2 border-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Menu Hub
        </Link>
        <Link
          href="/dashboard/menu/categories"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          Categories ({categoryCount || 0})
        </Link>
        <Link
          href="/dashboard/menu/items"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          Menu Items ({itemCount || 0})
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-zinc-500">Active Categories</h3>
          <p className="mt-2 text-3xl font-bold text-zinc-950">{categoryCount || 0}</p>
          <Link href="/dashboard/menu/categories" className="mt-3 inline-block text-xs font-semibold text-zinc-900 underline">
            Manage Categories →
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-zinc-500">Active Menu Items</h3>
          <p className="mt-2 text-3xl font-bold text-zinc-950">{itemCount || 0}</p>
          <Link href="/dashboard/menu/items" className="mt-3 inline-block text-xs font-semibold text-zinc-900 underline">
            Manage Items →
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-zinc-500">Quick Actions</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/dashboard/menu/items/new">
              <Button size="sm" className="w-full">
                + Create New Item
              </Button>
            </Link>
            <Link href="/dashboard/menu/categories">
              <Button size="sm" variant="outline" className="w-full">
                Manage Categories
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

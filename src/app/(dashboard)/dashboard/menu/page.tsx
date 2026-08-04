import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

export default async function MenuDashboardPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext) redirect('/login');

  const supabase = await createClient();

  // Fetch counts concurrently
  const [{ count: categoryCount }, { count: itemCount }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', tenantContext.business.id)
      .is('deleted_at', null),

    supabase
      .from('menu_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', tenantContext.business.id)
      .is('deleted_at', null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${tenantContext.business.name} Menu Catalog`}
        description={`Branch: ${tenantContext.defaultBranch?.name || 'Default Branch'} (${tenantContext.defaultBranch?.code || 'MAIN'})`}
        breadcrumbs={[{ label: 'Menu Catalog' }]}
        primaryAction={{
          label: '+ Add Menu Item',
          href: '/dashboard/menu/items/new',
        }}
        secondaryAction={{
          label: 'Manage Categories',
          href: '/dashboard/menu/categories',
        }}
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

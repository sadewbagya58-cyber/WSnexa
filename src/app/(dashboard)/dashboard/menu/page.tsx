import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function MenuDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext) redirect('/onboarding');

  // Fetch counts
  const { count: categoryCount } = await supabase
    .from('menu_categories')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', tenantContext.business.id)
    .is('deleted_at', null);

  const { count: itemCount } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', tenantContext.business.id)
    .is('deleted_at', null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="neutral" className="mb-1">
            Menu Catalog Management
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            {tenantContext.business.name} Menu
          </h1>
          <p className="text-xs text-zinc-500">
            Branch: {tenantContext.defaultBranch?.name || 'Default Branch'} ({tenantContext.defaultBranch?.code || 'MAIN'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/menu/items/new">
            <Button>+ Add Menu Item</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">← Dashboard</Button>
          </Link>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="mt-4 flex border-b border-zinc-200">
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
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ItemList } from '@/components/menu/item-list';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function MenuItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.defaultBranch) redirect('/onboarding');

  // Fetch categories for filtering
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // Fetch items
  const { data: items } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name)')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="neutral" className="mb-1">
            Menu Item Catalog
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Menu Items ({items?.length || 0})
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard/menu/items/new">
            <Button>+ Add Menu Item</Button>
          </Link>
          <Link href="/dashboard/menu">
            <Button variant="outline">← Menu Hub</Button>
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <ItemList
          initialItems={(items as unknown as Parameters<typeof ItemList>[0]['initialItems']) || []}
          categories={categories || []}
        />
      </div>
    </div>
  );
}

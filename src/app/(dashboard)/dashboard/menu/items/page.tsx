import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ItemList } from '@/components/menu/item-list';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { can, resolveAuthorizationContext } from '@/server/auth';

export default async function MenuItemsPage() {
  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) redirect('/login');

  const activeBranch = tenantContext.activeBranch;
  const supabase = await createClient();

  // Fetch categories, items, and price edit capability concurrently
  const [{ data: categories }, { data: items }, canEditPrice] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name')
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),

    supabase
      .from('menu_items')
      .select('*, menu_categories(name)')
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', activeBranch.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),

    (async () => {
      try {
        const authContext = await resolveAuthorizationContext();
        const branchResource = { type: 'branch' as const, id: activeBranch.id };
        const hasPrice = await can({ context: authContext, permission: 'menu.price.update', resource: branchResource });
        const hasManage = await can({ context: authContext, permission: 'menu.manage', resource: branchResource });
        const hasItemsCreate = await can({ context: authContext, permission: 'menu.items.create', resource: branchResource });
        return hasPrice || hasManage || hasItemsCreate || authContext.isBusinessOwner;
      } catch {
        return false;
      }
    })(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Menu Items Catalog (${items?.length || 0})`}
        description={`Manage item details, pricing, images, and modifier groups for ${activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Menu Overview', href: '/dashboard/menu' },
          { label: 'Menu Items' },
        ]}
        helpSlug="add-menu-items"
        primaryAction={
          canEditPrice ? (
            <Link
              href="/dashboard/menu/items/new"
              className="flex min-h-[44px] items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-950 rounded-xl hover:bg-zinc-800 transition-colors shadow-xs"
            >
              + Add Menu Item
            </Link>
          ) : undefined
        }
      />


      <ItemList
        initialItems={(items as unknown as Parameters<typeof ItemList>[0]['initialItems']) || []}
        categories={categories || []}
        canEditPrice={canEditPrice}
      />
    </div>
  );
}


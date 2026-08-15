import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ItemList } from '@/components/menu/item-list';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import { PageHeader } from '@/components/ui/page-header';

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
      const hasPrice = await PermissionService.hasPermission(
        tenantContext.user.id,
        tenantContext.business.id,
        activeBranch.id,
        'menu.price.update'
      );
      const hasManage = await PermissionService.hasPermission(
        tenantContext.user.id,
        tenantContext.business.id,
        activeBranch.id,
        'menu.manage'
      );
      return hasPrice || hasManage || tenantContext.membership?.role === 'business_owner';
    })(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Menu Items (${items?.length || 0})`}
        description={`Manage item details, pricing, images, and modifier groups for ${activeBranch.name}.`}
        breadcrumbs={[{ label: 'Menu Catalog', href: '/dashboard/menu' }, { label: 'Menu Items' }]}
        primaryAction={{
          label: '+ Add Menu Item',
          href: '/dashboard/menu/items/new',
        }}
        backHref="/dashboard/menu"
      />


      <ItemList
        initialItems={(items as unknown as Parameters<typeof ItemList>[0]['initialItems']) || []}
        categories={categories || []}
        canEditPrice={canEditPrice}
      />
    </div>
  );
}


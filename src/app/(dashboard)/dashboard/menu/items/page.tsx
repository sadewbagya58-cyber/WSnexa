import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ItemList } from '@/components/menu/item-list';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

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
    <div className="space-y-6">
      <PageHeader
        title={`Menu Items (${items?.length || 0})`}
        description={`Manage item details, pricing, images, and modifier groups for ${tenantContext.defaultBranch.name}.`}
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
      />
    </div>
  );
}

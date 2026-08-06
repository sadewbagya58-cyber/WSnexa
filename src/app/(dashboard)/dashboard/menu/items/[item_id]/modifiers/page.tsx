import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ModifierManager } from '@/components/menu/modifier-manager';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { formatMinorUnitsToDecimal } from '@/lib/utils/money';
import { PageHeader } from '@/components/ui/page-header';

interface PageProps {
  params: Promise<{ item_id: string }>;
}

export default async function MenuItemModifiersPage({ params }: PageProps) {
  const { item_id: menuItemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) redirect('/onboarding');

  // Fetch target menu item for active branch
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name)')
    .eq('id', menuItemId)
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.activeBranch.id)
    .is('deleted_at', null)
    .single();

  if (!menuItem) {
    redirect('/dashboard/menu/items');
  }

  // Fetch modifier groups & options for active branch
  const { data: modifierGroups } = await supabase
    .from('modifier_groups')
    .select('*, modifier_options(*)')
    .eq('menu_item_id', menuItemId)
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.activeBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // Filter out archived options inside active groups
  const activeGroups = (modifierGroups || []).map((group) => ({
    ...group,
    modifier_options: (group.modifier_options || [])
      .filter((opt: { deleted_at: string | null; display_order: number }) => opt.deleted_at === null)
      .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Modifiers for "${menuItem.name}"`}
        description={`Base Price: ${menuItem.currency} ${formatMinorUnitsToDecimal(menuItem.price_cents)} • Category: ${menuItem.menu_categories?.name || 'Uncategorized'}`}
        breadcrumbs={[
          { label: 'Menu Catalog', href: '/dashboard/menu' },
          { label: 'Menu Items', href: '/dashboard/menu/items' },
          { label: 'Modifiers' },
        ]}
        backHref="/dashboard/menu/items"
      />

      <ModifierManager
        menuItemId={menuItem.id}
        currency={menuItem.currency}
        initialGroups={activeGroups as unknown as Parameters<typeof ModifierManager>[0]['initialGroups']}
      />
    </div>
  );
}

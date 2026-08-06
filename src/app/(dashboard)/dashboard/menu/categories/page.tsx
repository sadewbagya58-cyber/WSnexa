import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CategoryManager } from '@/components/menu/category-manager';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PageHeader } from '@/components/ui/page-header';

export default async function MenuCategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) redirect('/onboarding');

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.activeBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Categories"
        description={`Organize food, beverage, and item categories for ${tenantContext.activeBranch.name}.`}
        breadcrumbs={[{ label: 'Menu Catalog', href: '/dashboard/menu' }, { label: 'Categories' }]}
        backHref="/dashboard/menu"
      />

      <CategoryManager initialCategories={categories || []} />
    </div>
  );
}

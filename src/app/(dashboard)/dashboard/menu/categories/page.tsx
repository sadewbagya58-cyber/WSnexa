import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CategoryManager } from '@/components/menu/category-manager';
import { PageHeader } from '@/components/layout/page-header';

import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';

export default async function MenuCategoriesPage() {
  const { allowed, context: tenantContext } = await requireRoutePermission('/dashboard/menu/categories');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(tenantContext?.membership?.role)} />;
  }
  if (!tenantContext || !tenantContext.activeBranch) redirect('/onboarding');
  const supabase = await createClient();

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
        description={`Organize food, beverage, and item categories for ${tenantContext.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Menu Overview', href: '/dashboard/menu' },
          { label: 'Categories' },
        ]}
      />

      <CategoryManager initialCategories={categories || []} />
    </div>
  );
}

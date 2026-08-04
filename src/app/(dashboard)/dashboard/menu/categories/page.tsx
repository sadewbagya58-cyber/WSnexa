import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { CategoryManager } from '@/components/menu/category-manager';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function MenuCategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.defaultBranch) redirect('/onboarding');

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div>
          <Badge variant="neutral" className="mb-1">
            Category Management
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Menu Categories
          </h1>
        </div>
        <Link href="/dashboard/menu" className="text-xs font-semibold text-zinc-600 hover:text-zinc-950">
          ← Back to Menu Hub
        </Link>
      </div>

      <div className="mt-8">
        <CategoryManager initialCategories={categories || []} />
      </div>
    </div>
  );
}

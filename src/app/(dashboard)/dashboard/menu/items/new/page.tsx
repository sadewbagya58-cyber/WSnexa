import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreateItemForm } from '@/components/menu/create-item-form';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export default async function NewMenuItemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.defaultBranch) redirect('/onboarding');

  // Fetch active categories for dropdown
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', tenantContext.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <div>
          <Badge variant="neutral" className="mb-1">
            Menu Item Creation
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Add New Menu Item
          </h1>
        </div>
        <Link href="/dashboard/menu/items" className="text-xs font-semibold text-zinc-600 hover:text-zinc-950">
          ← Cancel
        </Link>
      </div>

      <div className="mt-8">
        <Card className="p-6">
          <CreateItemForm
            categories={categories || []}
            currency={tenantContext.business.defaultCurrency}
            businessId={tenantContext.business.id}
            branchId={tenantContext.defaultBranch.id}
          />
        </Card>
      </div>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EditItemForm } from '@/components/menu/edit-item-form';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { can, resolveAuthorizationContext } from '@/server/auth';

interface PageProps {
  params: Promise<{ item_id: string }>;
}

export default async function EditMenuItemPage({ params }: PageProps) {
  const { item_id: menuItemId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const tenantContext = await resolveActiveBusinessContext();
  if (!tenantContext || !tenantContext.activeBranch) redirect('/onboarding');

  const activeBranch = tenantContext.activeBranch;

  // Fetch target menu item for active branch
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('id, name, slug, description, price_cents, currency, preparation_time_minutes, availability_status, is_featured, is_active, display_order, primary_image_url, category_id')
    .eq('id', menuItemId)
    .eq('business_id', tenantContext.business.id)
    .eq('branch_id', activeBranch.id)
    .is('deleted_at', null)
    .single();

  if (!menuItem) {
    redirect('/dashboard/menu/items');
  }

  // Concurrently fetch active categories and resolve permissions
  const [{ data: categories }, canEditPrice] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name')
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
        const hasItemsEdit = await can({ context: authContext, permission: 'menu.items.edit', resource: branchResource });
        return hasPrice || hasManage || hasItemsEdit || authContext.isBusinessOwner;
      } catch {
        return true;
      }
    })(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title={`Edit Menu Item: ${menuItem.name}`}
        description={`Update item details, pricing, visibility, and photo for ${activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Menu Overview', href: '/dashboard/menu' },
          { label: 'Menu Items', href: '/dashboard/menu/items' },
          { label: menuItem.name },
        ]}
        secondaryActions={
          <Link
            href="/dashboard/menu/items"
            className="flex min-h-[44px] items-center px-4 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs"
          >
            ← Back to Items
          </Link>
        }
      />

      <Card className="p-6">
        <EditItemForm
          item={menuItem}
          categories={categories || []}
          canEditPrice={canEditPrice}
          businessId={tenantContext.business.id}
          branchId={activeBranch.id}
        />
      </Card>
    </div>
  );
}

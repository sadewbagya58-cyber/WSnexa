import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { PrepProductionRunner } from '@/components/inventory/prep-production-runner';
import { InventorySubNav } from '@/components/inventory/inventory-subnav';
import { resolveInventorySubNavPermissions } from '@/server/inventory/inventory-nav-permissions';
import { can, resolveAuthorizationContext } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Prep Production Batches | WSNexa Inventory',
  description: 'Produce sub-recipe batches, convert raw ingredients into prepared inventory, and track kitchen yield variance',
};

export default async function PrepProductionPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory/production');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role, context?.membership?.customRoleId)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
  }

  let canProduce = false;
  let navPermissions: Awaited<ReturnType<typeof resolveInventorySubNavPermissions>> = {
    canViewInventory: false,
    canViewItems: false,
    canViewCounts: false,
    canViewRecipes: false,
    canViewPurchasing: false,
    canViewReceiving: false,
    canViewTransfers: false,
    canViewSuppliers: false,
    canViewLocations: false,
    canViewWaste: false,
    canViewSettings: false,
  };

  try {
    const authContext = await resolveAuthorizationContext();
    const branchResource = {
      resourceType: 'branch' as const,
      resourceId: context.activeBranch.id,
      businessId: context.business.id,
      branchId: context.activeBranch.id,
      departmentId: null,
      organizationUnitId: null,
      serviceAreaId: null,
      ownerUserId: null,
    };
    const hasProduce =
      (await can({ context: authContext, permission: 'inventory.production.manage', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'inventory.manage', resource: branchResource }));
    canProduce = hasProduce || authContext.isBusinessOwner;

    navPermissions = await resolveInventorySubNavPermissions(
      authContext,
      context.activeBranch.id,
      context.business.id
    );
  } catch {
    canProduce = false;
  }

  if (!canProduce) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context.membership?.role, context.membership?.customRoleId)} />;
  }

  const admin = createAdminClient();

  // 1. Fetch available prep recipes
  const { data: rawRecipes } = await admin
    .from('inventory_recipes')
    .select(`
      id,
      name,
      yield_quantity,
      yield_unit,
      output_item:output_inventory_item_id(name)
    `)
    .eq('business_id', context.business.id)
    .eq('recipe_type', 'prep_recipe')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const prepRecipes = (rawRecipes || []).map((r) => {
    const output = r.output_item as unknown as { name: string } | null;
    return {
      id: r.id,
      name: r.name,
      yieldQuantity: Number(r.yield_quantity) || 1,
      yieldUnit: r.yield_unit || 'portion',
      outputItemName: output?.name || 'Prepared Item',
    };
  });

  // 2. Fetch storage locations
  const { data: rawLocations } = await admin
    .from('inventory_storage_locations')
    .select('id, name')
    .eq('branch_id', context.activeBranch.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  const locations = (rawLocations || []).map((l) => ({ id: l.id, name: l.name }));

  // 3. Fetch recent production batch logs
  const { data: rawBatches } = await admin
    .from('inventory_production_batches')
    .select(`
      id,
      batch_number,
      actual_quantity,
      unit,
      yield_variance,
      produced_at,
      recipe:recipe_id(name)
    `)
    .eq('branch_id', context.activeBranch.id)
    .order('produced_at', { ascending: false })
    .limit(10);

  interface RawBatchRow {
    id: string;
    batch_number: string;
    actual_quantity: number;
    unit: string;
    yield_variance: number;
    produced_at: string;
    recipe?: { name: string } | null;
  }

  const batches = ((rawBatches || []) as unknown as RawBatchRow[]).map((b) => ({
    id: b.id,
    batch_number: b.batch_number,
    actual_quantity: Number(b.actual_quantity),
    unit: b.unit,
    yield_variance: Number(b.yield_variance),
    produced_at: b.produced_at,
    recipe: b.recipe,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prep Production Batches"
        description={`Convert raw batch ingredients into pre-prepped sub-recipes for ${context.activeBranch.name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Prep Production' },
        ]}
        helpSlug="sub-recipes-and-prep-production"
      />

      <InventorySubNav {...navPermissions} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <PrepProductionRunner
            prepRecipes={prepRecipes}
            locations={locations}
            canProduce={canProduce}
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
              Recent Production Batches
            </h3>

            {batches.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No production batches logged yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100 text-xs">
                {batches.map((b) => (
                  <div key={b.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-zinc-900">{b.recipe?.name || 'Prep Recipe'}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {b.batch_number} • {new Date(b.produced_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-zinc-950">
                        {b.actual_quantity} {b.unit}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Variance: {Number(b.yield_variance) > 0 ? `+${b.yield_variance}` : b.yield_variance}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

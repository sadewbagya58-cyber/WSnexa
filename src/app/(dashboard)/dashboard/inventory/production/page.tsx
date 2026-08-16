import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { createAdminClient } from '@/lib/supabase/server';
import { PrepProductionRunner } from '@/components/inventory/prep-production-runner';

export const metadata: Metadata = {
  title: 'Prep Production Batches | WSNexa Inventory',
  description: 'Produce sub-recipe batches, convert raw ingredients into prepared inventory, and track kitchen yield variance',
};

export default async function PrepProductionPage() {
  const { allowed, context } = await requireRoutePermission('/dashboard/inventory');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.user || !context.business || !context.activeBranch) {
    redirect('/login');
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
    .eq('is_active', true);

  interface RawRecipeRow {
    id: string;
    name: string;
    yield_quantity: number;
    yield_unit: string;
    output_item?: { name: string } | null;
  }

  const prepRecipes = ((rawRecipes as unknown as RawRecipeRow[]) || []).map((r) => ({
    id: r.id,
    name: r.name,
    yieldQuantity: Number(r.yield_quantity) || 1.0,
    yieldUnit: r.yield_unit,
    outputItemName: r.output_item?.name || null,
  }));

  // 2. Fetch storage locations
  const { data: rawLocations } = await admin
    .from('inventory_storage_locations')
    .select('id, name')
    .eq('branch_id', context.activeBranch.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  const locations = (rawLocations || []).map((l) => ({ id: l.id, name: l.name }));

  interface BatchRow {
    id: string;
    batch_number: string;
    expected_quantity: number;
    actual_quantity: number;
    yield_variance: number;
    unit: string;
    total_cost_cents: number;
    currency: string;
    produced_at: string;
    recipe?: { name: string } | null;
  }

  // 3. Fetch past production batches
  const { data: rawBatches } = await admin
    .from('inventory_production_batches')
    .select(`
      id,
      batch_number,
      expected_quantity,
      actual_quantity,
      yield_variance,
      unit,
      total_cost_cents,
      currency,
      produced_at,
      recipe:recipe_id(name)
    `)
    .eq('branch_id', context.activeBranch.id)
    .order('produced_at', { ascending: false })
    .limit(10);

  const batches = (rawBatches as unknown as BatchRow[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prep Batch Production"
        description="Convert raw ingredients into prepared outputs, deduct raw stock atomically, and log production yield variance"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory', href: '/dashboard/inventory' },
          { label: 'Prep Production' },
        ]}
        helpSlug="sub-recipes-and-prep-production"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <PrepProductionRunner prepRecipes={prepRecipes} locations={locations} />
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

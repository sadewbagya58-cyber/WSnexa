import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { AreaManager } from '@/components/table/area-manager';

export default async function ServiceAreasPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.defaultBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code, description, display_order, is_active')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">Service Areas</h1>
          <p className="text-xs text-zinc-500">
            Define dining sections (Main Hall, Outdoor, VIP, Bar) for {context.defaultBranch.name}.
          </p>
        </div>

        <Link href="/dashboard/tables">
          <Button variant="outline" size="sm">
            ← Back to Tables
          </Button>
        </Link>
      </div>

      <AreaManager initialAreas={areas || []} />
    </div>
  );
}

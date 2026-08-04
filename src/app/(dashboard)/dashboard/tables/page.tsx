import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { TableGrid } from '@/components/table/table-grid';

export default async function TablesDashboardPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.defaultBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Fetch active service areas
  const { data: areas } = await supabase
    .from('service_areas')
    .select('id, name, code')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  // Fetch active dining tables
  const { data: tables } = await supabase
    .from('dining_tables')
    .select('id, name, code, table_number, capacity, status, shape, is_active, service_area_id, service_areas(name, code)')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.defaultBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">Dining Tables</h1>
          <p className="text-xs text-zinc-500">
            Manage floor layouts, dining areas, and table statuses for {context.defaultBranch.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/tables/areas">
            <Button variant="outline" size="sm">
              📁 Manage Areas ({areas?.length || 0})
            </Button>
          </Link>
          <Link href="/dashboard/tables/bulk">
            <Button variant="outline" size="sm">
              ⚡ Bulk Generator
            </Button>
          </Link>
          <Link href="/dashboard/tables/new">
            <Button size="sm">+ Add Single Table</Button>
          </Link>
        </div>
      </div>

      <TableGrid initialTables={tables || []} areas={areas || []} />
    </div>
  );
}

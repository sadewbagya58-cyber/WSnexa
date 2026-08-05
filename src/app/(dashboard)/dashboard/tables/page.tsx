import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { TableGrid } from '@/components/table/table-grid';
import { PageHeader } from '@/components/ui/page-header';

export default async function TablesDashboardPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.defaultBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Fetch active service areas and dining tables concurrently
  const [{ data: areas }, { data: tables }] = await Promise.all([
    supabase
      .from('service_areas')
      .select('id, name, code')
      .eq('business_id', context.business.id)
      .eq('branch_id', context.defaultBranch.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),

    supabase
      .from('dining_tables')
      .select('id, name, code, table_number, capacity, status, shape, is_active, service_area_id, service_areas(name, code)')
      .eq('business_id', context.business.id)
      .eq('branch_id', context.defaultBranch.id)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dining Tables & Floor Layout"
        description={`Manage service areas, floor sections, and table statuses for ${context.defaultBranch.name}.`}
        breadcrumbs={[{ label: 'Tables' }]}
        primaryAction={{
          label: '+ Add Table',
          href: '/dashboard/tables/new',
        }}
        secondaryAction={{
          label: '📱 Bulk QR Export',
          href: '/dashboard/tables/qr',
        }}
      />

      <TableGrid initialTables={tables || []} areas={areas || []} />
    </div>
  );
}

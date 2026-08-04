import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { AreaManager } from '@/components/table/area-manager';
import { PageHeader } from '@/components/ui/page-header';

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
      <PageHeader
        title="Service Areas"
        description={`Organize dining tables by hall, floor, terrace, or service zone in ${context.defaultBranch.name}.`}
        breadcrumbs={[{ label: 'Tables', href: '/dashboard/tables' }, { label: 'Service Areas' }]}
        backHref="/dashboard/tables"
      />

      <AreaManager initialAreas={areas || []} />
    </div>
  );
}

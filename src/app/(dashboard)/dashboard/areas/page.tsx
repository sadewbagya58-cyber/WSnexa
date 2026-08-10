import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { ServiceAreaService } from '@/server/services/service-area.service';
import { AreaManagement } from '@/components/area/area-management';
import { createClient } from '@/lib/supabase/server';

export default async function ServiceAreasPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const areas = await ServiceAreaService.listBranchAreas(
    context.business.id,
    context.activeBranch.id
  );

  const supabase = await createClient();
  const { data: branchData } = await supabase
    .from('branches')
    .select('ordering_mode')
    .eq('id', context.activeBranch.id)
    .single();

  const orderingMode = (branchData?.ordering_mode as 'qr_only' | 'waiter_only' | 'qr_and_waiter') || 'qr_and_waiter';

  return (
    <AreaManagement
      initialAreas={areas}
      activeBranchName={context.activeBranch.name}
      initialOrderingMode={orderingMode}
    />
  );
}

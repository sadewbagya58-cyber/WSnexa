import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { ServiceAreaService } from '@/server/services/service-area.service';
import { MenuCatalogService } from '@/server/services/menu-catalog.service';
import { WaiterOrderBuilder } from '@/components/waiter/waiter-order-builder';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function WaiterOrderPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Fetch areas
  let areas = await ServiceAreaService.listBranchAreas(
    context.business.id,
    context.activeBranch.id
  );

  // If user is waiter role, filter to assigned areas
  if (context.membership.role === 'waiter') {
    const assignedIds = await ServiceAreaService.getStaffAssignedAreaIds(context.membership.id);
    if (assignedIds.length > 0) {
      areas = areas.filter((a) => assignedIds.includes(a.id));
    }
  }

  // Fetch dining tables for active branch
  const { data: tablesData } = await supabase
    .from('dining_tables')
    .select('id, name, table_number, service_area_id')
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  const tables = (tablesData || []).map((t) => ({
    id: t.id,
    name: t.name,
    tableNumber: t.table_number,
    serviceAreaId: t.service_area_id,
  }));

  // Fetch canonical branch menu catalog from MenuCatalogService
  const catalog = await MenuCatalogService.getBranchMenuCatalog(
    context.business.id,
    context.activeBranch.id
  );

  if (!catalog) {
    redirect('/dashboard');
  }

  const waiterName = context.user.email ? context.user.email.split('@')[0] : 'Staff';

  return (
    <WaiterOrderBuilder
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      tables={tables}
      catalog={catalog}
      businessId={context.business.id}
      activeBranchId={context.activeBranch.id}
      userId={context.user.id}
      activeBranchName={context.activeBranch.name}
      waiterName={waiterName}
    />
  );
}


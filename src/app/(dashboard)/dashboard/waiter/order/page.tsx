import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { createClient } from '@/lib/supabase/server';
import { ServiceAreaService } from '@/server/services/service-area.service';
import { WaiterOrderBuilder } from '@/components/waiter/waiter-order-builder';

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

  // Fetch menu items with category names
  const { data: itemsData } = await supabase
    .from('menu_items')
    .select('id, name, price, description, is_available, category:menu_categories(name)')
    .eq('business_id', context.business.id)
    .eq('is_available', true)
    .is('deleted_at', null);

  const menuItems = (itemsData || []).map((i) => {
    const categoryName = Array.isArray(i.category)
      ? i.category[0]?.name
      : (i.category as { name?: string } | null)?.name || 'General';
    return {
      id: i.id,
      name: i.name,
      price: i.price,
      description: i.description,
      categoryName,
    };
  });

  return (
    <WaiterOrderBuilder
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      tables={tables}
      menuItems={menuItems}
      activeBranchName={context.activeBranch.name}
    />
  );
}

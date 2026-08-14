'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '../tenant/resolver';
import { createClient } from '@/lib/supabase/server';

export interface WaiterOrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: Array<{
    groupId: string;
    optionId: string;
    nameSnapshot: string;
    priceSnapshot: number;
  }>;
  notes?: string;
}

export interface CreateWaiterOrderInput {
  tableId: string;
  items: WaiterOrderItemInput[];
  notes?: string;
}

export async function createWaiterOrderAction(input: CreateWaiterOrderInput) {
  try {
    const tenant = await resolveActiveBusinessContext();
    if (!tenant || !tenant.activeBranch) {
      return { success: false, message: 'Unauthorized session or active branch not found.' };
    }

    if (!input.tableId || !input.items || input.items.length === 0) {
      return { success: false, message: 'Table ID and at least one order item are required.' };
    }

    const supabase = await createClient();

    // 1. Verify branch ordering_mode allows waiter ordering
    const { data: branch } = await supabase
      .from('branches')
      .select('ordering_mode')
      .eq('id', tenant.activeBranch.id)
      .single();

    const orderingMode = branch?.ordering_mode || 'qr_and_waiter';
    if (orderingMode === 'qr_only') {
      return { success: false, message: 'Branch is currently configured for QR Ordering Only.' };
    }

    // 2. Fetch table details including service area
    const { data: table, error: tableErr } = await supabase
      .from('dining_tables')
      .select('id, name, table_number, service_area_id, service_areas(id, name)')
      .eq('id', input.tableId)
      .eq('business_id', tenant.business.id)
      .eq('branch_id', tenant.activeBranch.id)
      .single();

    if (tableErr || !table) {
      return { success: false, message: 'Selected table not found in active branch.' };
    }

    // 3. Verify waiter area authorization if user has role 'waiter'
    if (tenant.membership.role === 'waiter' && table.service_area_id) {
      const { data: areaAssigns } = await supabase
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', tenant.membership.id);

      if (areaAssigns && areaAssigns.length > 0) {
        const assignedIds = areaAssigns.map((a) => a.service_area_id);
        if (!assignedIds.includes(table.service_area_id)) {
          return { success: false, message: 'You are not assigned to this service area.' };
        }
      }
    }

    // 4. Validate menu items in ONE single pass with strict branch isolation
    const uniqueItemIds = Array.from(new Set(input.items.map((i) => i.menuItemId)));
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, price_cents, availability_status, branch_id, business_id')
      .in('id', uniqueItemIds)
      .eq('business_id', tenant.business.id)
      .eq('branch_id', tenant.activeBranch.id)
      .is('deleted_at', null);

    const itemMap = new Map((menuItems || []).map((m) => [m.id, m]));

    if (itemMap.size !== uniqueItemIds.length) {
      console.error(
        '[createWaiterOrderAction] Item validation failed. Submitted unique IDs:',
        uniqueItemIds,
        'Found items in active branch:',
        Array.from(itemMap.keys()),
        'Active branch ID:',
        tenant.activeBranch.id
      );
      return {
        success: false,
        message: 'An item in this order is no longer available for this branch. Please refresh the menu and try again.',
      };
    }

    // 4b. Fetch and validate selected modifiers
    const allModifierOptionIds = input.items
      .flatMap((i) => i.selectedModifiers || [])
      .map((m) => m.optionId);

    const optionMap = new Map<
      string,
      {
        id: string;
        modifier_group_id: string;
        name: string;
        price_cents: number;
        menu_item_id: string;
        branch_id: string;
      }
    >();

    if (allModifierOptionIds.length > 0) {
      const { data: optionsData } = await supabase
        .from('modifier_options')
        .select(
          'id, modifier_group_id, name, price_cents, additional_price_cents, modifier_groups!inner(id, menu_item_id, menu_items!inner(id, branch_id))'
        )
        .in('id', allModifierOptionIds);

      if (optionsData) {
        type OptionRow = {
          id: string;
          modifier_group_id: string;
          name: string;
          price_cents?: number | null;
          additional_price_cents?: number | null;
          modifier_groups?: {
            id: string;
            menu_item_id: string;
            menu_items?: { id: string; branch_id: string } | null;
          } | null;
        };
        for (const opt of optionsData as unknown as OptionRow[]) {
          const modPriceCents = opt.price_cents ?? opt.additional_price_cents ?? 0;
          optionMap.set(opt.id, {
            id: opt.id,
            modifier_group_id: opt.modifier_group_id,
            name: opt.name,
            price_cents: modPriceCents,
            menu_item_id: opt.modifier_groups?.menu_item_id || '',
            branch_id: opt.modifier_groups?.menu_items?.branch_id || '',
          });
        }
      }
    }

    let totalSubtotalCents = 0;
    const orderItemsPayload = [];

    for (const itemInput of input.items) {
      const item = itemMap.get(itemInput.menuItemId);
      if (!item) {
        return {
          success: false,
          message: 'An item in this order is no longer available for this branch. Please refresh the menu and try again.',
        };
      }

      if (item.availability_status === 'out_of_stock' || item.availability_status === 'hidden') {
        return {
          success: false,
          message: `Item "${item.name}" is currently unavailable or sold out. Please refresh the menu.`,
        };
      }

      let unitPriceCents = item.price_cents || 0;

      if (itemInput.selectedModifiers && itemInput.selectedModifiers.length > 0) {
        for (const mod of itemInput.selectedModifiers) {
          const opt = optionMap.get(mod.optionId);
          if (
            !opt ||
            opt.modifier_group_id !== mod.groupId ||
            opt.menu_item_id !== itemInput.menuItemId ||
            opt.branch_id !== tenant.activeBranch.id
          ) {
            return {
              success: false,
              message: 'Selected item options belong to another menu item or branch. Please refresh the menu.',
            };
          }
          unitPriceCents += opt.price_cents;
        }
      }

      const lineSubtotalCents = unitPriceCents * itemInput.quantity;
      totalSubtotalCents += lineSubtotalCents;

      orderItemsPayload.push({
        menu_item_id: item.id,
        item_name_snapshot: item.name,
        quantity: itemInput.quantity,
        unit_price_cents_snapshot: unitPriceCents,
        line_subtotal_cents: lineSubtotalCents,
        special_instructions: itemInput.notes || null,
      });
    }

    const areaName = Array.isArray(table.service_areas)
      ? table.service_areas[0]?.name
      : (table.service_areas as { name?: string } | null)?.name || 'Main Area';

    // 5. Generate sequential order number & insert into orders
    const { data: seqData } = await supabase.rpc('generate_next_order_number', {
      p_branch_id: tenant.activeBranch.id,
    });

    const orderNumber = seqData || Math.floor(1000 + Math.random() * 9000);
    const totalCents = totalSubtotalCents;

    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        business_id: tenant.business.id,
        branch_id: tenant.activeBranch.id,
        table_id: table.id,
        service_area_id: table.service_area_id,
        service_area_name_snapshot: areaName,
        order_number: orderNumber,
        order_number_formatted: `#ORD-${orderNumber}`,
        idempotency_key: `waiter_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        status: 'confirmed',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: totalCents,
        total_cents: totalCents,
        currency: tenant.business.defaultCurrency || 'LKR',
        order_source: 'waiter',
        created_by_user_id: tenant.user.id,
        guest_notes: input.notes || null,
      })
      .select('*')
      .single();

    if (orderErr || !newOrder) {
      return { success: false, message: orderErr?.message || 'Failed to create waiter order.' };
    }

    // 6. Insert order_items
    const orderItemRows = orderItemsPayload.map((op) => ({
      order_id: newOrder.id,
      ...op,
    }));

    await supabase.from('order_items').insert(orderItemRows);

    revalidatePath('/dashboard/waiter');
    revalidatePath('/dashboard/kitchen');
    revalidatePath('/dashboard/cashier');

    return {
      success: true,
      message: `Order #${orderNumber} placed successfully.`,
      orderId: newOrder.id,
      orderNumber,
    };
  } catch (err: unknown) {
    return { success: false, message: (err as Error).message || 'Failed to create waiter order.' };
  }
}

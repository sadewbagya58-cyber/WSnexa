'use server';

import { revalidatePath } from 'next/cache';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/server';

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
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.activeBranchId) {
      return { success: false, message: "You don't have permission to place orders for this branch." };
    }

    if (!input.tableId || !input.items || input.items.length === 0) {
      return { success: false, message: 'Table selection and at least one item are required.' };
    }

    const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };

    // 1. Permission authorization check via RBAC V2
    const hasCreatePerm =
      (await can({ context: authContext, permission: 'waiter.orders.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'orders.create', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'orders.view', resource: branchResource }));

    if (!hasCreatePerm) {
      return { success: false, message: "You don't have permission to place orders for this branch." };
    }

    const admin = createAdminClient();

    // 2. Verify branch ordering_mode allows waiter ordering
    const { data: branch } = await admin
      .from('branches')
      .select('ordering_mode, currency, businesses(default_currency)')
      .eq('id', authContext.activeBranchId)
      .single();

    const orderingMode = branch?.ordering_mode || 'qr_and_waiter';
    if (orderingMode === 'qr_only') {
      return { success: false, message: 'Branch is currently configured for QR Ordering Only.' };
    }

    // 3. Fetch dining table details
    const { data: table, error: tableErr } = await admin
      .from('dining_tables')
      .select('id, name, table_number, service_area_id, service_areas(id, name)')
      .eq('id', input.tableId)
      .eq('business_id', authContext.businessId)
      .eq('branch_id', authContext.activeBranchId)
      .single();

    if (tableErr || !table) {
      return { success: false, message: 'Selected table is no longer available in this branch.' };
    }

    // 4. Verify waiter service area authorization if user has area restrictions
    if (table.service_area_id) {
      const tableResource = { type: 'dining_table' as const, id: input.tableId };
      const canAccessTable = await can({ context: authContext, permission: 'waiter.orders.create', resource: tableResource });
      if (!canAccessTable) {
        return { success: false, message: 'You are not assigned to this service area.' };
      }
    }

    // 5. Validate menu items in ONE single pass with strict branch isolation
    const uniqueItemIds = Array.from(new Set(input.items.map((i) => i.menuItemId)));
    const { data: menuItems } = await admin
      .from('menu_items')
      .select('id, name, price_cents, availability_status, branch_id, business_id')
      .in('id', uniqueItemIds)
      .eq('business_id', authContext.businessId)
      .eq('branch_id', authContext.activeBranchId)
      .is('deleted_at', null);

    const itemMap = new Map((menuItems || []).map((m) => [m.id, m]));

    if (itemMap.size !== uniqueItemIds.length) {
      console.error(
        '[createWaiterOrderAction] Item validation failed. Submitted IDs:',
        uniqueItemIds,
        'Active branch:',
        authContext.activeBranchId
      );
      return {
        success: false,
        message: 'Some items are no longer available. Please refresh the menu.',
      };
    }

    // 6. Fetch and validate selected modifiers
    const allModifierOptionIds = input.items
      .flatMap((i) => i.selectedModifiers || [])
      .map((m) => m.optionId);

    const optionMap = new Map<
      string,
      {
        id: string;
        modifier_group_id: string;
        group_name: string;
        name: string;
        price_cents: number;
        menu_item_id: string;
        branch_id: string;
      }
    >();

    if (allModifierOptionIds.length > 0) {
      const { data: optionsData } = await admin
        .from('modifier_options')
        .select(
          'id, modifier_group_id, name, price_cents, additional_price_cents, modifier_groups!inner(id, name, menu_item_id, menu_items!inner(id, branch_id))'
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
            name?: string | null;
            menu_item_id: string;
            menu_items?: { id: string; branch_id: string } | null;
          } | null;
        };
        for (const opt of optionsData as unknown as OptionRow[]) {
          const modPriceCents = opt.price_cents ?? opt.additional_price_cents ?? 0;
          optionMap.set(opt.id, {
            id: opt.id,
            modifier_group_id: opt.modifier_group_id,
            group_name: opt.modifier_groups?.name || 'Option Group',
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
          message: 'Some items are no longer available. Please refresh the menu.',
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
            opt.branch_id !== authContext.activeBranchId
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
        selectedModifiers: itemInput.selectedModifiers,
      });
    }

    const areaName = Array.isArray(table.service_areas)
      ? table.service_areas[0]?.name
      : (table.service_areas as { name?: string } | null)?.name || 'Main Area';

    // 7. Generate sequential order number
    const { data: seqData } = await admin.rpc('generate_next_order_number', {
      p_branch_id: authContext.activeBranchId,
    });

    const orderNumber = seqData || Math.floor(1000 + Math.random() * 9000);
    const totalCents = totalSubtotalCents;

    const bizCurrency = (branch?.businesses as unknown as { default_currency?: string })?.default_currency || (branch as { currency?: string })?.currency || 'LKR';

    // 8. Atomic Order Creation
    const { data: newOrder, error: orderErr } = await admin
      .from('orders')
      .insert({
        business_id: authContext.businessId,
        branch_id: authContext.activeBranchId,
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
        currency: bizCurrency,
        order_source: 'waiter',
        created_by_user_id: authContext.userId,
        guest_notes: input.notes || null,
      })
      .select('*')
      .single();

    if (orderErr || !newOrder) {
      console.error('[createWaiterOrderAction] Order insert error:', orderErr);
      return { success: false, message: 'Unable to place the order right now. Please try again.' };
    }

    // 9. Insert order items
    const orderItemRows = orderItemsPayload.map((itemPayload) => ({
      order_id: newOrder.id,
      menu_item_id: itemPayload.menu_item_id,
      item_name_snapshot: itemPayload.item_name_snapshot,
      unit_price_cents_snapshot: itemPayload.unit_price_cents_snapshot,
      quantity: itemPayload.quantity,
      line_subtotal_cents: itemPayload.line_subtotal_cents,
      special_instructions: itemPayload.special_instructions,
    }));

    const { data: insertedItems, error: itemsErr } = await admin
      .from('order_items')
      .insert(orderItemRows)
      .select('id, menu_item_id');

    if (itemsErr || !insertedItems) {
      console.error('[createWaiterOrderAction] Order items insert error:', itemsErr);
      // Clean up parent order to maintain atomicity
      await admin.from('orders').delete().eq('id', newOrder.id);
      return { success: false, message: 'Unable to place the order right now. Please try again.' };
    }

    // 10. Insert order item modifiers if any
    if (orderItemsPayload.some((op) => op.selectedModifiers && op.selectedModifiers.length > 0)) {
      const itemMapByMenuId = new Map(insertedItems.map((i) => [i.menu_item_id, i.id]));
      const modifierRows = [];

      for (const op of orderItemsPayload) {
        const orderItemId = itemMapByMenuId.get(op.menu_item_id);
        if (orderItemId && op.selectedModifiers) {
          for (const mod of op.selectedModifiers) {
            const optDetails = optionMap.get(mod.optionId);
            modifierRows.push({
              order_item_id: orderItemId,
              modifier_group_id: mod.groupId,
              modifier_option_id: mod.optionId,
              group_name_snapshot: optDetails?.group_name || 'Option Group',
              option_name_snapshot: mod.nameSnapshot,
              additional_price_cents_snapshot: mod.priceSnapshot,
            });
          }
        }
      }

      if (modifierRows.length > 0) {
        const { error: modErr } = await admin.from('order_item_modifiers').insert(modifierRows);
        if (modErr) {
          console.error('[createWaiterOrderAction] Order item modifiers insert error:', modErr);
          // Rollback inserted items and parent order
          await admin.from('order_items').delete().eq('order_id', newOrder.id);
          await admin.from('orders').delete().eq('id', newOrder.id);
          return { success: false, message: 'Unable to place the order right now. Please try again.' };
        }
      }
    }

    // Automated Inventory Consumption Trigger for confirmed orders (Phase 28)
    try {
      const { ConsumptionService } = await import('@/server/services/consumption.service');
      await ConsumptionService.processOrderStageConsumption(newOrder.id, 'confirmed', authContext.userId);
    } catch (consErr) {
      console.error('[createWaiterOrderAction] Automated consumption trigger error:', consErr);
    }

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
    console.error('[createWaiterOrderAction] Unexpected error:', err);
    return { success: false, message: 'Unable to place the order right now. Please try again.' };
  }
}

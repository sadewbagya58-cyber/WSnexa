import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { hashQrToken, hashTablePin } from '@/lib/qr/security';
import { verifySignedTableAccessProof } from '@/lib/qr/table-access-proof';
import {
  CreateGuestOrderInput,
  createGuestOrderSchema,
  OrderStatus,
} from '@/lib/validation/order';

export interface OrderItemModifierRecord {
  id: string;
  group_name_snapshot: string;
  option_name_snapshot: string;
  additional_price_cents_snapshot: number;
}

export interface OrderItemRecord {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_cents_snapshot: number;
  quantity: number;
  line_subtotal_cents: number;
  special_instructions: string | null;
  order_item_modifiers: OrderItemModifierRecord[];
}

export interface OrderRecord {
  id: string;
  business_id: string;
  branch_id: string;
  table_id: string | null;
  order_number: number;
  order_number_formatted: string;
  idempotency_key: string;
  access_token: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_notes: string | null;
  subtotal_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  table?: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
  } | null;
  items?: OrderItemRecord[];
}

export class OrderService {
  /**
   * Submits a guest order atomically via PostgreSQL create_guest_order RPC.
   */
  static async createGuestOrder(input: CreateGuestOrderInput) {
    const parsed = createGuestOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid order input data.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      rawQrToken,
      tableId,
      inputPin,
      signedTableAccessProof,
      guestName,
      guestPhone,
      guestNotes,
      idempotencyKey,
      cartItems,
    } = parsed.data;

    // Compute peppered token hash
    const tokenHash = hashQrToken(rawQrToken);
    const supabase = await createClient();

    let pinHash: string | null = null;

    // 1. If signed table access proof is provided, verify proof integrity, branch, table, and expiration
    if (signedTableAccessProof && tableId) {
      // First resolve branchId associated with QR code
      const { data: qrData } = await supabase
        .from('branch_qr_codes')
        .select('branch_id')
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .is('revoked_at', null)
        .maybeSingle();

      if (!qrData) {
        return { success: false, message: 'Invalid or revoked QR code.' };
      }

      const proofResult = verifySignedTableAccessProof(
        signedTableAccessProof,
        qrData.branch_id,
        tableId
      );

      if (!proofResult.valid) {
        if (proofResult.error === 'EXPIRED') {
          return {
            success: false,
            message: 'Table verification expired. Please verify your table again.',
            errorType: 'TABLE_VERIFICATION_EXPIRED',
          };
        }
        return {
          success: false,
          message: 'Invalid or tampered table verification proof.',
          errorType: 'INVALID_TABLE_PROOF',
        };
      }

      // Proof is valid! Retrieve table_pin_hash from database so RPC receives verified pinHash
      const { data: tableData } = await supabase
        .from('dining_tables')
        .select('table_pin_hash')
        .eq('id', tableId)
        .eq('branch_id', qrData.branch_id)
        .maybeSingle();

      if (!tableData) {
        return { success: false, message: 'Selected dining table is unavailable.' };
      }

      pinHash = tableData.table_pin_hash;
    } else if (inputPin && inputPin.trim().length > 0) {
      pinHash = hashTablePin(inputPin.trim());
    }

    // Invoke atomic create_guest_order RPC
    const { data, error } = await supabase.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableId || null,
      p_pin_hash: pinHash,
      p_guest_name: guestName || null,
      p_guest_phone: guestPhone || null,
      p_guest_notes: guestNotes || null,
      p_idempotency_key: idempotencyKey,
      p_cart_items: cartItems,
    });

    if (error || !data) {
      return {
        success: false,
        message: error?.message || 'Failed to execute order RPC.',
      };
    }

    const res = data as {
      success: boolean;
      error?: string;
      order_id?: string;
      access_token?: string;
      order_number_formatted?: string;
      status?: OrderStatus;
      total_cents?: number;
      currency?: string;
      is_duplicate?: boolean;
    };

    if (!res.success) {
      let message = 'Order placement failed.';
      const errCode = res.error || '';

      if (errCode === 'INVALID_QR_TOKEN' || errCode === 'INVALID_OR_REVOKED_QR') {
        message = 'Invalid or expired venue QR code. Please rescan the QR on your table.';
      } else if (errCode === 'TABLE_REQUIRED') {
        message = 'Please select your dining table before placing your order.';
      } else if (errCode === 'INVALID_TABLE_PIN' || errCode === 'PIN_REQUIRED') {
        message = 'Invalid Table PIN. Please check the PIN displayed on your table sticker.';
      } else if (errCode === 'EMPTY_CART') {
        message = 'Your cart is empty. Please add menu items before submitting.';
      } else if (errCode.startsWith('ITEM_OUT_OF_STOCK')) {
        const itemName = errCode.split(':')[1]?.trim() || 'One of your items';
        message = `${itemName} is currently out of stock. Please remove it from your cart.`;
      } else if (errCode.startsWith('REQUIRED_MODIFIER_GROUP_MISSING')) {
        const grpName = errCode.split(':')[1]?.trim() || 'Required customization';
        message = `Please select options for required modifier group: "${grpName}".`;
      } else if (errCode.startsWith('CROSS_ITEM_MODIFIER_INJECTION')) {
        message = 'Security alert: Invalid modifier customization selection detected.';
      } else {
        message = errCode || message;
      }

      return { success: false, message };
    }

    return {
      success: true,
      data: {
        orderId: res.order_id!,
        accessToken: res.access_token!,
        orderNumberFormatted: res.order_number_formatted!,
        status: res.status!,
        totalCents: res.total_cents!,
        currency: res.currency!,
        isDuplicate: res.is_duplicate || false,
      },
    };
  }

  /**
   * Fetches full guest order confirmation details by ID with access_token security check.
   */
  static async getOrderById(orderId: string, accessToken?: string): Promise<OrderRecord | null> {
    const supabase = await createClient();

    let query = supabase
      .from('orders')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number),
        items:order_items(
          id,
          menu_item_id,
          item_name_snapshot,
          unit_price_cents_snapshot,
          quantity,
          line_subtotal_cents,
          special_instructions,
          order_item_modifiers(
            id,
            group_name_snapshot,
            option_name_snapshot,
            additional_price_cents_snapshot
          )
        )
      `)
      .eq('id', orderId);

    if (accessToken) {
      query = query.eq('access_token', accessToken);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) return null;
    return order as unknown as OrderRecord;
  }

  /**
   * Fetches active kitchen display orders for a branch.
   */
  static async getKitchenQueue(): Promise<OrderRecord[]> {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) return [];

    const supabase = await createClient();

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number),
        items:order_items(
          id,
          menu_item_id,
          item_name_snapshot,
          unit_price_cents_snapshot,
          quantity,
          line_subtotal_cents,
          special_instructions,
          order_item_modifiers(
            id,
            group_name_snapshot,
            option_name_snapshot,
            additional_price_cents_snapshot
          )
        )
      `)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    return (orders || []) as unknown as OrderRecord[];
  }

  /**
   * Updates order status for kitchen/staff display.
   */
  static async updateOrderStatus(orderId: string, nextStatus: OrderStatus, notes?: string) {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const role = tenantContext.membership.role;
    if (
      role !== 'business_owner' &&
      role !== 'branch_manager' &&
      role !== 'kitchen_staff' &&
      role !== 'cashier' &&
      role !== 'waiter'
    ) {
      return { success: false, message: 'Forbidden. Staff role required to update order status.' };
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('orders')
      .select('id, status, business_id, branch_id')
      .eq('id', orderId)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id)
      .maybeSingle();

    if (!existing) {
      return { success: false, message: 'Order not found in active branch.' };
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'cancelled') {
      updatePayload.cancelled_at = new Date().toISOString();
    } else if (nextStatus === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    // Insert Status History Record
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      previous_status: existing.status,
      new_status: nextStatus,
      changed_by: tenantContext.user.id,
      notes: notes || `Status updated to ${nextStatus}`,
    });

    // Write Audit Log
    await supabase.from('audit_logs').insert({
      business_id: tenantContext.business.id,
      actor_id: tenantContext.user.id,
      action: 'order.status_updated',
      target_type: 'order',
      target_id: orderId,
      payload: { previous_status: existing.status, new_status: nextStatus },
    });

    return { success: true, message: `Order status updated to ${nextStatus}.` };
  }
}

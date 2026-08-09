import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import {
  RecordPaymentInput,
  recordPaymentSchema,
  VoidPaymentInput,
  voidPaymentSchema,
  PaymentMethod,
  PaymentStatus,
} from '@/lib/validation/payment';
import { OrderRecord, OrderItemRecord, OrderItemModifierRecord } from './order.service';

export interface PaymentRecord {
  id: string;
  business_id: string;
  branch_id: string;
  order_id: string;
  payment_reference: string;
  idempotency_key: string;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: 'completed' | 'voided' | 'refunded';
  received_by: string | null;
  external_reference: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface PaymentEventRecord {
  id: string;
  payment_id: string | null;
  order_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string;
  amount_cents: number;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CashierOrderRecord extends OrderRecord {
  paid_cents: number;
  balance_due_cents: number;
  payments: PaymentRecord[];
  bill_requested?: boolean;
  waiter_request_id?: string;
}

export interface ReceiptData {
  business: {
    name: string;
    logo_url: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  order: {
    id: string;
    order_number_formatted: string;
    table_name: string | null;
    table_code: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    guest_notes: string | null;
    status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    subtotal_cents: number;
    tax_cents: number;
    service_charge_cents: number;
    total_cents: number;
    paid_cents: number;
    balance_due_cents: number;
    currency: string;
  };
  items: Array<{
    id: string;
    name: string;
    unit_price_cents: number;
    quantity: number;
    line_subtotal_cents: number;
    special_instructions: string | null;
    modifiers: Array<{
      group_name: string;
      option_name: string;
      additional_price_cents: number;
    }>;
  }>;
  payments: PaymentRecord[];
}

export class PaymentService {
  /**
   * Records payment settlement for an order via private service-role RPC.
   */
  static async recordPayment(input: RecordPaymentInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) {
      return { success: false, message: 'Unauthorized or branch context not found.' };
    }

    const { role } = context.membership;
    if (!['business_owner', 'branch_manager', 'cashier'].includes(role)) {
      return { success: false, message: 'Forbidden. Cashier, Manager, or Owner role required.' };
    }

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Validation failed.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const { orderId, amountCents, paymentMethod, externalReference, notes, idempotencyKey } = parsed.data;
    const admin = createAdminClient();

    // Verify order belongs to active branch
    const { data: order } = await admin
      .from('orders')
      .select('id, branch_id, status')
      .eq('id', orderId)
      .single();

    if (!order || order.branch_id !== context.activeBranch.id) {
      return { success: false, message: 'Order not found in active branch.' };
    }

    if (order.status === 'cancelled') {
      return { success: false, message: 'Cannot record payment for a cancelled order.' };
    }

    // Call private SECURITY DEFINER settlement RPC with service_role client
    const { data, error } = await admin.rpc('record_order_payment', {
      p_order_id: orderId,
      p_amount_cents: amountCents,
      p_payment_method: paymentMethod,
      p_external_reference: externalReference || null,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey,
      p_actor_id: context.user.id,
    });

    if (error || !data) {
      return {
        success: false,
        message: error?.message || 'Failed to record payment.',
      };
    }

    const payload = data as {
      success: boolean;
      error?: string;
      is_duplicate?: boolean;
      payment_id?: string;
      payment_reference?: string;
      total_cents?: number;
      paid_cents?: number;
      balance_due_cents?: number;
      payment_status?: PaymentStatus;
      currency?: string;
    };

    if (!payload.success) {
      if (payload.error === 'OVERPAYMENT_NOT_ALLOWED') {
        return {
          success: false,
          message: `Overpayment not allowed. Maximum payable balance is ${payload.total_cents ? (payload.total_cents / 100).toFixed(2) : ''}.`,
          errorType: 'OVERPAYMENT_NOT_ALLOWED',
        };
      }
      return {
        success: false,
        message: payload.error || 'Failed to process payment.',
      };
    }

    if (payload.payment_status === 'paid') {
      try {
        const { LoyaltyService } = await import('@/server/services/loyalty.service');
        await LoyaltyService.processOrderPointsEarning(orderId);
      } catch (err) {
        console.error('[PaymentService.recordPayment] Loyalty earning error:', err);
      }
    }

    return {
      success: true,
      message: payload.is_duplicate ? 'Duplicate payment entry detected.' : 'Payment recorded successfully.',
      data: {
        paymentId: payload.payment_id!,
        paymentReference: payload.payment_reference!,
        totalCents: payload.total_cents!,
        paidCents: payload.paid_cents!,
        balanceDueCents: payload.balance_due_cents!,
        paymentStatus: payload.payment_status!,
        currency: payload.currency!,
      },
    };
  }

  /**
   * Fetches active branch orders with payment history, derived balances, and bill requests for Cashier POS.
   */
  static async getCashierOrders(): Promise<CashierOrderRecord[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return [];

    const admin = createAdminClient();

    // 1. Fetch Orders with Items and Table details
    const { data: orders, error: ordersErr } = await admin
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
      .eq('branch_id', context.activeBranch.id)
      .order('created_at', { ascending: false });

    if (ordersErr || !orders) return [];

    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];

    // 2. Fetch Payments for Branch Orders
    const { data: payments } = await admin
      .from('payments')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });

    const paymentsByOrder = new Map<string, PaymentRecord[]>();
    if (payments) {
      for (const p of payments as unknown as PaymentRecord[]) {
        const existing = paymentsByOrder.get(p.order_id) || [];
        existing.push(p);
        paymentsByOrder.set(p.order_id, existing);
      }
    }

    // 3. Fetch Pending "Need Bill" Requests for Branch
    const { data: billRequests } = await admin
      .from('waiter_requests')
      .select('id, order_id')
      .eq('branch_id', context.activeBranch.id)
      .eq('request_type', 'need_bill')
      .eq('status', 'pending');

    const pendingBillMap = new Map<string, string>();
    if (billRequests) {
      for (const req of billRequests) {
        if (req.order_id) pendingBillMap.set(req.order_id, req.id);
      }
    }

    // 4. Calculate Derived Totals & Balances
    return orders.map((o) => {
      const orderPayments = paymentsByOrder.get(o.id) || [];
      const completedPayments = orderPayments.filter((p) => p.payment_status === 'completed');
      const paidCents = completedPayments.reduce((sum, p) => sum + p.amount_cents, 0);
      const balanceDueCents = Math.max(0, o.total_cents - paidCents);

      return {
        ...o,
        paid_cents: paidCents,
        balance_due_cents: balanceDueCents,
        payments: orderPayments,
        bill_requested: pendingBillMap.has(o.id),
        waiter_request_id: pendingBillMap.get(o.id),
      } as unknown as CashierOrderRecord;
    });
  }

  /**
   * Resolves complete order itemization and payment breakdown for printable receipt generation.
   */
  static async getOrderReceiptData(orderId: string): Promise<ReceiptData | null> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return null;

    const admin = createAdminClient();

    const { data: order, error } = await admin
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
      .eq('id', orderId)
      .eq('branch_id', context.activeBranch.id)
      .single();

    if (error || !order) return null;

    const { data: payments } = await admin
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    const orderPayments = (payments as unknown as PaymentRecord[]) || [];
    const completedPayments = orderPayments.filter((p) => p.payment_status === 'completed');
    const paidCents = completedPayments.reduce((sum, p) => sum + p.amount_cents, 0);
    const balanceDueCents = Math.max(0, order.total_cents - paidCents);

    const bizObj = context.business as unknown as { logo_url?: string };
    const branchObj = context.activeBranch as unknown as { address?: string };

    return {
      business: {
        name: context.business.name,
        logo_url: bizObj.logo_url || null,
      },
      branch: {
        id: context.activeBranch.id,
        name: context.activeBranch.name,
        code: context.activeBranch.code || null,
        phone: context.activeBranch.phone || null,
        address: branchObj.address || null,
        city: context.activeBranch.city || null,
      },
      order: {
        id: order.id,
        order_number_formatted: order.order_number_formatted,
        table_name: order.table?.name || null,
        table_code: order.table?.code || null,
        guest_name: order.guest_name || null,
        guest_phone: order.guest_phone || null,
        guest_notes: order.guest_notes || null,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        created_at: order.created_at,
        subtotal_cents: order.subtotal_cents,
        tax_cents: order.tax_cents,
        service_charge_cents: order.service_charge_cents,
        total_cents: order.total_cents,
        paid_cents: paidCents,
        balance_due_cents: balanceDueCents,
        currency: order.currency,
      },
      items: ((order.items || []) as OrderItemRecord[]).map((item) => ({
        id: item.id,
        name: item.item_name_snapshot,
        unit_price_cents: item.unit_price_cents_snapshot,
        quantity: item.quantity,
        line_subtotal_cents: item.line_subtotal_cents,
        special_instructions: item.special_instructions || null,
        modifiers: ((item.order_item_modifiers || []) as OrderItemModifierRecord[]).map((mod) => ({
          group_name: mod.group_name_snapshot,
          option_name: mod.option_name_snapshot,
          additional_price_cents: mod.additional_price_cents_snapshot,
        })),
      })),
      payments: orderPayments,
    };
  }

  /**
   * Void payment record (Manager / Owner authorization required).
   */
  static async voidPayment(input: VoidPaymentInput) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const { role } = context.membership;
    if (role !== 'business_owner' && role !== 'branch_manager') {
      return { success: false, message: 'Forbidden. Owner or Manager role required to void payment.' };
    }

    const parsed = voidPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: 'Invalid input data.' };
    }

    const { paymentId, orderId, reason } = parsed.data;
    const admin = createAdminClient();

    const { data: payment } = await admin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('order_id', orderId)
      .single();

    if (!payment || payment.branch_id !== context.activeBranch.id) {
      return { success: false, message: 'Payment record not found.' };
    }

    if (payment.payment_status === 'voided') {
      return { success: false, message: 'Payment is already voided.' };
    }

    // 1. Void payment row
    const { error: voidErr } = await admin
      .from('payments')
      .update({
        payment_status: 'voided',
        notes: payment.notes ? `${payment.notes} | VOIDED: ${reason}` : `VOIDED: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (voidErr) {
      return { success: false, message: voidErr.message };
    }

    // 2. Recalculate remaining payments for order
    const { data: remainingPayments } = await admin
      .from('payments')
      .select('amount_cents')
      .eq('order_id', orderId)
      .eq('payment_status', 'completed');

    const totalPaidRemaining = (remainingPayments || []).reduce((sum, p) => sum + p.amount_cents, 0);

    const { data: order } = await admin.from('orders').select('total_cents').eq('id', orderId).single();
    const totalCents = order?.total_cents || 0;

    let newPaymentStatus: PaymentStatus = 'unpaid';
    if (totalPaidRemaining >= totalCents && totalCents > 0) {
      newPaymentStatus = 'paid';
    } else if (totalPaidRemaining > 0) {
      newPaymentStatus = 'partially_paid';
    } else {
      newPaymentStatus = 'voided';
    }

    await admin.from('orders').update({ payment_status: newPaymentStatus }).eq('id', orderId);

    // 3. Log audit event
    await admin.from('payment_events').insert({
      payment_id: paymentId,
      order_id: orderId,
      event_type: 'payment_voided',
      previous_status: payment.payment_status,
      new_status: 'voided',
      amount_cents: payment.amount_cents,
      actor_id: context.user.id,
      metadata: { reason, voided_by: context.user.id },
    });

    return { success: true, message: 'Payment voided successfully.' };
  }
}

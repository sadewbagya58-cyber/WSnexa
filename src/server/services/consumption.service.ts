import { createAdminClient } from '@/lib/supabase/server';

export class ConsumptionService {
  /**
   * Evaluates whether order status change triggers automated ingredient consumption.
   */
  static async processOrderStageConsumption(
    orderId: string,
    currentStatus: string,
    actorId?: string
  ) {
    const admin = createAdminClient();

    // 1. Fetch order details
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id')
      .eq('id', orderId)
      .single();

    if (!order) return { success: false, message: 'Order not found.' };

    // 2. Fetch inventory settings for branch/business
    const { data: settings } = await admin
      .from('inventory_settings')
      .select('deduction_timing, auto_sold_out_mode')
      .eq('business_id', order.business_id)
      .or(`branch_id.eq.${order.branch_id},branch_id.is.null`)
      .order('branch_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const configuredTiming = settings?.deduction_timing || 'preparing';

    // 3. If the current status matches the configured timing stage, execute atomic consumption
    if (currentStatus === configuredTiming) {
      const { data, error } = await admin.rpc('consume_order_item_ingredients', {
        p_order_id: orderId,
        p_stage: configuredTiming,
        p_actor_id: actorId || null,
      });

      if (error) {
        console.error('Failed to consume order ingredients:', error.message);
        return { success: false, message: error.message };
      }

      return { success: true, data };
    }

    return { success: true, message: 'No consumption trigger for this stage.' };
  }

  /**
   * Reverses order consumption upon order cancellation or void with a specified disposition.
   */
  static async reverseOrderConsumption(
    orderId: string,
    disposition: 'return_to_stock' | 'record_waste' | 'no_change',
    reason: string,
    actorId?: string
  ) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('reverse_order_consumption', {
      p_order_id: orderId,
      p_disposition: disposition,
      p_reason: reason,
      p_actor_id: actorId || null,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  }
}

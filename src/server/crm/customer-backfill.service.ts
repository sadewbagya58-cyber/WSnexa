import { createAdminClient } from '@/lib/supabase/server';
import { CustomerIdentityService } from './customer-identity.service';

export interface BackfillResult {
  businessId: string;
  totalOrdersProcessed: number;
  linkedOrdersCount: number;
  newCustomersCreated: number;
}

export class CustomerBackfillService {
  /**
   * Deterministically backfills crm_customer_id on historical orders for a business.
   * Matches exclusively on exact customer_user_id or exact normalized guest_phone/guest_email.
   * Idempotent and tenant-isolated.
   */
  static async backfillBusinessOrders(businessId: string): Promise<BackfillResult> {
    const admin = createAdminClient();

    // Fetch orders without crm_customer_id
    const { data: unlinkedOrders, error } = await admin
      .from('orders')
      .select('id, business_id, customer_user_id, guest_name, guest_phone, guest_email')
      .eq('business_id', businessId)
      .is('crm_customer_id', null)
      .limit(500);

    if (error || !unlinkedOrders || unlinkedOrders.length === 0) {
      return {
        businessId,
        totalOrdersProcessed: 0,
        linkedOrdersCount: 0,
        newCustomersCreated: 0,
      };
    }

    let linkedOrdersCount = 0;
    const newCustomersCreated = 0;

    for (const order of unlinkedOrders) {
      // Only process orders with an auth user ID or contact info (phone/email)
      if (!order.customer_user_id && !order.guest_phone && !order.guest_email) {
        continue;
      }

      const identity = await CustomerIdentityService.resolveOrCreateCustomerIdentity({
        businessId: order.business_id,
        authUserId: order.customer_user_id,
        guestEmail: order.guest_email,
        guestPhone: order.guest_phone,
        guestName: order.guest_name,
      });

      if (identity) {
        await admin
          .from('orders')
          .update({ crm_customer_id: identity.id })
          .eq('id', order.id);

        linkedOrdersCount += 1;
      }
    }

    return {
      businessId,
      totalOrdersProcessed: unlinkedOrders.length,
      linkedOrdersCount,
      newCustomersCreated,
    };
  }
}
